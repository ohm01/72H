import { randomUUID } from 'expo-crypto';
import type { SQLiteDatabase } from 'expo-sqlite';

// ---------- Types ----------

export type Location = { id: string; name: string; lat: number | null; lon: number | null };

export type Item = {
  id: string;
  locationId: string;
  name: string;
  type: ItemType;
  quantity: number;
  unit: Unit;
  expiresOn: string | null; // YYYY-MM-DD
  note: string | null;
};

export type MeetingPoint = {
  id: string;
  name: string;
  note: string | null;
  address: string | null;
  lat: number | null;
  lon: number | null;
  photoUri: string | null;
};

export const ITEM_TYPES = ['water', 'food', 'medicine', 'hygiene', 'energy', 'light', 'documents', 'tools', 'pets', 'other'] as const;
export type ItemType = (typeof ITEM_TYPES)[number];

export const UNITS = ['l', 'ration', 'pcs', 'pack'] as const;
export type Unit = (typeof UNITS)[number];

export const DEFAULT_UNIT: Record<ItemType, Unit> = {
  water: 'l',
  food: 'ration',
  medicine: 'pack',
  hygiene: 'pcs',
  energy: 'pcs',
  light: 'pcs',
  documents: 'pcs',
  tools: 'pcs',
  pets: 'ration',
  other: 'pcs',
};

export type Household = { persons: number; pets: number };

const now = () => new Date().toISOString();

// ---------- Settings ----------

export async function getSetting(db: SQLiteDatabase, key: string): Promise<string | null> {
  const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM settings WHERE key = ?', key);
  return row?.value ?? null;
}

export async function setSetting(db: SQLiteDatabase, key: string, value: string): Promise<void> {
  await db.runAsync(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    key,
    value
  );
}

export async function getHousehold(db: SQLiteDatabase): Promise<Household> {
  const persons = Number((await getSetting(db, 'persons')) ?? 1);
  const pets = Number((await getSetting(db, 'pets')) ?? 0);
  return { persons, pets };
}

export async function setHousehold(db: SQLiteDatabase, h: Household): Promise<void> {
  await setSetting(db, 'persons', String(h.persons));
  await setSetting(db, 'pets', String(h.pets));
}

export async function isOnboarded(db: SQLiteDatabase): Promise<boolean> {
  return (await getSetting(db, 'onboarded')) === '1';
}

// ---------- Locations ----------

export async function listLocations(db: SQLiteDatabase): Promise<Location[]> {
  return db.getAllAsync<Location>(
    'SELECT id, name, lat, lon FROM locations WHERE deleted_at IS NULL ORDER BY created_at'
  );
}

export async function saveLocation(db: SQLiteDatabase, loc: Omit<Location, 'id'> & { id?: string }): Promise<string> {
  const id = loc.id ?? randomUUID();
  const ts = now();
  await db.runAsync(
    `INSERT INTO locations (id, name, lat, lon, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET name = excluded.name, lat = excluded.lat, lon = excluded.lon, updated_at = excluded.updated_at`,
    id,
    loc.name,
    loc.lat,
    loc.lon,
    ts,
    ts
  );
  return id;
}

/** Soft-deletes the location together with its items. */
export async function deleteLocation(db: SQLiteDatabase, id: string): Promise<void> {
  const ts = now();
  await db.withTransactionAsync(async () => {
    await db.runAsync('UPDATE items SET deleted_at = ?, updated_at = ? WHERE location_id = ? AND deleted_at IS NULL', ts, ts, id);
    await db.runAsync('UPDATE locations SET deleted_at = ?, updated_at = ? WHERE id = ?', ts, ts, id);
  });
}

// ---------- Items ----------

const ITEM_COLUMNS =
  'id, location_id AS locationId, name, type, quantity, unit, expires_on AS expiresOn, note';

export async function listItems(db: SQLiteDatabase): Promise<Item[]> {
  return db.getAllAsync<Item>(`SELECT ${ITEM_COLUMNS} FROM items WHERE deleted_at IS NULL`);
}

export async function getItem(db: SQLiteDatabase, id: string): Promise<Item | null> {
  return db.getFirstAsync<Item>(`SELECT ${ITEM_COLUMNS} FROM items WHERE id = ? AND deleted_at IS NULL`, id);
}

export async function saveItem(db: SQLiteDatabase, item: Omit<Item, 'id'> & { id?: string }): Promise<string> {
  const id = item.id ?? randomUUID();
  const ts = now();
  await db.runAsync(
    `INSERT INTO items (id, location_id, name, type, quantity, unit, expires_on, note, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET location_id = excluded.location_id, name = excluded.name, type = excluded.type,
       quantity = excluded.quantity, unit = excluded.unit, expires_on = excluded.expires_on, note = excluded.note,
       updated_at = excluded.updated_at`,
    id,
    item.locationId,
    item.name,
    item.type,
    item.quantity,
    item.unit,
    item.expiresOn,
    item.note,
    ts,
    ts
  );
  return id;
}

export async function deleteItem(db: SQLiteDatabase, id: string): Promise<void> {
  const ts = now();
  await db.runAsync('UPDATE items SET deleted_at = ?, updated_at = ? WHERE id = ?', ts, ts, id);
}

/** Id of the stock location the user added as their emergency bag (settings key). */
export const GOBAG_KEY = 'gobagLocationId';

/** Parent's own help message on the kids screen (settings key; empty = default text). */
export const KIDS_HELP_KEY = 'kidsHelp';

// ---------- Meeting points ----------

const MP_COLUMNS = 'id, name, note, address, lat, lon, photo_uri AS photoUri';

