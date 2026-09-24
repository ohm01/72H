// M2 screen tests: real screens + real SQLite; GPS, compass, MapLibre and file downloads are mocked.
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Linking } from 'react-native';

import { createTestDb } from './helpers/sqlite';

import { emergencyFor } from '@/lib/emergency';
import FamilyScreen from '@/app/(tabs)/family';
import MapScreen from '@/app/(tabs)/map';
import MoreScreen from '@/app/(tabs)/more';
import ContactScreen from '@/app/contact/[id]';
import GuideScreen from '@/app/guide/[id]';
import KidsScreen from '@/app/kids/[id]';
import MapAreasScreen from '@/app/map-areas';
import MeetingPointScreen from '@/app/meeting-point/[id]';
import NavigateScreen from '@/app/navigate/[id]';
import i18n from '@/i18n';
import { migrate } from '@/lib/db';
import { downloadArea } from '@/lib/mapDownload';
import { getMapDownloadsThisMonth, listContacts, listMapAreas, listMeetingPoints, saveContact, saveMeetingPoint, setSetting } from '@/lib/repo';

jest.setTimeout(120_000);

let mockDb: ReturnType<typeof createTestDb>;
// Old Town Square, Prague; the meeting point is ~1 km north of it.
const HERE = { latitude: 50.0875, longitude: 14.4213 };
const mockPosition = { coords: { ...HERE, accuracy: 8 } };
let mockHeading = 90;

jest.mock('expo-sqlite', () => ({ useSQLiteContext: () => mockDb }));
jest.mock('@/lib/notifications', () => ({ syncReminders: jest.fn(), ensurePermission: jest.fn() }));
jest.mock('expo-crypto', () => ({ randomUUID: () => require('crypto').randomUUID() }));
jest.mock('expo-location', () => ({
  Accuracy: { High: 4 },
  requestForegroundPermissionsAsync: jest.fn(async () => ({ granted: true })),
  getLastKnownPositionAsync: jest.fn(async () => mockPosition),
  getCurrentPositionAsync: jest.fn(async () => mockPosition),
  watchPositionAsync: jest.fn(async (_o: unknown, cb: (l: unknown) => void) => {
    cb(mockPosition);
    return { remove: jest.fn() };
  }),
  watchHeadingAsync: jest.fn(async (cb: (h: unknown) => void) => {
    cb({ trueHeading: mockHeading, magHeading: mockHeading, accuracy: 3 });
    return { remove: jest.fn() };
  }),
  geocodeAsync: jest.fn(async (q: string) => (q.includes('Neexistuje') ? [] : [{ latitude: 50.0443, longitude: 15.8456 }])),
  reverseGeocodeAsync: jest.fn(async () => [{ street: 'Za Střelnicí', streetNumber: '950', city: 'Sezemice', region: 'Pardubický kraj' }]),
}));
jest.mock('@maplibre/maplibre-react-native', () => {
  const { View } = require('react-native');
  return {
    Map: ({ children, mapStyle }: { children: React.ReactNode; mapStyle: unknown }) => (
      <View testID="map" mapStyle={mapStyle}>
        {children}
      </View>
    ),
    Camera: () => null,
    NativeUserLocation: () => null,
    Marker: ({ children }: { children: React.ReactNode }) => children,
  };
});
jest.mock('@/lib/mapDownload', () => ({
  assetsDir: () => ({ uri: 'file:///maps/assets' }),
  areaFile: (id: string) => ({ uri: `file:///current-install/maps/${id}.pmtiles` }),
  ensureMapAssets: jest.fn(async () => {}),
  downloadArea: jest.fn(),
  deleteAreaFile: jest.fn(),
}));
jest.mock('expo-router', () => {
  const React = require('react');
  return {
    router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() },
    useFocusEffect: (cb: () => void | (() => void)) => React.useEffect(cb, [cb]),
    useLocalSearchParams: jest.fn(() => ({})),
    Stack: { Screen: () => null },
  };
});

beforeAll(async () => {
  await i18n.changeLanguage('cs');
});

beforeEach(async () => {
  jest.clearAllMocks();
  mockHeading = 90;
  mockDb = createTestDb();
  await migrate(mockDb);
});

afterEach(() => mockDb.close());

const point = (lat: number | null, lon: number | null) =>
  saveMeetingPoint(mockDb, { name: 'U školy', note: 'u hlavního vchodu', address: null, lat, lon, photoUri: null });

