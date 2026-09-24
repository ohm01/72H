import { fireEvent, render, screen } from '@testing-library/react-native';

import { createTestDb } from './helpers/sqlite';

import ShareScreen from '@/app/share';
import i18n from '@/i18n';
import { migrate } from '@/lib/db';
import { getFamilyKey, getPendingInvite, parseInvite, savePendingInvite } from '@/lib/account';
import { toBase64Url } from '@/lib/crypto';

const mockStore = new Map<string, string>();
jest.mock('expo-secure-store', () => ({
  getItemAsync: async (k: string) => mockStore.get(k) ?? null,
  setItemAsync: async (k: string, v: string) => void mockStore.set(k, v),
  deleteItemAsync: async (k: string) => void mockStore.delete(k),
}));
jest.mock('expo-crypto', () => ({
  getRandomBytes: (n: number) => new Uint8Array(require('crypto').randomBytes(n)),
  randomUUID: () => require('crypto').randomUUID(),
}));
const mockDb = createTestDb();
jest.mock('expo-sqlite', () => ({ useSQLiteContext: () => mockDb }));
jest.mock('@/lib/sync', () => ({ syncNow: jest.fn(async () => null) }));
jest.mock('@/lib/deviceId', () => ({ deviceId: () => '00000000-0000-4000-8000-000000000001' }));
jest.mock('react-native-qrcode-svg', () => {
  const { Text } = require('react-native');
  return ({ value }: { value: string }) => <Text testID="qr">{value}</Text>;
});
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn() },
  useFocusEffect: (cb: () => void) => require('react').useEffect(cb, [cb]),
}));

const FAMILY_ID = '11111111-2222-4333-8444-555555555555';
const SESSION = { token: 'tok', userId: 'u1', email: 'mama@example.cz' };
const familyJson = (members = [{ userId: 'u1', email: 'mama@example.cz', role: 'admin', status: 'active' }]) => ({
  id: FAMILY_ID,
  myRole: 'admin',
  myStatus: 'active',
  members,
});

type Route = { status: number; body?: unknown };
let routes: Record<string, Route | ((body: unknown) => Route)>;
let calls: { key: string; body: unknown; auth: string | undefined }[];

beforeAll(async () => {
  await i18n.changeLanguage('cs');
  await migrate(mockDb);
});

beforeEach(() => {
  mockStore.clear();
  calls = [];
  routes = {};
  globalThis.fetch = jest.fn(async (url: string, init: RequestInit) => {
    const key = `${init.method} ${new URL(url).pathname}`;
    const body = init.body ? JSON.parse(String(init.body)) : undefined;
    const headers = init.headers as Record<string, string>;
    calls.push({ key, body, auth: headers.Authorization });
    const r = routes[key];
    const res = typeof r === 'function' ? r(body) : (r ?? { status: 404, body: { detail: { code: 'no_family' } } });
    return { ok: res.status < 300, status: res.status, json: async () => res.body ?? null } as Response;
  }) as jest.Mock;
});

it('signs in with an emailed code and creates a family', async () => {
  routes['POST /v1/auth/email/start'] = { status: 204 };
  routes['POST /v1/auth/email/verify'] = { status: 200, body: SESSION };
  await render(<ShareScreen />);

  await fireEvent.changeText(await screen.findByPlaceholderText('jmeno@example.cz'), ' mama@example.cz ');
  await fireEvent.press(screen.getByText('Poslat kód'));
  expect(await screen.findByText('Kód jsme poslali na mama@example.cz. Platí 10 minut.')).toBeTruthy();
  expect(calls[0]).toMatchObject({ key: 'POST /v1/auth/email/start', body: { email: 'mama@example.cz', lang: 'cs' } });

  await fireEvent.changeText(screen.getByDisplayValue(''), '123456');
  await fireEvent.press(screen.getByText('Přihlásit'));
  expect(await screen.findByText('Založit rodinu')).toBeTruthy();
  expect(JSON.parse(mockStore.get('session')!)).toEqual(SESSION);

  routes['POST /v1/families'] = { status: 200, body: familyJson() };
  routes['GET /v1/family'] = { status: 200, body: familyJson() };
  await fireEvent.press(screen.getByText('Založit rodinu'));
  expect(await screen.findByText('Pozvat člena')).toBeTruthy();
  expect(screen.getByText('správce')).toBeTruthy();
  expect(calls.find((c) => c.key === 'POST /v1/families')?.auth).toBe('Bearer tok');
  expect((await getFamilyKey())?.length).toBe(32);
});

