import type { SQLiteDatabase } from 'expo-sqlite';

export const DB_NAME = '72h.db';

// Append-only list; index + 1 = schema version (PRAGMA user_version).
// Rows use UUID text ids + updated_at/deleted_at so M3 sync (last write wins) needs no rewrite.
const MIGRATIONS: string[] = [
  `
  CREATE TABLE settings (
    key TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL
  );
  CREATE TABLE locations (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    lat REAL,
    lon REAL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT
  );
  CREATE TABLE items (
    id TEXT PRIMARY KEY NOT NULL,
    location_id TEXT NOT NULL REFERENCES locations(id),
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    quantity REAL NOT NULL,
    unit TEXT NOT NULL,
    expires_on TEXT,
    note TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT
  );
  CREATE INDEX items_location ON items(location_id);
  CREATE TABLE meeting_points (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    note TEXT,
    address TEXT,
    lat REAL,
    lon REAL,
    photo_uri TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT
  );
  CREATE TABLE checklist_checks (
    country TEXT NOT NULL,
    item_id TEXT NOT NULL,
    checked_at TEXT NOT NULL,
    PRIMARY KEY (country, item_id)
  );
  `,
];

export async function migrate(db: SQLiteDatabase): Promise<void> {
  await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  let version = row?.user_version ?? 0;
  while (version < MIGRATIONS.length) {
    await db.withTransactionAsync(async () => {
      await db.execAsync(MIGRATIONS[version]);
    });
    version += 1;
    await db.execAsync(`PRAGMA user_version = ${version}`);
  }
}
