// Integration tests: lib/db.ts migrate() + lib/repo.ts against a real (in-memory) SQLite.
import { createTestDb } from './helpers/sqlite';

import { migrate } from '@/lib/db';
import { computeReadiness, readinessByLocation } from '@/lib/readiness';
import {
  deleteItem,
  deleteLocation,
  deleteMeetingPoint,
  getChecks,
  getHousehold,
  getItem,
  getSetting,
  isOnboarded,
  listItems,
  listLocations,
  listMeetingPoints,
  saveItem,
  saveLocation,
  saveMeetingPoint,
  setCheck,
  setHousehold,
  setSetting,
} from '@/lib/repo';

jest.mock('expo-crypto', () => ({ randomUUID: () => require('crypto').randomUUID() }));

const TODAY = new Date(2026, 8, 22); // 2026-09-22 local

let db: ReturnType<typeof createTestDb>;

beforeEach(async () => {
  db = createTestDb();
  await migrate(db);
});

afterEach(() => db.close());

const water = (locationId: string, quantity: number, expiresOn: string | null = '2027-09-01') => ({
  locationId,
  name: 'Voda',
  type: 'water' as const,
  quantity,
  unit: 'l' as const,
  expiresOn,
  note: null,
});

const food = (locationId: string, quantity: number, expiresOn: string | null = '2027-01-01') => ({
  locationId,
  name: 'Konzervy',
  type: 'food' as const,
  quantity,
  unit: 'ration' as const,
  expiresOn,
  note: null,
});

describe('migrate', () => {
  it('sets user_version and is idempotent', async () => {
    const v1 = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
    expect(v1?.user_version).toBe(3);
    await setSetting(db, 'x', 'y');
    await migrate(db); // second run must be a no-op, not re-create tables
    const v2 = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
    expect(v2?.user_version).toBe(3);
    expect(await getSetting(db, 'x')).toBe('y');
    const tables = await db.getAllAsync<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name"
    );
    expect(tables.map((t) => t.name)).toEqual(['checklist_checks', 'contacts', 'items', 'locations', 'map_areas', 'meeting_points', 'settings']);
  });

  it('enables foreign keys', async () => {
    await expect(saveItem(db, water('no-such-location', 1))).rejects.toThrow(/FOREIGN KEY/);
  });
});

describe('settings & household', () => {
  it('has defaults on a fresh DB', async () => {
    expect(await getHousehold(db)).toEqual({ persons: 1, children: 0, pets: 0 });
    expect(await isOnboarded(db)).toBe(false);
    expect(await getSetting(db, 'language')).toBeNull();
  });

  it('upserts settings', async () => {
    await setHousehold(db, { persons: 4, pets: 1 });
    await setHousehold(db, { persons: 3, pets: 2 });
    expect(await getHousehold(db)).toEqual({ persons: 3, children: 0, pets: 2 });
    await setHousehold(db, { persons: 3, children: 1, pets: 2 });
    expect(await getHousehold(db)).toEqual({ persons: 3, children: 1, pets: 2 });
    // At least one adult: children never exceed persons - 1.
    await setHousehold(db, { persons: 1, pets: 0 });
    expect((await getHousehold(db)).children).toBe(0);
    await setSetting(db, 'onboarded', '1');
    expect(await isOnboarded(db)).toBe(true);
  });
});

describe('locations', () => {
  it('creates, renames and lists', async () => {
    const id = await saveLocation(db, { name: 'Doma', lat: null, lon: null });
    await saveLocation(db, { id, name: 'Byt', lat: 50.1, lon: 14.4 });
    expect(await listLocations(db)).toEqual([{ id, name: 'Byt', lat: 50.1, lon: 14.4 }]);
  });

  it('soft delete cascades to its items only', async () => {
    const home = await saveLocation(db, { name: 'Doma', lat: null, lon: null });
    const cottage = await saveLocation(db, { name: 'Chata', lat: null, lon: null });
    await saveItem(db, water(home, 6));
    const cottageItem = await saveItem(db, water(cottage, 4));

    await deleteLocation(db, cottage);

    expect((await listLocations(db)).map((l) => l.id)).toEqual([home]);
    const items = await listItems(db);
    expect(items).toHaveLength(1);
    expect(items[0].locationId).toBe(home);
    expect(await getItem(db, cottageItem)).toBeNull();
    // Row stays for sync (soft delete) with deleted_at set.
    const raw = await db.getFirstAsync<{ deleted_at: string | null }>('SELECT deleted_at FROM items WHERE id = ?', cottageItem);
    expect(raw?.deleted_at).toEqual(expect.any(String));
  });
});