it('shows a clear message for a wrong code', async () => {
  routes['POST /v1/auth/email/start'] = { status: 204 };
  routes['POST /v1/auth/email/verify'] = { status: 400, body: { detail: { code: 'wrong_code' } } };
  await render(<ShareScreen />);
  await fireEvent.changeText(await screen.findByPlaceholderText('jmeno@example.cz'), 'a@b.cz');
  await fireEvent.press(screen.getByText('Poslat kód'));
  await fireEvent.changeText(await screen.findByDisplayValue(''), '000000');
  await fireEvent.press(screen.getByText('Přihlásit'));
  expect(await screen.findByText('Kód nesedí. Zkuste to znovu.')).toBeTruthy();
});

it('admin creates an invite link with the family key in the fragment and approves a new member', async () => {
  mockStore.set('session', JSON.stringify(SESSION));
  const key = new Uint8Array(32).fill(5);
  mockStore.set('familyKey', toBase64Url(key));
  routes['GET /v1/family'] = {
    status: 200,
    body: familyJson([
      { userId: 'u1', email: 'mama@example.cz', role: 'admin', status: 'active' },
      { userId: 'u2', email: 'dite@example.cz', role: 'member', status: 'pending' },
    ]),
  };
  routes['POST /v1/family/invites'] = { status: 200, body: { familyId: FAMILY_ID, token: 'invtok', expiresAt: 'x' } };
  routes['POST /v1/family/members/u2/approve'] = { status: 204 };
  await render(<ShareScreen />);

  await fireEvent.press(await screen.findByText('Vytvořit pozvánku'));
  const link = (await screen.findByTestId('qr')).props.children as string;
  expect(link.endsWith(`/join#${FAMILY_ID}.invtok.${toBase64Url(key)}`)).toBe(true);
  expect(parseInvite(link)).toEqual({ familyId: FAMILY_ID, token: 'invtok', key: toBase64Url(key) });
  // The key is only in the fragment: the server request carried no key.
  expect(JSON.stringify(calls)).not.toContain(toBase64Url(key));

  expect(screen.getByText('čeká na schválení')).toBeTruthy();
  await fireEvent.press(screen.getByText('Schválit'));
  expect(calls.some((c) => c.key === 'POST /v1/family/members/u2/approve')).toBe(true);
});

it('an invite opened before signing in is used right after login', async () => {
  const key = new Uint8Array(32).fill(9);
  await savePendingInvite({ familyId: FAMILY_ID, token: 'invtok', key: toBase64Url(key) });
  routes['POST /v1/auth/email/start'] = { status: 204 };
  routes['POST /v1/auth/email/verify'] = { status: 200, body: { ...SESSION, email: 'dite@example.cz', userId: 'u2' } };
  routes['POST /v1/families/join'] = {
    status: 200,
    body: { ...familyJson(), myRole: 'member', myStatus: 'pending' },
  };
  await render(<ShareScreen />);
  expect(await screen.findByText('Máte pozvánku do rodiny. Přihlaste se a připojíte se.')).toBeTruthy();

  await fireEvent.changeText(screen.getByPlaceholderText('jmeno@example.cz'), 'dite@example.cz');
  await fireEvent.press(screen.getByText('Poslat kód'));
  await fireEvent.changeText(await screen.findByDisplayValue(''), '123456');
  await fireEvent.press(screen.getByText('Přihlásit'));

  expect(await screen.findByText('Čekáte, až vás správce rodiny schválí.')).toBeTruthy();
  expect(calls.find((c) => c.key === 'POST /v1/families/join')?.body).toEqual({ familyId: FAMILY_ID, token: 'invtok' });
  expect(Array.from((await getFamilyKey())!)).toEqual(Array.from(key));
  expect(await getPendingInvite()).toBeNull();
});

describe('parseInvite', () => {
  const key = toBase64Url(new Uint8Array(32).fill(1));
  it('accepts https links, deep links and bare fragments', () => {
    const expected = { familyId: FAMILY_ID, token: 't', key };
    expect(parseInvite(`https://api.jennase.org/join#${FAMILY_ID}.t.${key}`)).toEqual(expected);
    expect(parseInvite(`app72h://join#${FAMILY_ID}.t.${key}`)).toEqual(expected);
    expect(parseInvite(`${FAMILY_ID}.t.${key}`)).toEqual(expected);
  });
  it('rejects broken invites', () => {
    expect(parseInvite('https://api.jennase.org/join')).toBeNull();
    expect(parseInvite(`app72h://join#not-a-uuid.t.${key}`)).toBeNull();
    expect(parseInvite(`app72h://join#${FAMILY_ID}.t.short`)).toBeNull();
  });
});
