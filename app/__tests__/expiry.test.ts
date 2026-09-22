import { compareByExpiry, daysUntil, expiryStatus, formatIsoDate, parseDate } from '@/lib/expiry';

const today = new Date(2026, 8, 22); // 2026-09-22

describe('expiry', () => {
  it('parses and formats local dates', () => {
    expect(formatIsoDate(parseDate('2026-01-05'))).toBe('2026-01-05');
  });

  it('counts calendar days', () => {
    expect(daysUntil('2026-09-22', today)).toBe(0);
    expect(daysUntil('2026-09-29', today)).toBe(7);
    expect(daysUntil('2026-09-21', today)).toBe(-1);
  });

  it('maps days to colors', () => {
    expect(expiryStatus(null, today)).toBe('none');
    expect(expiryStatus('2026-09-21', today)).toBe('expired');
    expect(expiryStatus('2026-09-22', today)).toBe('red');
    expect(expiryStatus('2026-09-29', today)).toBe('red');
    expect(expiryStatus('2026-09-30', today)).toBe('orange');
    expect(expiryStatus('2026-10-22', today)).toBe('orange');
    expect(expiryStatus('2026-10-23', today)).toBe('green');
  });

  it('sorts soonest first, no-expiry last', () => {
    const items = [{ expiresOn: null }, { expiresOn: '2027-01-01' }, { expiresOn: '2026-10-01' }];
    expect(items.sort(compareByExpiry).map((i) => i.expiresOn)).toEqual(['2026-10-01', '2027-01-01', null]);
  });
});
