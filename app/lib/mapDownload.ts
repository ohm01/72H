// Downloads an offline map area (and, once, the fonts/sprites it needs) to the phone.
import { Directory, File, Paths } from 'expo-file-system';

import { API_URL, apiHeaders, apiPost } from './api';
import type { BBox } from './mapStyle';
import type { MapArea } from './repo';

type ExtractResponse = { id: string; areaKm2: number; sizeBytes: number; url: string };
type Manifest = { version: number; files: { path: string; size: number }[] };

export const mapsDir = () => new Directory(Paths.document, 'maps');
export const assetsDir = () => new Directory(Paths.document, 'maps', 'assets');

/** Fetches fonts + sprites listed in the server manifest; skips files already present. */
export async function ensureMapAssets(): Promise<void> {
  const root = assetsDir();
  const marker = new File(root, 'manifest.json');
  if (marker.exists) return;
  const res = await fetch(`${API_URL}/v1/maps/assets/manifest.json`, { headers: apiHeaders() });
  if (!res.ok) throw new Error(`assets manifest ${res.status}`);
  const manifest = (await res.json()) as Manifest;
  for (const f of manifest.files) {
    const parts = f.path.split('/');
    const dir = new Directory(root, ...parts.slice(0, -1));
    dir.create({ intermediates: true, idempotent: true });
    const target = new File(dir, parts[parts.length - 1]);
    if (target.exists && target.size === f.size) continue;
    const url = `${API_URL}/v1/maps/assets/${parts.map(encodeURIComponent).join('/')}`;
    await File.downloadFileAsync(url, target, { headers: apiHeaders(), idempotent: true });
  }
  // Written last: its presence means the set is complete.
  marker.create({ intermediates: true, overwrite: true });
  marker.write(JSON.stringify(manifest));
}

/**
 * Asks the server to cut the area, then downloads it with progress (0–1).
 * The server may take tens of seconds for the cut; progress starts after that.
 */
export async function downloadArea(
  bbox: BBox,
  name: string,
  onProgress: (fraction: number) => void,
  signal?: AbortSignal
): Promise<MapArea> {
  await ensureMapAssets();
  const extract = await apiPost<ExtractResponse>('/v1/maps/extracts', bbox);
  const dir = mapsDir();
  dir.create({ intermediates: true, idempotent: true });
  const file = new File(dir, `${extract.id}.pmtiles`);
  await File.downloadFileAsync(`${API_URL}${extract.url}`, file, {
    headers: apiHeaders(),
    idempotent: true,
    signal,
    onProgress: ({ bytesWritten, totalBytes }) => onProgress(totalBytes > 0 ? bytesWritten / totalBytes : 0),
  });
  return { id: extract.id, name, ...bbox, areaKm2: extract.areaKm2, sizeBytes: file.size, fileUri: file.uri };
}

export function deleteAreaFile(area: MapArea): void {
  const file = new File(area.fileUri);
  if (file.exists) file.delete();
}