describe('MapScreen', () => {
  it('without a map shows the download prompt and meeting points with distance', async () => {
    const id = await point(50.0965, 14.4213);
    await point(null, null);
    await render(<MapScreen />);

    expect(await screen.findByText('Zatím nemáte staženou mapu')).toBeTruthy();
    expect(screen.queryByTestId('map')).toBeNull();
    expect(await screen.findByText('1 km')).toBeTruthy();
    expect(screen.getByText('bez polohy')).toBeTruthy();

    await fireEvent.press(screen.getAllByText('Navigovat')[0]);
    expect(router.push).toHaveBeenCalledWith(`/navigate/${id}`);
    await fireEvent.press(screen.getByText('Stáhnout offline mapu'));
    expect(router.push).toHaveBeenCalledWith('/map-areas');
  });

  it('shows the offline map once an area is downloaded', async () => {
    await mockDb.runAsync(
      `INSERT INTO map_areas (id, name, west, south, east, north, area_km2, size_bytes, file_uri, created_at)
       VALUES ('a1', 'Praha', 14.3, 50.0, 14.5, 50.2, 300, 5000000, 'file:///maps/a1.pmtiles', '2026-09-23')`
    );
    await render(<MapScreen />);
    const map = await screen.findByTestId('map');
    expect(screen.getByText('Dlouhým podržením na mapě přidáte místo srazu.')).toBeTruthy();
    // The stored path is from an older install (iOS moves Documents on reinstall/update): the map uses the current one.
    expect(map.props.mapStyle.sources.area0.url).toBe('pmtiles://file:///current-install/maps/a1.pmtiles');
  });
});

describe('MeetingPointScreen', () => {
  it('creates a meeting point at the position picked on the map', async () => {
    jest.mocked(useLocalSearchParams).mockReturnValue({ id: 'new', lat: '50.1', lon: '14.4' });
    await render(<MeetingPointScreen />);

    await fireEvent.changeText(screen.getByPlaceholderText('např. U školy'), 'Park');
    expect(screen.getByText('50.10000, 14.40000')).toBeTruthy();
    await fireEvent.press(screen.getByText('Uložit'));

    await waitFor(() => expect(router.back).toHaveBeenCalled());
    const [mp] = await listMeetingPoints(mockDb);
    expect(mp).toMatchObject({ name: 'Park', lat: 50.1, lon: 14.4 });
  });

  it('sets the position from GPS when editing', async () => {
    const id = await point(null, null);
    jest.mocked(useLocalSearchParams).mockReturnValue({ id });
    await render(<MeetingPointScreen />);

    expect(await screen.findByText('Poloha zatím není nastavená.')).toBeTruthy();
    await fireEvent.press(screen.getByText('Použít moji polohu'));
    expect(await screen.findByText('50.08750, 14.42130')).toBeTruthy();
    await fireEvent.press(screen.getByText('Uložit'));
    await waitFor(async () => expect((await listMeetingPoints(mockDb))[0].lat).toBe(50.0875));
  });
});

describe('MeetingPointScreen address', () => {
  it('looks the address up and uses its position', async () => {
    const id = await point(null, null);
    jest.mocked(useLocalSearchParams).mockReturnValue({ id });
    await render(<MeetingPointScreen />);

    await fireEvent.changeText(await screen.findByPlaceholderText('např. Za Střelnicí 950, Sezemice'), 'Za střelnici 950 sezemice');
    expect(await screen.findByText('Nalezeno: Za Střelnicí 950, Sezemice, Pardubický kraj', {}, { timeout: 3000 })).toBeTruthy();
    expect(screen.getByText('50.04430, 15.84560')).toBeTruthy();
    await fireEvent.press(screen.getByText('Uložit'));
    await waitFor(async () => expect((await listMeetingPoints(mockDb))[0]).toMatchObject({ lat: 50.0443, lon: 15.8456 }));
  });

  it('drops the old position when the new address does not exist', async () => {
    const id = await point(50.0965, 14.4213);
    jest.mocked(useLocalSearchParams).mockReturnValue({ id });
    await render(<MeetingPointScreen />);
    expect(await screen.findByText('50.09650, 14.42130')).toBeTruthy();
    await fireEvent.changeText(screen.getByPlaceholderText('např. Za Střelnicí 950, Sezemice'), 'Neexistuje 1');
    expect(await screen.findByText(/^Adresu jsme nenašli/, {}, { timeout: 3000 })).toBeTruthy();
    expect(screen.getByText('Poloha zatím není nastavená.')).toBeTruthy();
  });

  it('says when the address does not exist', async () => {
    jest.mocked(useLocalSearchParams).mockReturnValue({ id: 'new' });
    await render(<MeetingPointScreen />);
    await fireEvent.changeText(screen.getByPlaceholderText('např. Za Střelnicí 950, Sezemice'), 'Neexistuje 1');
    expect(await screen.findByText(/^Adresu jsme nenašli/, {}, { timeout: 3000 })).toBeTruthy();
    expect(screen.getByText('Poloha zatím není nastavená.')).toBeTruthy();
  });
});

