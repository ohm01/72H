import { LIMITS } from '@/lib/config';
import { downloadBlock, downloadsResetDate, radiusOptions } from '@/lib/mapAreas';
import { unionBBox } from '@/lib/mapStyle';

describe('map areas', () => {
  it('offers only sizes the tier allows', () => {
    const free = radiusOptions(50.08, 14.42, LIMITS.free.mapAreaMaxKm2);
    const allowed = free.filter((o) => o.allowed).map((o) => o.radiusKm);
    expect(allowed).toEqual([3, 5, 8, 11]); // 22 × 22 km ≈ 484 km² still fits 500
    free.filter((o) => o.allowed).forEach((o) => expect(o.areaKm2).toBeLessThanOrEqual(500));
    const plus = radiusOptions(50.08, 14.42, LIMITS.plus.mapAreaMaxKm2);
    expect(plus.every((o) => o.allowed)).toBe(true);
    // ~2r × 2r
    expect(free[1].areaKm2).toBeCloseTo(100, -1);
  });

  it('blocks downloads over the area count or monthly limit', () => {
    expect(downloadBlock(LIMITS.free, 0, 0)).toBeNull();
    expect(downloadBlock(LIMITS.free, 1, 0)).toBe('areas');
    expect(downloadBlock(LIMITS.free, 0, 2)).toBe('downloads');
    expect(downloadBlock(LIMITS.plus, 4, 9)).toBeNull();
  });

  it('resets downloads on the first day of next month', () => {
    const d = downloadsResetDate(new Date(2026, 11, 15));
    expect([d.getFullYear(), d.getMonth(), d.getDate()]).toEqual([2027, 0, 1]);
  });

  it('unions bounding boxes', () => {
    expect(unionBBox([])).toBeNull();
    expect(
      unionBBox([
        { west: 14, south: 50, east: 14.5, north: 50.2 },
        { west: 13.9, south: 50.1, east: 14.2, north: 50.4 },
      ])
    ).toEqual({ west: 13.9, south: 50, east: 14.5, north: 50.4 });
  });
});
