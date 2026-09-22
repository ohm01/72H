import { expiryStatus } from './expiry';

// Minimal daily needs used for "how many days are we covered".
// Source: 72h.gov.cz – 2 l of drinking water per adult per day; food counted in daily rations.
export const WATER_L_PER_PERSON_DAY = 2;
export const FOOD_RATIONS_PER_PERSON_DAY = 1;

export type ReadinessItem = {
  type: string;
  quantity: number;
  unit: string;
  expiresOn: string | null;
  locationId: string;
};

export type Readiness = {
  days: number; // limited by the scarcer of water and food
  waterDays: number;
  foodDays: number;
};

/** Expired items do not count towards readiness. */
function usable(item: ReadinessItem, today: Date): boolean {
  return expiryStatus(item.expiresOn, today) !== 'expired';
}

export function computeReadiness(items: ReadinessItem[], persons: number, today: Date = new Date()): Readiness {
  if (persons <= 0) return { days: 0, waterDays: 0, foodDays: 0 };
  let waterL = 0;
  let foodRations = 0;
  for (const item of items) {
    if (!usable(item, today)) continue;
    if (item.type === 'water' && item.unit === 'l') waterL += item.quantity;
    if (item.type === 'food' && item.unit === 'ration') foodRations += item.quantity;
  }
  const waterDays = waterL / (WATER_L_PER_PERSON_DAY * persons);
  const foodDays = foodRations / (FOOD_RATIONS_PER_PERSON_DAY * persons);
  return {
    days: floor1(Math.min(waterDays, foodDays)),
    waterDays: floor1(waterDays),
    foodDays: floor1(foodDays),
  };
}

export function readinessByLocation(
  items: ReadinessItem[],
  persons: number,
  today: Date = new Date()
): Record<string, Readiness> {
  const groups: Record<string, ReadinessItem[]> = {};
  for (const item of items) (groups[item.locationId] ??= []).push(item);
  const result: Record<string, Readiness> = {};
  for (const [locationId, group] of Object.entries(groups)) {
    result[locationId] = computeReadiness(group, persons, today);
  }
  return result;
}

/** Round down to one decimal so we never overstate readiness. */
function floor1(n: number): number {
  return Math.floor(n * 10) / 10;
}
