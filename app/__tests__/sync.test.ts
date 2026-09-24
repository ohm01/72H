// Two phones in one family sync through a fake server (same rules as server/app/sync.py), with real SQLite.
import { createTestDb } from './helpers/sqlite';

import { migrate } from '@/lib/db';
import { deleteContact, listContacts, listItems, listLocations, saveContact, saveItem, saveLocation } from '@/lib/repo';
import { syncNow } from '@/lib/sync';

jest.mock('expo-crypto', () => ({
  randomUUID: () => require('crypto').randomUUID(),
  getRandomBytes: (n: number) => new Uint8Array(require('crypto').randomBytes(n)),
}));
jest.mock('@/lib/deviceId', () => ({ deviceId: () => '00000000-0000-4000-8000-000000000001' }));
const mockKey = new Uint8Array(32).fill(3);
jest.mock('@/lib/account', () => ({
  getSession: async () => ({ token: 'tok', userId: 'u1', email: 'a@b.cz' }),
  getFamilyKey: async () => mockKey,
  getFamilyId: async () => '11111111-2222-4333-8444-555555555555',
}));

type Stored = { id: string; type: string; updatedAt: number; deleted: boolean; nonce: string; ciphertext: string; seq: number };
let server: Map<string, Stored>;
let seq: number;

function fakeServer() {
  globalThis.fetch = jest.fn(async (url: string, init: RequestInit) => {
    const u = new URL(url);
    let body: unknown = null;
    if (init.method === 'POST' && u.pathname === '/v1/sync/push') {
      const { records } = JSON.parse(String(init.body)) as { records: Omit<Stored, 'seq'>[] };
      let applied = 0;
      for (const r of records) {
        const old = server.get(r.id);
        if (old && old.updatedAt >= r.updatedAt) continue;
        server.set(r.id, { ...r, seq: ++seq });
        applied++;
      }
      body = { applied };
    } else if (init.method === 'GET' && u.pathname === '/v1/sync/pull') {
      const since = Number(u.searchParams.get('since'));
      const records = [...server.values()].filter((r) => r.seq > since).sort((a, b) => a.seq - b.seq);
      body = { records, cursor: records.length ? records[records.length - 1].seq : since, more: false };
    }
    return { ok: true, status: 200, json: async () => body } as Response;
  }) as jest.Mock;
}

let phoneA: ReturnType<typeof createTestDb>;
let phoneB: ReturnType<typeof createTestDb>;
let clock: number;
const tick = () => jest.setSystemTime((clock += 1000));

beforeEach(async () => {
  // Only Date is faked: edits get distinct, increasing timestamps.
  jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate', 'setTimeout', 'setInterval', 'queueMicrotask', 'clearTimeout', 'clearInterval', 'clearImmediate'] });
  clock = Date.parse('2026-09-24T10:00:00Z');
  jest.setSystemTime(clock);
  server = new Map();
  seq = 0;
  fakeServer();
  phoneA = createTestDb();
  phoneB = createTestDb();
  await migrate(phoneA);
  await migrate(phoneB);
});

afterEach(() => {
  phoneA.close();
  phoneB.close();
  jest.useRealTimers();
});

const grandma = { name: 'Babička', relation: 'babička', phone: '+420 777 123 456', address: null, lat: null, lon: null, note: null };

it("the second phone sees the first phone's contacts, stock and locations", async () => {
  const home = await saveLocation(phoneA, { name: 'Doma', lat: null, lon: null });
  await saveItem(phoneA, { locationId: home, name: 'Voda', type: 'water', quantity: 6, unit: 'l', expiresOn: '2027-09-01', note: null });
  await saveContact(phoneA, grandma);

  expect(await syncNow(phoneA)).toEqual({ pushed: 3, pulled: 0 });
  expect(await syncNow(phoneB)).toEqual({ pushed: 0, pulled: 3 });

  expect((await listContacts(phoneB)).map((c) => c.name)).toEqual(['Babička']);
  expect((await listLocations(phoneB)).map((l) => l.name)).toEqual(['Doma']);
  expect((await listItems(phoneB)).map((i) => [i.name, i.quantity])).toEqual([['Voda', 6]]);
});

it('the server only ever sees ciphertext', async () => {
  await saveContact(phoneA, grandma);
  await syncNow(phoneA);
  const stored = JSON.stringify([...server.values()]);
  expect(stored).not.toContain('Babi');
  expect(stored).not.toContain('777');
});

it('last write wins and deletions reach the other phone', async () => {
  const id = await saveContact(phoneA, grandma);
  await syncNow(phoneA);
  await syncNow(phoneB);

  tick();
  await saveContact(phoneB, { ...grandma, id, phone: '+420 600 000 000' });
  await syncNow(phoneB);
  await syncNow(phoneA);
  expect((await listContacts(phoneA))[0].phone).toBe('+420 600 000 000');

  tick();
  await deleteContact(phoneA, id);
  await syncNow(phoneA);
  await syncNow(phoneB);
  expect(await listContacts(phoneB)).toEqual([]);
});

it('an older remote change does not overwrite a newer local one', async () => {
  const id = await saveContact(phoneA, grandma);
  await syncNow(phoneA);
  await syncNow(phoneB);

  tick();
  await saveContact(phoneA, { ...grandma, id, note: 'older' });
  tick();
  await saveContact(phoneB, { ...grandma, id, note: 'newer' });
  await syncNow(phoneA);
  await syncNow(phoneB);
  await syncNow(phoneA);
  expect((await listContacts(phoneA))[0].note).toBe('newer');
  expect((await listContacts(phoneB))[0].note).toBe('newer');
});

it('does nothing more when nothing changed', async () => {
  await saveContact(phoneA, grandma);
  await syncNow(phoneA);
  expect(await syncNow(phoneA)).toEqual({ pushed: 0, pulled: 0 });
});
