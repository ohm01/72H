// M2 screen tests: real screens + real SQLite; GPS, compass, MapLibre and file downloads are mocked.
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Linking } from 'react-native';

import { createTestDb } from './helpers/sqlite';

import MapScreen from '@/app/(tabs)/map';
import KidsScreen from '@/app/kids/[id]';
import MapAreasScreen from '@/app/map-areas';
import MeetingPointScreen from '@/app/meeting-point/[id]';
import NavigateScreen from '@/app/navigate/[id]';
import i18n from '@/i18n';
import { migrate } from '@/lib/db';
import { downloadArea } from '@/lib/mapDownload';
import { getMapDownloadsThisMonth, listMapAreas, listMeetingPoints, saveMeetingPoint } from '@/lib/repo';

jest.setTimeout(120_000);

let mockDb: ReturnType<typeof createTestDb>;
// Old Town Square, Prague; the meeting point is ~1 km north of it.
const HERE = { latitude: 50.0875, longitude: 14.4213 };
const mockPosition = { coords: { ...HERE, accuracy: 8 } };
let mockHeading = 90;

jest.mock('expo-sqlite', () => ({ useSQLiteContext: () => mockDb }));
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
  geocodeAsync: jest.fn(async () => [{ latitude: 49.1951, longitude: 16.6068 }]),
}));
jest.mock('@maplibre/maplibre-react-native', () => {
  const { View } = require('react-native');
  return {
    Map: ({ children }: { children: React.ReactNode }) => <View testID="map">{children}</View>,
    Camera: () => null,
    NativeUserLocation: () => null,
    Marker: ({ children }: { children: React.ReactNode }) => children,
  };
});
jest.mock('@/lib/mapDownload', () => ({
  assetsDir: () => ({ uri: 'file:///maps/assets' }),
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
    await fireEvent.press(screen.getByText('Stáhnout oblast mapy'));
    expect(router.push).toHaveBeenCalledWith('/map-areas');
  });

  it('shows the offline map once an area is downloaded', async () => {
    await mockDb.runAsync(
      `INSERT INTO map_areas (id, name, west, south, east, north, area_km2, size_bytes, file_uri, created_at)
       VALUES ('a1', 'Praha', 14.3, 50.0, 14.5, 50.2, 300, 5000000, 'file:///maps/a1.pmtiles', '2026-09-23')`
    );
    await render(<MapScreen />);
    expect(await screen.findByTestId('map')).toBeTruthy();
    expect(screen.getByText('Dlouhým podržením na mapě přidáte místo srazu.')).toBeTruthy();
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

  it('explains when the server rejects an area outside the Czech Republic', async () => {
    const { ApiError } = jest.requireActual('@/lib/api');
    jest.mocked(downloadArea).mockRejectedValue(new ApiError(422, { detail: 'area outside supported region (CZ)' }));
    await render(<MapAreasScreen />);

    await fireEvent.press(screen.getByText('Obec nebo adresa'));
    await fireEvent.changeText(screen.getByPlaceholderText('Obec nebo adresa'), 'Brno');
    await fireEvent.press(screen.getByText('Najít'));
    expect(await screen.findByText('49.1951, 16.6068')).toBeTruthy();
    await fireEvent.press(screen.getByText('Stáhnout'));
    expect(await screen.findByText('Oblast musí ležet celá v České republice.')).toBeTruthy();
    expect(await listMapAreas(mockDb)).toHaveLength(0);
  });
});
