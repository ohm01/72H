import { EXPIRY_ORANGE_DAYS, EXPIRY_RED_DAYS } from './config';

export type ExpiryStatus = 'expired' | 'red' | 'orange' | 'green' | 'none';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Parse 'YYYY-MM-DD' as a local calendar date (midnight). */
export function parseDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function formatIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Whole calendar days from today to the expiry date (negative = expired). */
export function daysUntil(expiresOn: string, today: Date = new Date()): number {
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((parseDate(expiresOn).getTime() - start.getTime()) / DAY_MS);
}

export function expiryStatus(expiresOn: string | null, today: Date = new Date()): ExpiryStatus {
  if (!expiresOn) return 'none';
  const days = daysUntil(expiresOn, today);
  if (days < 0) return 'expired';
  if (days <= EXPIRY_RED_DAYS) return 'red';
  if (days <= EXPIRY_ORANGE_DAYS) return 'orange';
  return 'green';
}

/** Sort key: items with an expiry first (soonest first), then items without. */
export function compareByExpiry(a: { expiresOn: string | null }, b: { expiresOn: string | null }): number {
  if (a.expiresOn && b.expiresOn) return a.expiresOn.localeCompare(b.expiresOn);
  if (a.expiresOn) return -1;
  if (b.expiresOn) return 1;
  return 0;
}
