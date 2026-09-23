// Looks an address up while the user types (platform geocoder, needs internet).
import * as Location from 'expo-location';
import { useEffect, useState } from 'react';

import type { LatLon } from './geo';

export type GeocodeResult =
  | { status: 'idle' }
  | { status: 'searching' }
  | { status: 'notFound' }
  | { status: 'found'; point: LatLon; label: string };

const DEBOUNCE_MS = 700;

/** Human label for a found place, e.g. "Za Střelnicí 950, Sezemice, Pardubický kraj". */
function labelOf(a: Location.LocationGeocodedAddress | undefined): string {
  if (!a) return '';
  const street = [a.street, a.streetNumber].filter(Boolean).join(' ');
  return [street, a.city ?? a.subregion, a.region].filter(Boolean).join(', ');
}

export function useGeocode(query: string): GeocodeResult {
  const [result, setResult] = useState<GeocodeResult>({ status: 'idle' });

  useEffect(() => {
    const q = query.trim();
    if (q.length < 3) return setResult({ status: 'idle' });
    let active = true;
    setResult({ status: 'searching' });
    const timer = setTimeout(async () => {
      try {
        const [hit] = await Location.geocodeAsync(q);
        if (!active) return;
        if (!hit) return setResult({ status: 'notFound' });
        const point = { lat: hit.latitude, lon: hit.longitude };
        const [addr] = await Location.reverseGeocodeAsync({ latitude: hit.latitude, longitude: hit.longitude }).catch(() => []);
        if (active) setResult({ status: 'found', point, label: labelOf(addr) });
      } catch {
        if (active) setResult({ status: 'notFound' });
      }
    }, DEBOUNCE_MS);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [query]);

  return result;
}
