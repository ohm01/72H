import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet } from 'react-native';

import Arrow from '@/components/Arrow';
import { Text, View } from '@/components/Themed';
import { Button, Muted, Screen, Title } from '@/components/ui';
import { distanceText } from '@/lib/format';
import { getMeetingPoint } from '@/lib/repo';
import { useDbQuery } from '@/lib/useDbQuery';
import { useGuidance } from '@/lib/useLocation';

/** Arrow + distance to a meeting point. Works fully offline (GPS + compass only). */
export default function NavigateScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: mp } = useDbQuery((db) => getMeetingPoint(db, id), [id]);
  const target = mp?.lat != null && mp?.lon != null ? { lat: mp.lat, lon: mp.lon } : null;
  const g = useGuidance(target);

  if (mp === undefined) return null;

  return (
    <Screen>
      <Stack.Screen options={{ title: t('navigate.title') }} />
      <Title>{mp?.name ?? ''}</Title>
      {mp?.note ? <Muted>{mp.note}</Muted> : null}
      {mp?.address ? <Muted>{mp.address}</Muted> : null}

      {!target ? (
        <>
          <Muted>{t('navigate.noTarget')}</Muted>
          {mp && <Button title={t('common.edit')} variant="secondary" onPress={() => router.push(`/meeting-point/${mp.id}`)} />}
        </>
      ) : g.denied ? (
        <Muted>{t('map.locationDenied')}</Muted>
      ) : g.distanceM == null ? (
        <Muted>{t('navigate.waiting')}</Muted>
      ) : (
        <View style={styles.center}>
          {g.arrived ? <Text style={styles.big}>{t('navigate.arrived')}</Text> : <Arrow rotation={g.rotation} size={200} />}
          <Text style={styles.big}>{distanceText(t, g.distanceM)}</Text>
          {g.accuracy != null && <Muted>{t('navigate.accuracy', { m: Math.round(g.accuracy) })}</Muted>}
          {!g.hasCompass && !g.arrived && <Muted style={styles.centerText}>{t('navigate.noCompass')}</Muted>}
        </View>
      )}

      {target && mp && <Button title={t('navigate.kidsMode')} variant="secondary" onPress={() => router.push(`/kids/${mp.id}`)} />}
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', gap: 12, paddingVertical: 24, backgroundColor: 'transparent' },
  big: { fontSize: 36, fontWeight: '700', textAlign: 'center' },
  centerText: { textAlign: 'center' },
});
