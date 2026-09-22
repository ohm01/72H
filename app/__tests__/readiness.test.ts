import { computeReadiness, readinessByLocation } from '@/lib/readiness';

const today = new Date(2026, 8, 22);
const item = (type: string, quantity: number, unit: string, locationId = 'home', expiresOn: string | null = null) => ({
  type,
  quantity,
  unit,
  locationId,
  expiresOn,
});

describe('readiness', () => {
  it('is limited by the scarcer resource', () => {
    const r = computeReadiness([item('water', 24, 'l'), item('food', 6, 'ration')], 2, today);
    expect(r).toEqual({ days: 3, waterDays: 6, foodDays: 3 });
  });

  it('ignores expired items and other types', () => {
    const r = computeReadiness(
      [item('water', 12, 'l'), item('water', 100, 'l', 'home', '2026-09-01'), item('food', 10, 'ration'), item('light', 5, 'pcs')],
      2,
      today
    );
    expect(r.waterDays).toBe(3);
  });

  it('rounds down and handles zero persons', () => {
    expect(computeReadiness([item('water', 5, 'l'), item('food', 5, 'ration')], 2, today).days).toBe(1.2);
    expect(computeReadiness([item('water', 5, 'l')], 0, today).days).toBe(0);
  });

  it('groups by location', () => {
    const r = readinessByLocation([item('water', 6, 'l', 'home'), item('food', 3, 'ration', 'home'), item('water', 2, 'l', 'cottage')], 1, today);
    expect(r.home.days).toBe(3);
    expect(r.cottage.days).toBe(0);
  });
});
