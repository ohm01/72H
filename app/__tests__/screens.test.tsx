// Screen smoke tests: real screens + real SQLite (node:sqlite adapter), Czech i18n.
// Only the native/navigation boundary is mocked.
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Alert } from 'react-native';

import { createTestDb } from './helpers/sqlite';

import ChecklistScreen from '@/app/checklist';
import ItemScreen from '@/app/item/[id]';
import LocationsScreen from '@/app/locations';
import Onboarding from '@/app/onboarding';
import StockScreen from '@/app/(tabs)/index';
import i18n from '@/i18n';
import { migrate } from '@/lib/db';
import { syncReminders } from '@/lib/notifications';
import {
  getChecks,
  getHousehold,
  isOnboarded,
  listItems,
  listLocations,
  listMeetingPoints,
  saveItem,
  saveLocation,
  setHousehold,
} from '@/lib/repo';

// First render lazily loads/transforms RN modules; slow on the Raspberry Pi.
jest.setTimeout(120_000);

let mockDb: ReturnType<typeof createTestDb>;

jest.mock('expo-sqlite', () => ({ useSQLiteContext: () => mockDb }));
jest.mock('expo-crypto', () => ({ randomUUID: () => require('crypto').randomUUID() }));
jest.mock('expo-web-browser', () => ({ openBrowserAsync: jest.fn() }));
jest.mock('@/lib/notifications', () => ({ syncReminders: jest.fn(), ensurePermission: jest.fn() }));
jest.mock('expo-router', () => {
  const React = require('react');
  return {
    router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() },
    useFocusEffect: (cb: () => void | (() => void)) => React.useEffect(cb, [cb]),
    useLocalSearchParams: jest.fn(() => ({})),
    Link: ({ children }: { children: React.ReactNode }) => children,
    Stack: { Screen: () => null },
  };
});

beforeAll(async () => {
  await i18n.changeLanguage('cs');
});

beforeEach(async () => {
  jest.clearAllMocks();
  mockDb = createTestDb();
  await migrate(mockDb);
});

afterEach(() => mockDb.close());

const item = (locationId: string, type: 'water' | 'food', quantity: number, expiresOn: string | null) => ({
  locationId,
  name: type === 'water' ? 'Balená voda' : 'Konzervy',
  type,
  quantity,
  unit: type === 'water' ? ('l' as const) : ('ration' as const),
  expiresOn,
  note: null,
});

describe('StockScreen', () => {
  it('shows empty state for a fresh household', async () => {
    await saveLocation(mockDb, { name: 'Doma', lat: null, lon: null });
    await render(<StockScreen />);
    expect(await screen.findByText('Na kolik dní jsme zásobeni')).toBeTruthy();
    expect(screen.getByText(/^Zatím tu nic není/)).toBeTruthy();
    expect(screen.getByText('0 dní · cíl 3 dny')).toBeTruthy();
  });

  it('shows readiness in days, per location and the item list', async () => {
    await setHousehold(mockDb, { persons: 2, pets: 0 });
    const home = await saveLocation(mockDb, { name: 'Doma', lat: null, lon: null });
    const cottage = await saveLocation(mockDb, { name: 'Chata', lat: null, lon: null });
    await saveItem(mockDb, item(home, 'water', 12, '2099-01-01'));
    await saveItem(mockDb, item(home, 'food', 6, '2099-01-01'));
    await saveItem(mockDb, item(cottage, 'water', 4, null));
    await saveItem(mockDb, item(cottage, 'food', 3, '2020-01-01')); // expired: does not count

    await render(<StockScreen />);

    // Total: water 16 l / (2 × 2) = 4 days, food 6 / 2 = 3 days -> 3 days.
    expect(await screen.findByText('3 dny · cíl 3 dny')).toBeTruthy();
    expect(screen.getByText('Počítáno pro 2 os. Voda: 4 dny, jídlo: 3 dny.')).toBeTruthy();
    expect(screen.getByText('Podle lokality')).toBeTruthy();
    // Per location: home 3 days, cottage 0 (no usable food).
    expect(screen.getAllByText('Chata').length).toBeGreaterThan(0);
    expect(screen.getByText('0 dní')).toBeTruthy();
    // Items list with quantities, type · location, expiry text.
    expect(screen.getByText('12 l')).toBeTruthy();
    expect(screen.getByText('6 denní dávky')).toBeTruthy();
    expect(screen.getByText('Jídlo · Chata')).toBeTruthy();
    expect(screen.getByText('prošlé')).toBeTruthy();
    expect(screen.getByText('bez expirace')).toBeTruthy();
    // Goal hint is shown only below the recommended 3 days; here we are at 3.
    expect(screen.queryByText(/aspoň na 72 hodin/)).toBeNull();

    // Filter chip: only cottage items.
    await fireEvent.press(screen.getAllByText('Chata')[1]);
    expect(screen.queryByText('12 l')).toBeNull();
    expect(screen.getByText('4 l')).toBeTruthy();

    await fireEvent.press(screen.getByText('Přidat položku'));
    expect(router.push).toHaveBeenCalledWith('/item/new');
  });
});