describe('items', () => {
  it('saves, reads, updates and deletes', async () => {
    const home = await saveLocation(db, { name: 'Doma', lat: null, lon: null });
    const cottage = await saveLocation(db, { name: 'Chata', lat: null, lon: null });
    const id = await saveItem(db, { ...water(home, 6), note: 'sklep' });

    expect(await getItem(db, id)).toEqual({
      id,
      locationId: home,
      name: 'Voda',
      type: 'water',
      quantity: 6,
      unit: 'l',
      expiresOn: '2027-09-01',
      note: 'sklep',
    });

    await saveItem(db, { ...water(cottage, 1.5, null), id, name: 'Voda balená' });
    const updated = await getItem(db, id);
    expect(updated).toMatchObject({ locationId: cottage, name: 'Voda balená', quantity: 1.5, expiresOn: null, note: null });
    expect(await listItems(db)).toHaveLength(1); // update, not insert

    await deleteItem(db, id);
    expect(await getItem(db, id)).toBeNull();
    expect(await listItems(db)).toEqual([]);
  });
});

describe('meeting points', () => {
  it('creates, updates, lists and soft-deletes', async () => {
    const base = { note: null, address: null, lat: null, lon: null, photoUri: null };
    const a = await saveMeetingPoint(db, { ...base, name: 'Škola' });
    const b = await saveMeetingPoint(db, { ...base, name: 'Park', note: 'u lavičky' });
    await saveMeetingPoint(db, { ...base, id: a, name: 'Škola ZŠ', lat: 50, lon: 14 });

    const list = await listMeetingPoints(db);
    expect(list.map((m) => m.name).sort()).toEqual(['Park', 'Škola ZŠ']);
    expect(list.find((m) => m.id === a)).toMatchObject({ lat: 50, lon: 14, photoUri: null });

    await deleteMeetingPoint(db, b);
    expect((await listMeetingPoints(db)).map((m) => m.id)).toEqual([a]);
  });
});

describe('checklist checks', () => {
  it('toggles per country', async () => {
    await setCheck(db, 'CZ', 'water', true);
    await setCheck(db, 'CZ', 'water', true); // idempotent
    await setCheck(db, 'CZ', 'radio', true);
    await setCheck(db, 'SK', 'water', true);
    expect(await getChecks(db, 'CZ')).toEqual(new Set(['water', 'radio']));

    await setCheck(db, 'CZ', 'water', false);
    expect(await getChecks(db, 'CZ')).toEqual(new Set(['radio']));
    expect(await getChecks(db, 'SK')).toEqual(new Set(['water']));
  });
});

describe('M1 goal: supplies at home and at the cottage', () => {
  it('onboarding-like data -> items in two locations -> readiness per location', async () => {
    // Onboarding: 2 persons, 1 pet, first location, meeting point, done.
    await db.withTransactionAsync(async () => {
      await setHousehold(db, { persons: 2, pets: 1 });
      await saveLocation(db, { name: 'Doma', lat: null, lon: null });
      await saveMeetingPoint(db, { name: 'Škola', note: null, address: null, lat: null, lon: null, photoUri: null });
      await setSetting(db, 'onboarded', '1');
    });
    expect(await isOnboarded(db)).toBe(true);
    const [home] = await listLocations(db);
    const cottage = await saveLocation(db, { name: 'Chata', lat: null, lon: null });

    // Home: 12 l water (3 days for 2), 6 rations (3 days) + 2 expired rations that must not count.
    await saveItem(db, water(home.id, 12));
    await saveItem(db, food(home.id, 6));
    await saveItem(db, food(home.id, 2, '2026-09-01'));
    // Cottage: 4 l water (1 day), 3 rations (1.5 days) + a flashlight (does not affect days).
    await saveItem(db, water(cottage, 4));
    await saveItem(db, food(cottage, 3));
    await saveItem(db, { locationId: cottage, name: 'Baterka', type: 'light', quantity: 1, unit: 'pcs', expiresOn: null, note: null });

    const items = await listItems(db);
    const { persons } = await getHousehold(db);
    const byLoc = readinessByLocation(items, persons, TODAY);

    expect(byLoc[home.id]).toEqual({ days: 3, waterDays: 3, foodDays: 3 });
    expect(byLoc[cottage]).toEqual({ days: 1, waterDays: 1, foodDays: 1.5 });
    expect(computeReadiness(items, persons, TODAY)).toEqual({ days: 4, waterDays: 4, foodDays: 4.5 });
  });
});
