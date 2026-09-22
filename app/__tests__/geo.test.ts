import { arrowRotationDeg, bboxAreaKm2, bearingDeg, distanceM, distanceParts } from '@/lib/geo';

const prague = { lat: 50.0875, lon: 14.4213 }; // Old Town Square
const brno = { lat: 49.1951, lon: 16.6068 };

describe('geo', () => {
  it('computes distance', () => {
    expect(distanceM(prague, brno) / 1000).toBeCloseTo(185, -1); // ~185 km
    expect(distanceM(prague, prague)).toBe(0);
  });

  it('computes bearing', () => {
    expect(bearingDeg(prague, brno)).toBeGreaterThan(115);
    expect(bearingDeg(prague, brno)).toBeLessThan(125);
    expect(bearingDeg({ lat: 50, lon: 14 }, { lat: 51, lon: 14 })).toBeCloseTo(0, 5);
    expect(bearingDeg({ lat: 50, lon: 14 }, { lat: 50, lon: 13 })).toBeCloseTo(270, 0);
  });

  it('rotates the arrow relative to heading', () => {
    expect(arrowRotationDeg(90, 90)).toBe(0);
    expect(arrowRotationDeg(10, 350)).toBe(20);
    expect(arrowRotationDeg(350, 10)).toBe(340);
  });

  it('formats distance parts', () => {
    expect(distanceParts(847)).toEqual({ value: 850, unit: 'm' });
    expect(distanceParts(2449)).toEqual({ value: 2.4, unit: 'km' });
  });

  it('matches the server area formula', () => {
    const a = bboxAreaKm2(14.4, 50.07, 14.44, 50.1);
    expect(a).toBeGreaterThan(9);
    expect(a).toBeLessThan(10.5);
  });
});
