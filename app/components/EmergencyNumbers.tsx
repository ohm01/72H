import { useTranslation } from 'react-i18next';
import { Linking, Pressable, StyleSheet } from 'react-native';

import { Text, View } from '@/components/Themed';
import { Card, Label, Muted } from '@/components/ui';
import { loc } from '@/lib/checklist';
import type { Emergency, PhoneEntry } from '@/lib/emergency';
import { telHref } from '@/lib/targets';

function Row({ entry, big, lang }: { entry: PhoneEntry; big?: boolean; lang: string }) {
  return (
    <Pressable accessibilityRole="button" onPress={() => Linking.openURL(telHref(entry.number))}>
      <View style={styles.row}>
        <Text style={big ? styles.bigNumber : styles.number}>{entry.number}</Text>
        <View style={styles.grow}>
          <Text>{loc(entry.label, lang)}</Text>
          {entry.note ? <Muted>{loc(entry.note, lang)}</Muted> : null}
        </View>
      </View>
    </Pressable>
  );
}

/** Tap a number to call. Works without internet (needs only the mobile network). */
export default function EmergencyNumbers({ emergency }: { emergency: Emergency }) {
  const { t, i18n } = useTranslation();
  return (
    <Card>
      <Label>{t('emergency.title')}</Label>
      {emergency.numbers.map((e) => (
        <Row key={e.number} entry={e} big lang={i18n.language} />
      ))}
      {emergency.helplines.length > 0 && <Label>{t('emergency.helplines')}</Label>}
      {emergency.helplines.map((e) => (
        <Row key={e.number} entry={e} lang={i18n.language} />
      ))}
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 6, backgroundColor: 'transparent' },
  grow: { flex: 1, backgroundColor: 'transparent' },
  bigNumber: { fontSize: 24, fontWeight: '700', minWidth: 56 },
  number: { fontSize: 16, fontWeight: '600', minWidth: 96 },
});
