// Family sync: rows are encrypted with the family key and exchanged through the server. Last write (updated_at) wins.
import type { SQLiteDatabase } from 'expo-sqlite';

import { getFamilyId, getFamilyKey, getSession } from './account';
import { ApiError, apiRequest } from './api';
import { open, seal } from './crypto';
import { getSetting, setSetting } from './repo';

// Parents before children (items reference locations). photo_uri stays on the phone: the path only exists here.
const TABLES: Record<string, string[]> = {
  locations: ['id', 'name', 'lat', 'lon', 'created_at', 'updated_at', 'deleted_at'],
  items: ['id', 'location_id', 'name', 'type', 'quantity', 'unit', 'expires_on', 'note', 'created_at', 'updated_at', 'deleted_at'],
  meeting_points: ['id', 'name', 'note', 'address', 'lat', 'lon', 'created_at', 'updated_at', 'deleted_at'],
  contacts: ['id', 'name', 'relation', 'phone', 'address', 'lat', 'lon', 'note', 'created_at', 'updated_at', 'deleted_at'],
};
const ORDER = Object.keys(TABLES);
const BATCH = 500;

type Row = Record<string, string | number | null>;
type ServerRecord = { id: string; type: string; updatedAt: number; deleted: boolean; nonce: string; ciphertext: string };

export type SyncResult = { pushed: number; pulled: number } | null;

let running: Promise<SyncResult> | null = null;

/** Syncs if signed in and in a family; returns null otherwise. Concurrent calls share one run. */
export function syncNow(db: SQLiteDatabase): Promise<SyncResult> {
  running ??= runSync(db).finally(() => {
    running = null;
  });
  return running;
}

async function runSync(db: SQLiteDatabase): Promise<SyncResult> {
  const [session, key, familyId] = await Promise.all([getSession(), getFamilyKey(), getFamilyId()]);
  if (!session || !key || !familyId) return null;

  // New family (or joined again): start over and send everything we have.
  if ((await getSetting(db, 'syncFamily')) !== familyId) {
    await setSetting(db, 'syncFamily', familyId);
    await setSetting(db, 'syncPushedAt', '');
    await setSetting(db, 'syncCursor', '0');
  }
  const startedAt = new Date().toISOString();

  try {
    const pushed = await push(db, session.token, key, (await getSetting(db, 'syncPushedAt')) ?? '');
    const pulled = await pull(db, session.token, key);
    await setSetting(db, 'syncPushedAt', startedAt);
    await setSetting(db, 'lastSyncAt', startedAt);
    return { pushed, pulled };
  } catch (e) {
    // Waiting for approval: nothing to do yet.
    if (e instanceof ApiError && e.status === 403) return null;
    throw e;
  }
}

async function push(db: SQLiteDatabase, token: string, key: Uint8Array, since: string): Promise<number> {
  const records: ServerRecord[] = [];
  for (const table of ORDER) {
    const cols = TABLES[table];
    const rows = await db.getAllAsync<Row>(`SELECT ${cols.join(', ')} FROM ${table} WHERE updated_at > ?`, since);
    for (const row of rows) {
      records.push({
        id: String(row.id),
        type: table,
        updatedAt: Date.parse(String(row.updated_at)),
        deleted: row.deleted_at != null,
        ...seal(key, row),
      });
    }
  }
  for (let i = 0; i < records.length; i += BATCH) {
    await apiRequest('POST', '/v1/sync/push', { token, body: { records: records.slice(i, i + BATCH) } });
  }
  return records.length;
}

async function pull(db: SQLiteDatabase, token: string, key: Uint8Array): Promise<number> {
  let cursor = Number((await getSetting(db, 'syncCursor')) ?? '0');
  let applied = 0;
  for (;;) {
    const page = await apiRequest<{ records: ServerRecord[]; cursor: number; more: boolean }>('GET', `/v1/sync/pull?since=${cursor}`, {
      token,
    });
    const decoded: { table: string; row: Row }[] = [];
    for (const r of page.records) {
      if (!TABLES[r.type]) continue;
      try {
        decoded.push({ table: r.type, row: open<Row>(key, r) });
      } catch {
        // Encrypted with another key (e.g. before a key change): skip.
      }
    }
    decoded.sort((a, b) => ORDER.indexOf(a.table) - ORDER.indexOf(b.table));
    await db.withTransactionAsync(async () => {
      for (const { table, row } of decoded) applied += (await apply(db, table, row)) ? 1 : 0;
    });
    cursor = page.cursor;
    await setSetting(db, 'syncCursor', String(cursor));
    if (!page.more) return applied;
  }
}

/** Writes a remote row unless the local copy is the same age or newer. */
async function apply(db: SQLiteDatabase, table: string, row: Row): Promise<boolean> {
  const local = await db.getFirstAsync<{ updated_at: string }>(`SELECT updated_at FROM ${table} WHERE id = ?`, row.id);
  if (local && local.updated_at >= String(row.updated_at)) return false;
  const cols = TABLES[table];
  const update = cols.filter((c) => c !== 'id').map((c) => `${c} = excluded.${c}`);
  await db.runAsync(
    `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})
     ON CONFLICT(id) DO UPDATE SET ${update.join(', ')}`,
    ...cols.map((c) => row[c] ?? null)
  );
  return true;
}