export async function listMeetingPoints(db: SQLiteDatabase): Promise<MeetingPoint[]> {
  return db.getAllAsync<MeetingPoint>(
    `SELECT ${MP_COLUMNS} FROM meeting_points WHERE deleted_at IS NULL ORDER BY created_at`
  );
}

export async function saveMeetingPoint(
  db: SQLiteDatabase,
  mp: Omit<MeetingPoint, 'id'> & { id?: string }
): Promise<string> {
  const id = mp.id ?? randomUUID();
  const ts = now();
  await db.runAsync(
    `INSERT INTO meeting_points (id, name, note, address, lat, lon, photo_uri, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET name = excluded.name, note = excluded.note, address = excluded.address,
       lat = excluded.lat, lon = excluded.lon, photo_uri = excluded.photo_uri, updated_at = excluded.updated_at`,
    id,
    mp.name,
    mp.note,
    mp.address,
    mp.lat,
    mp.lon,
    mp.photoUri,
    ts,
    ts
  );
  return id;
}

export async function getMeetingPoint(db: SQLiteDatabase, id: string): Promise<MeetingPoint | null> {
  return db.getFirstAsync<MeetingPoint>(`SELECT ${MP_COLUMNS} FROM meeting_points WHERE id = ? AND deleted_at IS NULL`, id);
}

export async function deleteMeetingPoint(db: SQLiteDatabase, id: string): Promise<void> {
  const ts = now();
  await db.runAsync('UPDATE meeting_points SET deleted_at = ?, updated_at = ? WHERE id = ?', ts, ts, id);
}

// ---------- Checklist ----------

export async function getChecks(db: SQLiteDatabase, country: string): Promise<Set<string>> {
  const rows = await db.getAllAsync<{ item_id: string }>('SELECT item_id FROM checklist_checks WHERE country = ?', country);
  return new Set(rows.map((r) => r.item_id));
}

export async function setCheck(db: SQLiteDatabase, country: string, itemId: string, checked: boolean): Promise<void> {
  if (checked) {
    await db.runAsync(
      'INSERT OR REPLACE INTO checklist_checks (country, item_id, checked_at) VALUES (?, ?, ?)',
      country,
      itemId,
      now()
    );
  } else {
    await db.runAsync('DELETE FROM checklist_checks WHERE country = ? AND item_id = ?', country, itemId);
  }
}

// ---------- Family contacts ----------

export type Contact = {
  id: string;
  name: string;
  relation: string | null;
  phone: string | null;
  address: string | null;
  lat: number | null;
  lon: number | null;
  note: string | null;
};

const CONTACT_COLUMNS = 'id, name, relation, phone, address, lat, lon, note';

export async function listContacts(db: SQLiteDatabase): Promise<Contact[]> {
  return db.getAllAsync<Contact>(`SELECT ${CONTACT_COLUMNS} FROM contacts WHERE deleted_at IS NULL ORDER BY created_at`);
}

export async function getContact(db: SQLiteDatabase, id: string): Promise<Contact | null> {
  return db.getFirstAsync<Contact>(`SELECT ${CONTACT_COLUMNS} FROM contacts WHERE id = ? AND deleted_at IS NULL`, id);
}

export async function saveContact(db: SQLiteDatabase, c: Omit<Contact, 'id'> & { id?: string }): Promise<string> {
  const id = c.id ?? randomUUID();
  const ts = now();
  await db.runAsync(
    `INSERT INTO contacts (id, name, relation, phone, address, lat, lon, note, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET name = excluded.name, relation = excluded.relation, phone = excluded.phone,
       address = excluded.address, lat = excluded.lat, lon = excluded.lon, note = excluded.note, updated_at = excluded.updated_at`,
    id,
    c.name,
    c.relation,
    c.phone,
    c.address,
    c.lat,
    c.lon,
    c.note,
    ts,
    ts
  );
  return id;
}

export async function deleteContact(db: SQLiteDatabase, id: string): Promise<void> {
  const ts = now();
  await db.runAsync('UPDATE contacts SET deleted_at = ?, updated_at = ? WHERE id = ?', ts, ts, id);
}

// ---------- Offline map areas ----------

export type MapArea = {
  id: string;
  name: string;
  west: number;
  south: number;
  east: number;
  north: number;
  areaKm2: number;
  sizeBytes: number;
  fileUri: string;
};

const AREA_COLUMNS = 'id, name, west, south, east, north, area_km2 AS areaKm2, size_bytes AS sizeBytes, file_uri AS fileUri';

export async function listMapAreas(db: SQLiteDatabase): Promise<MapArea[]> {
  return db.getAllAsync<MapArea>(`SELECT ${AREA_COLUMNS} FROM map_areas ORDER BY created_at`);
}

export async function saveMapArea(db: SQLiteDatabase, a: MapArea): Promise<void> {
  await db.runAsync(
    `INSERT OR REPLACE INTO map_areas (id, name, west, south, east, north, area_km2, size_bytes, file_uri, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    a.id,
    a.name,
    a.west,
    a.south,
    a.east,
    a.north,
    a.areaKm2,
    a.sizeBytes,
    a.fileUri,
    now()
  );
}

export async function deleteMapArea(db: SQLiteDatabase, id: string): Promise<void> {
  await db.runAsync('DELETE FROM map_areas WHERE id = ?', id);
}

// Monthly map download counter (the server will enforce it too once accounts exist, M3/M4).
const monthKey = (d: Date) => `mapDownloads:${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

export async function getMapDownloadsThisMonth(db: SQLiteDatabase, today = new Date()): Promise<number> {
  return Number((await getSetting(db, monthKey(today))) ?? 0);
}

export async function countMapDownload(db: SQLiteDatabase, today = new Date()): Promise<void> {
  await setSetting(db, monthKey(today), String((await getMapDownloadsThisMonth(db, today)) + 1));
}
