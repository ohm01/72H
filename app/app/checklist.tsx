import { useSQLiteContext } from 'expo-sqlite';
import * as WebBrowser from 'expo-web-browser';
import { useTranslation } from 'react-i18next';

import CheckRow from '@/components/CheckRow';
import { View } from '@/components/Themed';
import { Button, Card, Label, Muted, Screen } from '@/components/ui';
import { type ChecklistEntry, loc, scaleChecklist } from '@/lib/checklist';
import { daysText, formatNumber } from '@/lib/format';
import { getChecks, getHousehold, setCheck } from '@/lib/repo';
import { useDbQuery } from '@/lib/useDbQuery';
import { loadStandard } from '@/lib/useStandard';
import { router } from 'expo-router';

export default function ChecklistScreen() {
  const db = useSQLiteContext();
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const { data, reload } = useDbQuery(async (d) => {
    const standard = await loadStandard(d);
    // Checks are stored per standard so switching standards keeps both lists.
    const country = standard.mode === 'strictest' ? 'STRICTEST' : standard.rec.country;
    return { standard, country, household: await getHousehold(d), checks: await getChecks(d, country) };
  });

  if (!data) return null;
  const { standard, country } = data;
  const rec = standard.rec;
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
        const notes = [e.note ? loc(e.note, lang) : '', e.uncertain ? t('compare.uncertain') : ''].filter(Boolean);
        return (
          <CheckRow
            key={e.id}
            label={loc(e.label, lang)}
            notes={notes}
            amount={amount(e)}
            checked={data.checks.has(e.id)}
            onToggle={() => toggle(e.id)}
            // Food: concrete list from the official guide.
            link={e.type === 'food' ? { label: t('guides.foodMore'), onPress: () => router.push('/guide/food') } : undefined}
          />
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
        <Muted>{standard.mode === 'strictest' ? t('compare.standardStrictest') : loc(rec.name, lang)}</Muted>
        {standard.sources.map((src) => (
          <View key={src.url} style={{ gap: 4 }}>
            <Muted>{t('checklist.source', { publisher: src.publisher, date: src.verifiedAt })}</Muted>
            <Button title={t('checklist.openSource')} variant="secondary" onPress={() => WebBrowser.openBrowserAsync(src.url)} />
          </View>
        ))}
        {standard.mode === 'country' && rec.notes && <Muted>{loc(rec.notes, lang)}</Muted>}
        <Muted>{t('checklist.disclaimer')}</Muted>
        <Button title={t('compare.title')} variant="secondary" onPress={() => router.push('/compare')} />
      </Card>
    </Screen>
  );
}
