// Offline navigation helpers: distance and bearing on a sphere (good enough for walking distances).

const R = 6371008.8; // mean Earth radius, metres
const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;

export type LatLon = { lat: number; lon: number };

/** Great-circle distance in metres (haversine). */
export function distanceM(a: LatLon, b: LatLon): number {
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Initial bearing from a to b, degrees clockwise from true north (0–360). */
export function bearingDeg(a: LatLon, b: LatLon): number {
  const y = Math.sin(rad(b.lon - a.lon)) * Math.cos(rad(b.lat));
  const x = Math.cos(rad(a.lat)) * Math.sin(rad(b.lat)) - Math.sin(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.cos(rad(b.lon - a.lon));
  return (deg(Math.atan2(y, x)) + 360) % 360;
}

/** Arrow rotation on screen: target bearing relative to where the phone points. */
export function arrowRotationDeg(targetBearing: number, heading: number): number {
  return (targetBearing - heading + 360) % 360;
}

/** "850 m" / "2.4 km" (locale-independent number; UI formats units). */
export function distanceParts(m: number): { value: number; unit: 'm' | 'km' } {
  if (m < 1000) return { value: Math.round(m / 10) * 10, unit: 'm' };
  return { value: Math.round(m / 100) / 10, unit: 'km' };
}

/** Area of a lon/lat rectangle in km² – must match server/app/geo.py. */
export function bboxAreaKm2(west: number, south: number, east: number, north: number): number {
  const Rk = 6371.0088;
  return Rk * Rk * rad(east - west) * Math.abs(Math.sin(rad(north)) - Math.sin(rad(south)));
}
