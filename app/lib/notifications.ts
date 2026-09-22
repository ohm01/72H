import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import i18n from '@/i18n';

import { REMINDER_DAYS_BEFORE, REMINDER_HOUR } from './config';
import { compareByExpiry, parseDate } from './expiry';
import type { Item } from './repo';

// iOS keeps at most 64 pending local notifications; stay below that and
// re-sync on every app start and item change so later reminders get scheduled in time.
const MAX_SCHEDULED = 60;
const CHANNEL_ID = 'expiry';
const ID_PREFIX = 'expiry:';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function ensurePermission(): Promise<boolean> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: i18n.t('reminders.channelName'),
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted;
}

type Planned = { id: string; date: Date; item: Item; daysBefore: number };

/** Pure planning step: which reminders should exist right now. Exported for tests. */
export function planReminders(items: Item[], now: Date = new Date()): Planned[] {
  const planned: Planned[] = [];
  for (const item of [...items].sort(compareByExpiry)) {
    if (!item.expiresOn) continue;
    for (const daysBefore of REMINDER_DAYS_BEFORE) {
      const date = parseDate(item.expiresOn);
      date.setDate(date.getDate() - daysBefore);
      date.setHours(REMINDER_HOUR, 0, 0, 0);
      if (date > now) planned.push({ id: `${ID_PREFIX}${item.id}:${daysBefore}`, date, item, daysBefore });
    }
  }
  return planned.sort((a, b) => a.date.getTime() - b.date.getTime()).slice(0, MAX_SCHEDULED);
}

/** Replaces all scheduled expiry reminders. Call with enabled=false to only cancel them. */
export async function syncReminders(items: Item[], enabled: boolean): Promise<void> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter((n) => n.identifier.startsWith(ID_PREFIX))
      .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier))
  );
  if (!enabled) return;
  const { granted } = await Notifications.getPermissionsAsync();
  if (!granted) return;

  for (const r of planReminders(items)) {
    await Notifications.scheduleNotificationAsync({
      identifier: r.id,
      content: {
        title: i18n.t('reminders.title', { name: r.item.name }),
        body: i18n.t('reminders.body', { count: r.daysBefore, name: r.item.name }),
        data: { itemId: r.item.id },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: r.date,
        channelId: CHANNEL_ID,
      },
    });
  }
}
