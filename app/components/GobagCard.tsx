import { router, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet } from 'react-native';

import { Text, View, useThemeColor } from '@/components/Themed';
import { Button, Card, Label, Muted } from '@/components/ui';
import { parseDate } from '@/lib/expiry';
import type { BagView } from '@/lib/gobags';

/** Stock tab: packing progress of each emergency bag, or an offer to prepare one. */
export default function GobagCard({ bags }: { bags: BagView[] }) {
  const { t, i18n } = useTranslation();
  const tint = useThemeColor({}, 'tint');
  const border = useThemeColor({}, 'border');

  if (!bags.length) {
    return (
      <Card>
        <Label>{t('guides.gobag')}</Label>
        <Muted>{t('guides.gobagOffer')}</Muted>
        <Button title={t('guides.prepareGobag')} variant="secondary" onPress={() => router.push('/gobag-setup')} />
      </Card>
    );
  }

  const soon = bags.flatMap((b) => b.soon).sort((a, b) => a.expiresOn.localeCompare(b.expiresOn))[0];
  return (
    <Card>
      <Label>{t(bags.length > 1 ? 'guides.gobags' : 'guides.gobag')}</Label>
      {bags.map((b) => (
        <Pressable
          key={b.id}
          accessibilityRole="button"
          onPress={() => router.push(`/guide/gobag?bag=${b.id}` as Href)}
          style={styles.bag}
        >
          <View style={styles.row}>
            <Text style={styles.name}>{b.name}</Text>
            <Muted>{t('guides.packed', { done: b.done, total: b.total })}</Muted>
          </View>
          <View style={[styles.meter, { backgroundColor: border }]}>
            <View style={[styles.fill, { width: `${b.total ? Math.round((b.done / b.total) * 100) : 0}%`, backgroundColor: tint }]} />
          </View>
        </Pressable>
      ))}
      {soon ? (
        <Muted>{t('guides.expiresSoon', { name: soon.name, date: parseDate(soon.expiresOn).toLocaleDateString(i18n.language) })}</Muted>
      ) : null}
      <Button title={t('guides.addGobag')} variant="secondary" onPress={() => router.push('/gobag-setup')} />
    </Card>
  );
}

const styles = StyleSheet.create({
  bag: { gap: 6, paddingVertical: 4 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', backgroundColor: 'transparent' },
  name: { fontSize: 17, fontWeight: '600' },
  meter: { height: 6, borderRadius: 3, overflow: 'hidden' },
  fill: { height: '100%' },
});
