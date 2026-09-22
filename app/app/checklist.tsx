import { useSQLiteContext } from 'expo-sqlite';
import * as WebBrowser from 'expo-web-browser';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet } from 'react-native';

import { Text, View } from '@/components/Themed';
import { Button, Card, Label, Muted, Screen } from '@/components/ui';
import { ExpiryColors } from '@/constants/Colors';
import { type ChecklistEntry, loc, scaleChecklist } from '@/lib/checklist';
import { DEFAULT_COUNTRY } from '@/lib/config';
import { COUNTRIES } from '@/lib/countries';
import { daysText, formatNumber } from '@/lib/format';
import { getChecks, getHousehold, setCheck } from '@/lib/repo';
import { useDbQuery } from '@/lib/useDbQuery';

export default function ChecklistScreen() {
  const db = useSQLiteContext();
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const country = DEFAULT_COUNTRY; // country choice arrives in M5
  const rec = COUNTRIES[country];
  const { data, reload } = useDbQuery(async (d) => ({ household: await getHousehold(d), checks: await getChecks(d, country) }));

  if (!data) return null;
  const entries = scaleChecklist(rec, data.household);

  async function toggle(id: string) {
    await setCheck(db, country, id, !data!.checks.has(id));
    reload();
  }

  const amount = (e: ChecklistEntry) =>
    e.totalAmount == null || !e.quantity.unit
      ? ''
      : e.quantity.unit === 'day'
        ? daysText(t, e.totalAmount)
        : `${formatNumber(e.totalAmount)} ${t(`units.${e.quantity.unit}`)}`;

  const section = (priority: ChecklistEntry['priority']) =>
    entries
      .filter((e) => e.priority === priority)
      .map((e) => {
        const checked = data.checks.has(e.id);
        return (
          <Pressable key={e.id} onPress={() => toggle(e.id)} accessibilityRole="checkbox" accessibilityState={{ checked }}>
            <View style={styles.row}>
              <View style={[styles.box, checked && { backgroundColor: ExpiryColors.green, borderColor: ExpiryColors.green }]}>
                {checked && <Text style={styles.tick}>✓</Text>}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.label, checked && styles.done]}>{loc(e.label, lang)}</Text>
                {e.note && <Muted>{loc(e.note, lang)}</Muted>}
              </View>
              <Text style={styles.amount}>{amount(e)}</Text>
            </View>
          </Pressable>
        );
      });

  return (
    <Screen>
      <Muted>
        {t('checklist.intro', {
          persons: data.household.persons,
          pets: data.household.pets,
          days: daysText(t, rec.selfSufficiencyDays),
        })}
      </Muted>
      <Card>
        <Label>{t('checklist.essential')}</Label>
        {section('essential')}
      </Card>
      <Card>
        <Label>{t('checklist.recommended')}</Label>
        {section('recommended')}
      </Card>
      <Card>
        <Muted>{t('checklist.source', { publisher: rec.source.publisher, date: rec.source.verifiedAt })}</Muted>
        {rec.notes && <Muted>{loc(rec.notes, lang)}</Muted>}
        <Muted>{t('checklist.disclaimer')}</Muted>
        <Button title={t('checklist.openSource')} variant="secondary" onPress={() => WebBrowser.openBrowserAsync(rec.source.url)} />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  box: { width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: '#9e9e9e', alignItems: 'center', justifyContent: 'center' },
  tick: { color: '#fff', fontWeight: '700' },
  label: { fontSize: 16 },
  done: { opacity: 0.5 },
  amount: { fontWeight: '600' },
});