describe('ChecklistScreen', () => {
  it('scales amounts to the household and persists checks', async () => {
    await setHousehold(mockDb, { persons: 4, pets: 1 });
    await render(<ChecklistScreen />);

    expect(await screen.findByText('Doporučení pro domácnost (osoby: 4, zvířata: 1) na 3 dny.')).toBeTruthy();
    expect(screen.getByText('24 l')).toBeTruthy(); // 2 l × 4 persons × 3 days
    expect(screen.getByText('12 denní dávky')).toBeTruthy(); // food rations
    expect(screen.getByText('28 dní')).toBeTruthy(); // medicines: 7 days × 4

    const boxes = screen.getAllByRole('checkbox');
    expect(boxes.length).toBeGreaterThan(5);
    await fireEvent.press(boxes[0]);
    await waitFor(async () => expect((await getChecks(mockDb, 'CZ')).size).toBe(1));
    await waitFor(() => expect(screen.getAllByRole('checkbox', { checked: true })).toHaveLength(1));
  });
});

describe('Onboarding', () => {
  it('walks through the steps and stores household, location and meeting point', async () => {
    await render(<Onboarding />);
    expect(screen.getByText('Vítejte v 72h')).toBeTruthy();
    expect(screen.getByText('1 / 4')).toBeTruthy();

    await fireEvent.press(screen.getByText('Další'));
    expect(screen.getByText('Kolik vás je?')).toBeTruthy();
    await fireEvent.press(screen.getAllByText('+')[0]); // persons 2 -> 3
    await fireEvent.press(screen.getAllByText('+')[1]); // pets 0 -> 1
    await fireEvent.press(screen.getByText('Další'));

    expect(screen.getByText('Kde máte zásoby?')).toBeTruthy();
    expect(screen.getByDisplayValue('Doma')).toBeTruthy();
    await fireEvent.press(screen.getByText('Přidat další místo')); // dev builds are Plus
    await fireEvent.changeText(screen.getAllByPlaceholderText(/./)[1], 'Chata');
    await fireEvent.press(screen.getByText('Další'));

    expect(screen.getByText('Kde se sejdete?')).toBeTruthy();
    await fireEvent.changeText(screen.getByPlaceholderText('např. U školy'), 'U školy');
    await fireEvent.press(screen.getByText('Začít'));

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/'));
    expect(await isOnboarded(mockDb)).toBe(true);
    expect(await getHousehold(mockDb)).toEqual({ persons: 3, pets: 1 });
    expect((await listLocations(mockDb)).map((l) => l.name).sort()).toEqual(['Chata', 'Doma']);
    expect((await listMeetingPoints(mockDb)).map((m) => m.name)).toEqual(['U školy']);
  });

  it('can skip the meeting point', async () => {
    await render(<Onboarding />);
    for (let i = 0; i < 3; i++) await fireEvent.press(screen.getByText('Další'));
    await fireEvent.press(screen.getByText('Přeskočit'));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/'));
    expect(await listMeetingPoints(mockDb)).toEqual([]);
    expect(await listLocations(mockDb)).toHaveLength(1);
  });
});

describe('ItemScreen (new)', () => {
  it('validates and saves an item into the first location', async () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({ id: 'new' });
    const home = await saveLocation(mockDb, { name: 'Doma', lat: null, lon: null });
    await render(<ItemScreen />);
    await screen.findByText('Doma');

    await fireEvent.press(screen.getByText('Uložit'));
    expect(screen.getByText('Vyplňte název.')).toBeTruthy();

    await fireEvent.changeText(screen.getByPlaceholderText('např. Balená voda 1,5 l'), 'Voda');
    await fireEvent.press(screen.getByText('Uložit'));
    expect(screen.getByText('Zadejte množství větší než 0.')).toBeTruthy();

    await fireEvent.changeText(screen.getAllByDisplayValue('')[0], '1,5'); // Czech decimal comma
    await fireEvent.press(screen.getByText('Uložit'));
    await waitFor(() => expect(router.back).toHaveBeenCalled());

    expect(await listItems(mockDb)).toEqual([
      expect.objectContaining({ name: 'Voda', type: 'water', quantity: 1.5, unit: 'l', locationId: home }),
    ]);
  });
});

describe('LocationsScreen', () => {
  it('deleting a location removes its items and re-syncs expiry reminders', async () => {
    const home = await saveLocation(mockDb, { name: 'Doma', lat: null, lon: null });
    const cottage = await saveLocation(mockDb, { name: 'Chata', lat: null, lon: null });
    await saveItem(mockDb, item(home, 'water', 6, '2099-01-01'));
    await saveItem(mockDb, item(cottage, 'water', 4, '2099-01-01'));
    // Confirm the destructive button of the native dialog.
    jest.spyOn(Alert, 'alert').mockImplementation((_title, _msg, buttons) => {
      buttons?.find((b) => b.style === 'destructive')?.onPress?.();
    });

    await render(<LocationsScreen />);
    await screen.findByDisplayValue('Chata');
    await fireEvent.press(screen.getAllByText('Smazat')[1]);

    await waitFor(async () => expect(await listLocations(mockDb)).toHaveLength(1));
    const remaining = await listItems(mockDb);
    expect(remaining.map((i) => i.locationId)).toEqual([home]);
    // Reminders for the cottage items must be cancelled, not left scheduled until the next app start.
    await waitFor(() => expect(syncReminders).toHaveBeenLastCalledWith(remaining, expect.any(Boolean)));
  });
});
