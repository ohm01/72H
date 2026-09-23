import { Stack, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import * as WebBrowser from 'expo-web-browser';
import { useTranslation } from 'react-i18next';

import { StyleSheet } from 'react-native';

import CheckRow from '@/components/CheckRow';
import { Text } from '@/components/Themed';
import { Button, Card, Label, Muted, Screen } from '@/components/ui';
import { loc } from '@/lib/checklist';
import { GUIDES, type GuideId, guideCheckKey, visibleGroups } from '@/lib/guides';
import { getChecks, getHousehold, setCheck } from '@/lib/repo';
import { useDbQuery } from '@/lib/useDbQuery';

/** Official guide as a checklist: what food to keep at home, what to pack in the emergency bag. */
export default function GuideScreen() {
  const db = useSQLiteContext();
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const id = (useLocalSearchParams<{ id: string }>().id ?? 'food') as GuideId;
  const guide = GUIDES[id] ?? GUIDES.food;
  const key = guideCheckKey(id);
  const { data, reload } = useDbQuery(async (d) => ({ household: await getHousehold(d), checks: await getChecks(d, key) }), [key]);

  if (!data) return null;
  const groups = visibleGroups(guide, data.household);
  const total = groups.reduce((n, g) => n + g.items.length, 0);
  const done = groups.reduce((n, g) => n + g.items.filter((i) => data.checks.has(i.id)).length, 0);

  async function toggle(itemId: string) {
    await setCheck(db, key, itemId, !data!.checks.has(itemId));
    reload();
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: t(`guides.${id}`) }} />
      <Muted>{loc(guide.intro, lang)}</Muted>
      {guide.sections?.map((sec) => (
        <Card key={sec.id}>
          <Label>{loc(sec.label, lang)}</Label>
          {sec.lines.map((line, i) => (
            <Text key={line.cs} style={styles.tip}>{`${sec.numbered ? `${i + 1}.` : '•'} ${loc(line, lang)}`}</Text>
          ))}
        </Card>
      ))}
      {total > 0 && <Muted>{t('guides.progress', { done, total })}</Muted>}
      {groups.map((g) => (
        <Card key={g.id}>
          <Label>{loc(g.label, lang)}</Label>
          {g.items.map((i) => (
            <CheckRow
              key={i.id}
              label={loc(i.label, lang)}
              notes={i.note ? [loc(i.note, lang)] : []}
              checked={data.checks.has(i.id)}
              onToggle={() => toggle(i.id)}
            />
          ))}
        </Card>
      ))}
      {guide.tips.length > 0 && (
        <Card>
          {total > 0 && <Label>{t('guides.tips')}</Label>}
          {guide.tips.map((tip) => (
            <Text key={tip.cs} style={total > 0 ? undefined : styles.tip}>{`• ${loc(tip, lang)}`}</Text>
          ))}
        </Card>
      )}
      <Card>
        <Muted>{t('checklist.source', { publisher: guide.source.publisher, date: guide.source.verifiedAt })}</Muted>
        <Button title={t('checklist.openSource')} variant="secondary" onPress={() => WebBrowser.openBrowserAsync(guide.source.url)} />
        <Muted>{t('checklist.disclaimer')}</Muted>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  tip: { fontSize: 16, lineHeight: 23 },
});
