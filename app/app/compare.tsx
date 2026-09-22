import { useSQLiteContext } from 'expo-sqlite';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet } from 'react-native';

import { Text, View, useThemeColor } from '@/components/Themed';
import { Card, Chip, ChipRow, Label, Muted, Screen } from '@/components/ui';
import { type CountryItem, loc } from '@/lib/checklist';
import { COUNTRIES } from '@/lib/countries';
import { daysText, formatNumber } from '@/lib/format';
import { setSetting } from '@/lib/repo';
import type { StandardMode } from '@/lib/standards';
import { useDbQuery } from '@/lib/useDbQuery';
import { loadStandard } from '@/lib/useStandard';

const CODES = Object.keys(COUNTRIES);

export default function CompareScreen() {
  const db = useSQLiteContext();
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const border = useThemeColor({}, 'border');
  const { data: standard, reload } = useDbQuery(loadStandard);

  if (!standard) return null;
  const home = standard.home;

  async function choose(key: 'homeCountry' | 'standard', value: string) {
    await setSetting(db, key, value);
    reload();
  }

  // Union of item ids, home country order first.
  const ids: string[] = [];
  for (const c of [home, ...CODES.filter((x) => x !== home)])
    for (const i of COUNTRIES[c].items) if (!ids.includes(i.id)) ids.push(i.id);

  const labelFor = (id: string) => {
    const item = [COUNTRIES[home], ...CODES.map((c) => COUNTRIES[c])].flatMap((c) => c.items).find((i) => i.id === id)!;
    return loc(item.label, lang);
  };

  const cell = (item: CountryItem | undefined) => {
    if (!item) return '–';
    const q = item.quantity;
    let text = '✓';
    if (q.amount != null && q.unit) {
      text = q.unit === 'day' ? daysText(t, q.amount) : `${formatNumber(q.amount)} ${t(`units.${q.unit}`)}`;
      if (q.perDay) text += ` ${t('compare.perDay')}`;
    }
    return item.uncertain ? `${text} ⚠️` : text;
  };

  return (
    <Screen>
      <Muted>{t('compare.intro')}</Muted>

      <Card>
        <Label>{t('compare.myCountry')}</Label>
        <ChipRow>
          {CODES.map((c) => (
            <Chip key={c} label={loc(COUNTRIES[c].name, lang)} selected={home === c} onPress={() => choose('homeCountry', c)} />
          ))}
        </ChipRow>
        <Label>{t('compare.standard')}</Label>
        <ChipRow>
          {(['country', 'strictest'] as StandardMode[]).map((m) => (
            <Chip
              key={m}
              label={m === 'country' ? t('compare.standardCountry') : t('compare.standardStrictest')}
              selected={standard.mode === m}
              onPress={() => choose('standard', m)}
            />
          ))}
        </ChipRow>
        <Muted>{t('compare.result', { days: daysText(t, standard.rec.selfSufficiencyDays) })}</Muted>
      </Card>

      <ScrollView horizontal>
        <View>
          <View style={[styles.row, { borderColor: border }]}>
            <Text style={[styles.first, styles.head]} />
            {CODES.map((c) => (
              <Text key={c} style={[styles.cell, styles.head]}>
                {loc(COUNTRIES[c].name, lang)}
              </Text>
            ))}
          </View>
          <View style={[styles.row, { borderColor: border }]}>
            <Text style={[styles.first, styles.head]}>{t('compare.period')}</Text>
            {CODES.map((c) => (
              <Text key={c} style={styles.cell}>
                {daysText(t, COUNTRIES[c].selfSufficiencyDays)}
                {(COUNTRIES[c] as { uncertain?: boolean }).uncertain ? ' ⚠️' : ''}
              </Text>
            ))}
          </View>
          {ids.map((id) => (
            <View key={id} style={[styles.row, { borderColor: border }]}>
              <Text style={styles.first}>{labelFor(id)}</Text>
              {CODES.map((c) => (
                <Text key={c} style={styles.cell}>
                  {cell(COUNTRIES[c].items.find((i) => i.id === id))}
                </Text>
              ))}
            </View>
          ))}
        </View>
      </ScrollView>
      <Muted>{t('compare.legend')}</Muted>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: 8 },
  first: { width: 170, paddingRight: 8 },
  cell: { width: 110, paddingRight: 8 },
  head: { fontWeight: '600' },
});
