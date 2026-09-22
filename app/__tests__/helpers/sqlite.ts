// Test adapter: wraps Node's built-in `node:sqlite` DatabaseSync into the async subset of
// expo-sqlite's SQLiteDatabase API that lib/ uses. Real SQL, in memory, no native module.
import type { SQLiteDatabase } from 'expo-sqlite';

type Param = string | number | null | bigint | Uint8Array;

// Minimal typing of node:sqlite (the app has no @types/node).
type Statement = {
  run(...p: Param[]): { changes: number | bigint; lastInsertRowid: number | bigint };
  all(...p: Param[]): unknown[];
  get(...p: Param[]): unknown;
};
type DatabaseSyncT = { exec(sql: string): void; prepare(sql: string): Statement; close(): void };

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { DatabaseSync } = require('node:sqlite') as { DatabaseSync: new (path: string) => DatabaseSyncT };

// expo-sqlite accepts variadic params or a single array.
function flatten(params: unknown[]): Param[] {
  const list = params.length === 1 && Array.isArray(params[0]) ? (params[0] as unknown[]) : params;
  return list.map((p) => {
    if (p === undefined) throw new Error('undefined SQL param (expo-sqlite would reject it too)');
    if (typeof p === 'boolean') return p ? 1 : 0;
    return p as Param;
  });
}

export function createTestDb(): SQLiteDatabase & { close(): void } {
  const raw = new DatabaseSync(':memory:');
  const db = {
    async execAsync(sql: string) {
      raw.exec(sql);
    },
    async runAsync(sql: string, ...params: unknown[]) {
      const r = raw.prepare(sql).run(...flatten(params));
      return { lastInsertRowId: Number(r.lastInsertRowid), changes: Number(r.changes) };
    },
    async getAllAsync<T>(sql: string, ...params: unknown[]) {
      return raw.prepare(sql).all(...flatten(params)) as T[];
    },
    async getFirstAsync<T>(sql: string, ...params: unknown[]) {
      return ((raw.prepare(sql).get(...flatten(params)) as T | undefined) ?? null) as T | null;
    },
    async withTransactionAsync(task: () => Promise<void>) {
      raw.exec('BEGIN');
      try {
        await task();
        raw.exec('COMMIT');
      } catch (e) {
        raw.exec('ROLLBACK');
        throw e;
      }
    },
    close() {
      raw.close();
    },
  };
  return db as unknown as SQLiteDatabase & { close(): void };
}