describe('NavigateScreen', () => {
  it('points the arrow relative to the compass and shows distance', async () => {
    const id = await point(50.0965, 14.4213); // due north
    jest.mocked(useLocalSearchParams).mockReturnValue({ id });
    await render(<NavigateScreen />);

    expect(await screen.findByText('1 km')).toBeTruthy();
    expect(screen.getByText('přesnost ± 8 m')).toBeTruthy();
    // Target north, phone facing east -> arrow points left (270°).
    expect(screen.getByTestId('arrow')).toHaveStyle({ transform: [{ rotate: '270deg' }] });
  });

  it('tells the user when they have arrived', async () => {
    const id = await point(50.0876, 14.4213); // ~11 m away
    jest.mocked(useLocalSearchParams).mockReturnValue({ id });
    await render(<NavigateScreen />);
    expect(await screen.findByText('Jste na místě.')).toBeTruthy();
  });
});

describe('KidsScreen', () => {
  it('shows where to go, the distance and a 112 button', async () => {
    const id = await point(50.0965, 14.4213);
    jest.mocked(useLocalSearchParams).mockReturnValue({ id });
    const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    await render(<KidsScreen />);

    expect(await screen.findByText('U školy')).toBeTruthy();
    expect(await screen.findByText('Je to 1 km daleko.')).toBeTruthy();
    await fireEvent.press(screen.getByText('Volat 112'));
    expect(openURL).toHaveBeenCalledWith('tel:112');
  });

  it("shows the parent's own help message", async () => {
    const id = await point(50.0965, 14.4213);
    await setSetting(mockDb, 'kidsHelp', 'Zavolej babičce, číslo máš v aplikaci.');
    jest.mocked(useLocalSearchParams).mockReturnValue({ id });
    await render(<KidsScreen />);
    expect(await screen.findByText('Zavolej babičce, číslo máš v aplikaci.')).toBeTruthy();
    expect(screen.queryByText(/požádej o pomoc dospělého/)).toBeNull();
  });
});

