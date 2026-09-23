import { Stack, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Linking, ScrollView, StyleSheet } from 'react-native';

import Arrow from '@/components/Arrow';
import { Text, View, useThemeColor } from '@/components/Themed';
import { Button } from '@/components/ui';
import { distanceText } from '@/lib/format';
import { getMeetingPoint } from '@/lib/repo';
import { useDbQuery } from '@/lib/useDbQuery';
import { useGuidance } from '@/lib/useLocation';

/** Big, simple screen a child can follow: where to go, an arrow, and how to get help. */
export default function KidsScreen() {
  const { t } = useTranslation();
  const background = useThemeColor({}, 'background');
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: mp } = useDbQuery((db) => getMeetingPoint(db, id), [id]);
  const target = mp?.lat != null && mp?.lon != null ? { lat: mp.lat, lon: mp.lon } : null;
  const g = useGuidance(target);

  if (!mp) return null;

  return (
    <ScrollView style={{ backgroundColor: background }} contentContainerStyle={styles.screen}>
      <Stack.Screen options={{ title: t('kids.title') }} />
      <Text style={styles.label}>{t('kids.goTo')}</Text>
      <Text style={styles.name}>{mp.name}</Text>
      {mp.note ? <Text style={styles.text}>{mp.note}</Text> : null}

      {g.distanceM != null && (
        <View style={styles.center}>
          {g.arrived ? (
            <Text style={styles.name}>{t('kids.arrived')}</Text>
          ) : (
            <>
              <Arrow rotation={g.rotation} size={240} />
              <Text style={styles.text}>{t('kids.followArrow')}</Text>
              <Text style={styles.text}>{t('kids.far', { distance: distanceText(t, g.distanceM) })}</Text>
            </>
          )}
        </View>
      )}

      <Text style={styles.text}>{t('kids.help')}</Text>
      <Button title={t('kids.call112')} variant="danger" onPress={() => Linking.openURL('tel:112')} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { padding: 20, gap: 16, paddingBottom: 48 },
  label: { fontSize: 22 },
  name: { fontSize: 34, fontWeight: '700' },
  text: { fontSize: 22, lineHeight: 30 },
  center: { alignItems: 'center', gap: 12, paddingVertical: 16, backgroundColor: 'transparent' },
});
