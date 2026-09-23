import type { TFunction } from 'i18next';

import i18n from '@/i18n';

import { daysUntil, expiryStatus } from './expiry';
import { distanceParts } from './geo';

/** "1", "1.5" / "1,5" depending on the current language. */
export function formatNumber(n: number): string {
  return new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 1 }).format(n);
}

/** Pluralized day count, e.g. "3 dny", "1,5 dne". */
export function daysText(t: TFunction, n: number): string {
  return t('days', { count: n, n: formatNumber(n) });
}

/** Human text for an item's expiry, e.g. "expires in 5 days". */
export function expiryText(t: TFunction, expiresOn: string | null, today: Date = new Date()): string {
  const status = expiryStatus(expiresOn, today);
  if (status === 'none' || !expiresOn) return t('stock.noExpiry');
  if (status === 'expired') return t('stock.expired');
  const days = daysUntil(expiresOn, today);
  if (days === 0) return t('stock.expiresToday');
  return t('stock.expiresIn', { days: daysText(t, days) });
}

export function quantityText(t: TFunction, quantity: number, unit: string): string {
  return `${formatNumber(quantity)} ${t(`units.${unit}`)}`;
}

/** "850 m" / "2,4 km" in the current language. */
export function distanceText(t: TFunction, metres: number): string {
  const { value, unit } = distanceParts(metres);
  return t(`map.${unit}`, { n: formatNumber(value) });
}
