import type { SQLiteDatabase } from 'expo-sqlite';

import { DEFAULT_COUNTRY } from './config';
import { COUNTRIES } from './countries';
import { WATER_L_PER_PERSON_DAY } from './readiness';
import { getSetting } from './repo';
import { type Standard, type StandardMode, buildStandard } from './standards';

export async function loadStandard(db: SQLiteDatabase): Promise<Standard> {
  const home = (await getSetting(db, 'homeCountry')) ?? DEFAULT_COUNTRY;
  const mode = ((await getSetting(db, 'standard')) ?? 'country') as StandardMode;
  return buildStandard(mode, home in COUNTRIES ? home : DEFAULT_COUNTRY, COUNTRIES);
}

/** Daily drinking water per person used for readiness days. */
export function waterPerDay(standard: Standard): number {
  const water = standard.rec.items.find((i) => i.id === 'water');
  return water?.quantity.perDay && water.quantity.unit === 'l' && water.quantity.amount ? water.quantity.amount : WATER_L_PER_PERSON_DAY;
}