describe('MapAreasScreen', () => {
  it('downloads an area around the current position and counts the download', async () => {
    jest.mocked(downloadArea).mockImplementation(async (bbox, name, onProgress) => {
      onProgress(1);
      return { id: 'e1', name, ...bbox, areaKm2: 100, sizeBytes: 4_200_000, fileUri: 'file:///maps/e1.pmtiles' };
    });
    await render(<MapAreasScreen />);

    expect(await screen.findByText('50.0875, 14.4213')).toBeTruthy();
    // Dev builds are Plus: all sizes offered; pick 10 × 10 km.
    await fireEvent.press(screen.getByText(/^10 × 10 km/));
    await fireEvent.press(screen.getByText('Stáhnout'));

    expect(await screen.findByText('Mapa je stažená a funguje offline.')).toBeTruthy();
    const [bbox, name] = jest.mocked(downloadArea).mock.calls[0];
    expect(name).toBe('Oblast 1');
    expect(bbox.north).toBeGreaterThan(HERE.latitude);
    expect(bbox.south).toBeLessThan(HERE.latitude);
    expect(await listMapAreas(mockDb)).toHaveLength(1);
    expect(await getMapDownloadsThisMonth(mockDb)).toBe(1);
    expect(screen.getByText('Oblast 1')).toBeTruthy();
  });

  it('centres on the meeting point by default', async () => {
    await saveMeetingPoint(mockDb, { name: 'U kristy', note: null, address: 'Za Střelnicí 950, Sezemice', lat: 50.0443, lon: 15.8456, photoUri: null });
    jest.mocked(downloadArea).mockImplementation(async (bbox, name) => ({ id: 'e2', name, ...bbox, areaKm2: 100, sizeBytes: 1, fileUri: 'file:///x' }));
    await render(<MapAreasScreen />);

    expect(await screen.findByText('50.0443, 15.8456')).toBeTruthy();
    await fireEvent.press(screen.getByText('Stáhnout'));
    await screen.findByText('Mapa je stažená a funguje offline.');
    const [bbox, name] = jest.mocked(downloadArea).mock.calls[0];
    expect(name).toBe('U kristy');
    expect(bbox.west).toBeLessThan(15.8456);
    expect(bbox.east).toBeGreaterThan(15.8456);
  });

  it('explains when the server rejects an area outside the Czech Republic', async () => {
    const { ApiError } = jest.requireActual('@/lib/api');
    jest.mocked(downloadArea).mockRejectedValue(new ApiError(422, { detail: 'area outside supported region (CZ)' }));
    await render(<MapAreasScreen />);

    await fireEvent.press(screen.getByText('Obec nebo adresa'));
    await fireEvent.changeText(screen.getByPlaceholderText('např. Za Střelnicí 950, Sezemice'), 'Sezemice');
    expect(await screen.findByText('50.0443, 15.8456', {}, { timeout: 3000 })).toBeTruthy();
    await fireEvent.press(screen.getByText('Stáhnout'));
    expect(await screen.findByText('Oblast musí ležet celá v České republice.')).toBeTruthy();
    expect(await listMapAreas(mockDb)).toHaveLength(0);
  });

  it('explains when the server says the monthly download limit is used up on this device', async () => {
    const { ApiError } = jest.requireActual('@/lib/api');
    jest.mocked(downloadArea).mockRejectedValue(new ApiError(403, { detail: { code: 'download_limit', max: 2 } }));
    await render(<MapAreasScreen />);

    await fireEvent.press(screen.getByText('Obec nebo adresa'));
    await fireEvent.changeText(screen.getByPlaceholderText('např. Za Střelnicí 950, Sezemice'), 'Sezemice');
    expect(await screen.findByText('50.0443, 15.8456', {}, { timeout: 3000 })).toBeTruthy();
    await fireEvent.press(screen.getByText('Stáhnout'));
    expect(await screen.findByText(/^Tento měsíc jste stáhli maximum \(2\)/)).toBeTruthy();
  });
});

const grandma = (lat: number | null = 50.0965, lon: number | null = 14.4213) =>
  saveContact(mockDb, { name: 'Jana', relation: 'babička', phone: '+420 777 123 456', address: 'Za Střelnicí 950, Sezemice', lat, lon, note: null });

describe('Family contacts', () => {
  it('creates a contact and looks its address up', async () => {
    jest.mocked(useLocalSearchParams).mockReturnValue({ id: 'new' });
    await render(<ContactScreen />);
    expect(screen.getByText('Uložit')).toBeDisabled();

    await fireEvent.changeText(screen.getByPlaceholderText('např. Jana Nováková'), 'Jana');
    await fireEvent.changeText(screen.getByPlaceholderText('např. babička, soused'), 'babička');
    await fireEvent.changeText(screen.getByPlaceholderText('+420 …'), '+420 777 123 456');
    await fireEvent.changeText(screen.getByPlaceholderText('např. Za Střelnicí 950, Sezemice'), 'Za střelnici 950 sezemice');
    expect(await screen.findByText(/^Nalezeno:/, {}, { timeout: 3000 })).toBeTruthy();
    await fireEvent.press(screen.getByText('Uložit'));

    await waitFor(() => expect(router.back).toHaveBeenCalled());
    expect((await listContacts(mockDb))[0]).toMatchObject({ name: 'Jana', relation: 'babička', phone: '+420 777 123 456', lat: 50.0443, lon: 15.8456 });
  });

  it('lists contacts with call and navigate', async () => {
    const id = await grandma();
    const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    await render(<FamilyScreen />);

    expect(await screen.findByText('Jana')).toBeTruthy();
    expect(screen.getByText('babička · +420 777 123 456')).toBeTruthy();
    await fireEvent.press(screen.getByText('Zavolat'));
    expect(openURL).toHaveBeenCalledWith('tel:+420777123456');
    await fireEvent.press(screen.getByText('Navigovat'));
    expect(router.push).toHaveBeenCalledWith(`/navigate/${id}?kind=contact`);
  });

  it('kids screen offers to call family contacts', async () => {
    const mp = await point(50.0965, 14.4213);
    await grandma();
    jest.mocked(useLocalSearchParams).mockReturnValue({ id: mp });
    const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    await render(<KidsScreen />);

    expect(await screen.findByText('Komu zavolat:')).toBeTruthy();
    await fireEvent.press(screen.getByText('Zavolat: Jana (babička)'));
    expect(openURL).toHaveBeenCalledWith('tel:+420777123456');
  });

  it('navigates to a contact address', async () => {
    const id = await grandma();
    jest.mocked(useLocalSearchParams).mockReturnValue({ id, kind: 'contact' });
    await render(<NavigateScreen />);
    expect(await screen.findByText('Jana')).toBeTruthy();
    expect(screen.getByText('babička')).toBeTruthy();
    expect(await screen.findByText('1 km')).toBeTruthy();
    await fireEvent.press(screen.getByText('Zobrazení pro děti'));
    expect(router.push).toHaveBeenCalledWith(`/kids/${id}?kind=contact`);
  });
});

