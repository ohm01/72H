// Emergency bags: ordinary stock locations (expiry works as usual) with their own packing checklist.
// Default one bag per person; optionally one shared bag for the whole household.
import type { SQLiteDatabase } from 'expo-sqlite';

import { GUIDES, visibleGroups } from './guides';
import { GOBAG_KEY, type Household, getChecks, getSetting, listItems, listLocations, saveLocation, setSetting } from './repo';

export type BagKind = 'adult' | 'child' | 'household';
export type Bag = { id: string; kind: BagKind };
export type BagView = Bag & { name: string; done: number; total: number; soon: { name: string; expiresOn: string }[] };

const BAGS_KEY = 'gobags';

export const bagCheckKey = (bagId: string) => `GUIDE:gobag:${bagId}`;

/** Bags whose location still exists. Moves the old single bag (and its checks) over once. */
export async function listBags(db: SQLiteDatabase): Promise<Bag[]> {
  let bags = JSON.parse((await getSetting(db, BAGS_KEY)) ?? '[]') as Bag[];
  const legacy = await getSetting(db, GOBAG_KEY);
  if (legacy) {
    if (!bags.some((b) => b.id === legacy)) {
      bags = [{ id: legacy, kind: 'household' }, ...bags];
      await db.runAsync("UPDATE checklist_checks SET country = ? WHERE country = 'GUIDE:gobag'", bagCheckKey(legacy));
    }
    await setSetting(db, BAGS_KEY, JSON.stringify(bags));
    await db.runAsync('DELETE FROM settings WHERE key = ?', GOBAG_KEY);
  }
  const alive = new Set((await listLocations(db)).map((l) => l.id));
  return bags.filter((b) => alive.has(b.id));
}

export async function addBags(db: SQLiteDatabase, bags: { name: string; kind: BagKind }[]): Promise<void> {
  const existing = await listBags(db);
  for (const b of bags) existing.push({ id: await saveLocation(db, { name: b.name, lat: null, lon: null }), kind: b.kind });
  await setSetting(db, BAGS_KEY, JSON.stringify(existing));
}

/** Packing groups for one bag: children's items in a child's bag (or the shared one with children), pets not in a child's bag. */
export function bagGroups(kind: BagKind, household: Household) {
  return visibleGroups(GUIDES.gobag, {
    pets: kind === 'child' ? 0 : household.pets,
    children: kind === 'child' ? 1 : kind === 'household' ? household.children : 0,
  });
}

const SOON_DAYS = 30;

/** Bags with packing progress and items that expire within a month (for the card on the Stock tab). */
export async function loadBags(db: SQLiteDatabase, household: Household, today = new Date()): Promise<BagView[]> {
  const [bags, locations, items] = await Promise.all([listBags(db), listLocations(db), listItems(db)]);
  const limit = new Date(today.getTime() + SOON_DAYS * 86400000).toISOString().slice(0, 10);
  const views: BagView[] = [];
  for (const bag of bags) {
    const groups = bagGroups(bag.kind, household);
    const checks = await getChecks(db, bagCheckKey(bag.id));
    const ids = groups.flatMap((g) => g.items.map((i) => i.id));
    views.push({
      ...bag,
      name: locations.find((l) => l.id === bag.id)?.name ?? '',
      done: ids.filter((id) => checks.has(id)).length,
      total: ids.length,
      soon: items
        .filter((i) => i.locationId === bag.id && i.expiresOn && i.expiresOn <= limit)
        .sort((a, b) => a.expiresOn!.localeCompare(b.expiresOn!))
        .map((i) => ({ name: i.name, expiresOn: i.expiresOn! })),
    });
  }
  return views;
}
