// Offline map style: one PMTiles source per downloaded area, Protomaps basemap layers,
// fonts and sprites from local files. No network requests at render time.
import { layers, namedFlavor } from '@protomaps/basemaps';
import type { LayerSpecification, StyleSpecification } from '@maplibre/maplibre-react-native';

import type { MapArea } from './repo';

export type BBox = { west: number; south: number; east: number; north: number };

const KM_PER_DEG_LAT = 111.32;

/** Square area of ±radiusKm around a point (what the user downloads). */
export function bboxAround(lat: number, lon: number, radiusKm: number): BBox {
  const dLat = radiusKm / KM_PER_DEG_LAT;
  const dLon = radiusKm / (KM_PER_DEG_LAT * Math.cos((lat * Math.PI) / 180));
  const r = (v: number) => Math.round(v * 1e5) / 1e5;
  return { west: r(lon - dLon), south: r(lat - dLat), east: r(lon + dLon), north: r(lat + dLat) };
}

/** Union of all areas, e.g. to fit the camera. */
export function unionBBox(areas: BBox[]): BBox | null {
  if (!areas.length) return null;
  return {
    west: Math.min(...areas.map((a) => a.west)),
    south: Math.min(...areas.map((a) => a.south)),
    east: Math.max(...areas.map((a) => a.east)),
    north: Math.max(...areas.map((a) => a.north)),
  };
}

export function containsPoint(b: BBox, lat: number, lon: number): boolean {
  return lon >= b.west && lon <= b.east && lat >= b.south && lat <= b.north;
}

const withSlash = (uri: string) => (uri.endsWith('/') ? uri : `${uri}/`);

export function buildOfflineStyle(
  areas: Pick<MapArea, 'id' | 'fileUri'>[],
  assetsUri: string,
  opts: { dark: boolean; lang: string }
): StyleSpecification {
  const flavor = namedFlavor(opts.dark ? 'dark' : 'light');
  const assets = withSlash(assetsUri);
  const sources: StyleSpecification['sources'] = {};
  const out: LayerSpecification[] = [];

  areas.forEach((area, i) => {
    const source = `area${i}`;
    sources[source] = {
      type: 'vector',
      url: `pmtiles://${area.fileUri}`,
      attribution: '© OpenStreetMap contributors',
    };
    for (const layer of layers(source, flavor, { lang: opts.lang }) as LayerSpecification[]) {
      // One background is enough; other layer ids must be unique per source.
      if (layer.type === 'background' && i > 0) continue;
      out.push({ ...layer, id: `${layer.id}:${i}` } as LayerSpecification);
    }
  });

  if (!out.length) out.push({ id: 'background', type: 'background', paint: { 'background-color': flavor.background } });

  return {
    version: 8,
    glyphs: `${assets}fonts/{fontstack}/{range}.pbf`,
    sprite: `${assets}sprites/${opts.dark ? 'dark' : 'light'}`,
    sources,
    layers: out,
  };
}
