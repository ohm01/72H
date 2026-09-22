import { planReminders } from '@/lib/notifications';
import type { Item } from '@/lib/repo';

jest.mock('expo-notifications', () => ({ setNotificationHandler: jest.fn() }));

const item = (id: string, expiresOn: string | null): Item => ({
  id,
  expiresOn,
  name: id,
  locationId: 'home',
  type: 'food',
  quantity: 1,
  unit: 'ration',
  note: null,
});

describe('planReminders', () => {
  const now = new Date(2026, 8, 22, 12, 0);

  it('plans 30 and 7 days before at 9:00, only in the future', () => {
    const planned = planReminders([item('a', '2026-11-30'), item('b', '2026-10-05'), item('c', null)], now);
    expect(planned.map((p) => p.id)).toEqual(['expiry:b:7', 'expiry:a:30', 'expiry:a:7']);
    expect(planned[0].date).toEqual(new Date(2026, 8, 28, 9, 0));
  });

  it('caps the number of scheduled reminders', () => {
    const many = Array.from({ length: 100 }, (_, i) => item(`i${i}`, '2027-06-01'));
    expect(planReminders(many, now)).toHaveLength(60);
  });
});
