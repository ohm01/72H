import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { SQLiteProvider, useSQLiteContext } from 'expo-sqlite';
import { useEffect } from 'react';
import { AppState } from 'react-native';
import { useTranslation } from 'react-i18next';
import 'react-native-reanimated';

import { applyLanguage, type LanguagePreference } from '@/i18n';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { DB_NAME, migrate } from '@/lib/db';
import { useLimits } from '@/lib/entitlement';
import { syncReminders } from '@/lib/notifications';
import { getSetting, listItems } from '@/lib/repo';
import { syncNow } from '@/lib/sync';

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from 'expo-router';

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  // Expo Router uses Error Boundaries to catch errors in the navigation tree.
  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return (
    <SQLiteProvider databaseName={DB_NAME} onInit={migrate}>
      <Startup />
      <RootLayoutNav />
    </SQLiteProvider>
  );
}

/** Tasks after the DB is ready: language preference, reminder re-sync, family sync. */
function Startup() {
  const db = useSQLiteContext();
  const limits = useLimits();

  useEffect(() => {
    (async () => {
      await applyLanguage((await getSetting(db, 'language')) as LanguagePreference | null);
      await syncReminders(await listItems(db), limits.expiryReminders);
    })().catch((e) => console.warn('startup failed', e));
  }, [db, limits.expiryReminders]);

  // Family sync (only when signed in and in a family): at start and whenever the app comes back to the foreground.
  useEffect(() => {
    const sync = () => void syncNow(db).catch((e) => console.warn('sync failed', e));
    sync();
    const sub = AppState.addEventListener('change', (state) => state === 'active' && sync());
    return () => sub.remove();
  }, [db]);

  return null;
}

function RootLayoutNav() {
  const colorScheme = useColorScheme();
  const { t } = useTranslation();
  const base = colorScheme === 'dark' ? DarkTheme : DefaultTheme;
  const c = Colors[colorScheme];
  const theme = {
    ...base,
    colors: { ...base.colors, primary: c.tint, background: c.background, card: c.card, text: c.text, border: c.border },
  };

  return (
    <ThemeProvider value={theme}>
      <Stack screenOptions={{ headerBackButtonDisplayMode: 'minimal' }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="onboarding" options={{ headerShown: false, gestureEnabled: false }} />
        <Stack.Screen name="item/[id]" options={{ presentation: 'modal', title: t('item.editTitle') }} />
        <Stack.Screen name="locations" options={{ title: t('locations.title') }} />
        <Stack.Screen name="checklist" options={{ title: t('checklist.title') }} />
        <Stack.Screen name="compare" options={{ title: t('compare.title') }} />
        <Stack.Screen name="map-areas" options={{ title: t('mapAreas.title') }} />
        <Stack.Screen name="meeting-point/[id]" options={{ title: t('meetingPoint.editTitle') }} />
        <Stack.Screen name="navigate/[id]" options={{ title: t('navigate.title') }} />
        <Stack.Screen name="kids/[id]" options={{ title: t('kids.title') }} />
        <Stack.Screen name="guide/[id]" options={{ title: '' }} />
        <Stack.Screen name="contact/[id]" options={{ title: t('contacts.editTitle') }} />
        <Stack.Screen name="share" options={{ title: t('share.title') }} />
        <Stack.Screen name="join" options={{ title: t('share.joinTitle') }} />
      </Stack>
    </ThemeProvider>
  );
}