describe('Emergency numbers and kids tips', () => {
  it('Rodina shows Czech emergency numbers and helplines, tap to call', async () => {
    const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    await render(<FamilyScreen />);
    expect(await screen.findByText('Tísňová čísla')).toBeTruthy();
    expect(screen.getByText('Záchranka')).toBeTruthy();
    expect(screen.getByText('Linka bezpečí pro děti a studenty do 26 let')).toBeTruthy();
    await fireEvent.press(screen.getByText('155'));
    expect(openURL).toHaveBeenCalledWith('tel:155');
    await fireEvent.press(screen.getByText('116 111'));
    expect(openURL).toHaveBeenCalledWith('tel:116111');
  });

  it('Poland lists its national numbers', async () => {
    await setSetting(mockDb, 'homeCountry', 'PL');
    await render(<FamilyScreen />);
    expect(await screen.findByText('997')).toBeTruthy();
    expect(screen.getByText('999')).toBeTruthy();
  });

  it('Slovakia lists its national numbers without helplines', async () => {
    await setSetting(mockDb, 'homeCountry', 'SK');
    await render(<FamilyScreen />);
    expect(await screen.findByText('158')).toBeTruthy();
    expect(screen.getByText('150')).toBeTruthy();
    expect(screen.queryByText('Když potřebujete s někým mluvit')).toBeNull();
  });

  it('countries without a verified source get only 112', () => {
    const e = emergencyFor('XX');
    expect(e.numbers.map((n) => n.number)).toEqual(['112']);
    expect(e.helplines).toEqual([]);
  });

  it('Czech UI links the official 72 hours handbook and says we are not affiliated', async () => {
    const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    await render(<MoreScreen />);
    await fireEvent.press(await screen.findByText('Oficiální příručka 72 hodin (72h.gov.cz)'));
    expect(openURL).toHaveBeenCalledWith('https://www.72h.gov.cz/cs');
    expect(screen.getByText(/^Aplikace není spojená s Ministerstvem vnitra/)).toBeTruthy();
  });

  it('other languages do not show the Czech handbook link', async () => {
    await i18n.changeLanguage('en');
    await render(<MoreScreen />);
    expect(await screen.findByText('About')).toBeTruthy();
    expect(screen.queryByText('Official 72 hours guide (72h.gov.cz)')).toBeNull();
    await i18n.changeLanguage('cs');
  });

  it('kids screen explains what to say when calling 112', async () => {
    const id = await point(50.0965, 14.4213);
    jest.mocked(useLocalSearchParams).mockReturnValue({ id });
    await render(<KidsScreen />);
    expect(await screen.findByText(/^Když voláš 112, řekni: kde jsi/)).toBeTruthy();
  });

  it('talking-to-children guide shows tips without a checklist', async () => {
    jest.mocked(useLocalSearchParams).mockReturnValue({ id: 'kidsTalk' });
    await render(<GuideScreen />);
    expect(await screen.findByText('• Zůstaňte v klidu – děti zrcadlí naše emoce.')).toBeTruthy();
    expect(screen.queryByText(/^Máte \d/)).toBeNull();
  });
});

