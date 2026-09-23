import { router, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, ScrollView, StyleSheet } from 'react-native';

import OfflineMap from '@/components/OfflineMap';
import { View, useThemeColor } from '@/components/Themed';
import { Button, Card, Muted, Title } from '@/components/ui';
import { useLimits } from '@/lib/entitlement';
import { distanceText } from '@/lib/format';
import { distanceM, type LatLon } from '@/lib/geo';
import { ensureMapAssets } from '@/lib/mapDownload';
import { listMapAreas, listMeetingPoints } from '@/lib/repo';
import { useDbQuery } from '@/lib/useDbQuery';
import { usePosition } from '@/lib/useLocation';

export default function MapScreen() {
  const { t } = useTranslation();
  const limits = useLimits();
  const background = useThemeColor({}, 'background');
  const { data } = useDbQuery(async (db) => ({
    areas: await listMapAreas(db),
    points: await listMeetingPoints(db),
  }));
  const { position, denied } = usePosition();
  // Top up fonts/icons whenever online, so assets added on the server reach existing installs.
  useFocusEffect(useCallback(() => void ensureMapAssets().catch(() => {}), []));

  if (!data) return null;
  const { areas, points } = data;
  const located = points.filter((m) => m.lat != null && m.lon != null);

  function addMeetingPoint(at?: LatLon) {
    // Specific Plus hint, only when the user actually tries (paywall arrives in M4).
    if (points.length >= limits.meetingPoints) return Alert.alert(t('map.meetingPlus'));
    router.push(at ? `/meeting-point/new?lat=${at.lat}&lon=${at.lon}` : '/meeting-point/new');
  }

  const list = (
    <>
      <Title>{t('map.meetingPoints')}</Title>
      {points.map((mp) => {
        const located = mp.lat != null && mp.lon != null;
        const dist = located && position ? distanceText(t, distanceM(position, { lat: mp.lat!, lon: mp.lon! })) : null;
        return (
          <Card key={mp.id}>
            <Title>{mp.name}</Title>
            <Muted>{located ? (dist ?? '') : t('map.noPosition')}</Muted>
            <View style={styles.row}>
              <View style={styles.grow}>
                <Button title={t('map.navigate')} onPress={() => router.push(`/navigate/${mp.id}`)} disabled={!located} />
              </View>
              <View style={styles.grow}>
                <Button title={t('common.edit')} variant="secondary" onPress={() => router.push(`/meeting-point/${mp.id}`)} />
              </View>
            </View>
          </Card>
        );
      })}
      <Button title={t('map.addMeetingPoint')} variant="secondary" onPress={() => addMeetingPoint()} />
      <Button title={t('map.areas')} variant="secondary" onPress={() => router.push('/map-areas')} />
      {denied && <Muted>{t('map.locationDenied')}</Muted>}
    </>
  );

  if (!areas.length) {
    return (
      <ScrollView style={{ backgroundColor: background }} contentContainerStyle={styles.panel}>
        <Card>
          <Title>{t('map.emptyTitle')}</Title>
          <Muted>{t('map.emptyText')}</Muted>
          <Button title={t('map.download')} onPress={() => router.push('/map-areas')} />
        </Card>
        {list}
      </ScrollView>
    );
  }

  return (
    <View style={styles.fill}>
      <OfflineMap
        areas={areas}
        meetingPoints={points}
        focus={located[0] ? { lat: located[0].lat!, lon: located[0].lon! } : null}
        onLongPress={addMeetingPoint}
        style={styles.map}
      />
      <ScrollView style={[styles.sheet, { backgroundColor: background }]} contentContainerStyle={styles.panel}>
        <Muted>{t('map.longPressHint')}</Muted>
        {list}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  map: { flex: 3 },
  sheet: { flex: 2 },
  panel: { padding: 16, gap: 12, paddingBottom: 32 },
  row: { flexDirection: 'row', gap: 8, backgroundColor: 'transparent' },
  grow: { flex: 1, backgroundColor: 'transparent' },
});
