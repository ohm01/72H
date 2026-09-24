import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button, Card, Chip, ChipRow, Muted, Screen, TextField } from '@/components/ui';
import { type BagKind, addBags } from '@/lib/gobags';
import { getHousehold } from '@/lib/repo';
import { useDbQuery } from '@/lib/useDbQuery';

type Mode = 'perPerson' | 'household';

/** Prepare emergency bags: one per person (default) or one for the whole household. */
export default function GobagSetupScreen() {
  const db = useSQLiteContext();
  const { t } = useTranslation();
  const { data: household } = useDbQuery(getHousehold);
  const [mode, setMode] = useState<Mode>('perPerson');
  const [people, setPeople] = useState<{ name: string; kind: BagKind }[]>([]);

  // One row per person: adults first, then children.
  useEffect(() => {
    if (!household) return;
    const adults = household.persons - household.children;
    setPeople([
      ...Array.from({ length: adults }, (_, i) => ({ name: t('guides.adultN', { n: i + 1 }), kind: 'adult' as const })),
      ...Array.from({ length: household.children }, (_, i) => ({ name: t('guides.childN', { n: i + 1 }), kind: 'child' as const })),
    ]);
  }, [household, t]);

  if (!household) return null;

  async function create() {
    if (mode === 'household') {
      await addBags(db, [{ name: t('guides.gobag'), kind: 'household' }]);
    } else {
      await addBags(
        db,
        people.map((p, i) => ({ name: p.name.trim() || (p.kind === 'child' ? t('guides.childN', { n: i + 1 }) : t('guides.adultN', { n: i + 1 })), kind: p.kind }))
      );
    }
    router.back();
  }

  return (
    <Screen>
      <Muted>{t('guides.gobagOffer')}</Muted>
      <Card>
        <ChipRow>
          <Chip label={t('guides.setupPerPerson')} selected={mode === 'perPerson'} onPress={() => setMode('perPerson')} />
          <Chip label={t('guides.setupHousehold')} selected={mode === 'household'} onPress={() => setMode('household')} />
        </ChipRow>
        {mode === 'perPerson' ? (
          <>
            <Muted>{t('guides.setupPerPersonHint')}</Muted>
            {people.map((p, i) => (
              <TextField
                key={i}
                value={p.name}
                onChangeText={(name) => setPeople((list) => list.map((x, j) => (j === i ? { ...x, name } : x)))}
                accessibilityLabel={p.kind === 'child' ? t('onboarding.children') : t('onboarding.adults')}
              />
            ))}
          </>
        ) : (
          <Muted>{t('guides.householdNote', { persons: household.persons })}</Muted>
        )}
      </Card>
      <Muted>{t('guides.setupAfter')}</Muted>
      <Button title={t('guides.setupCreate')} onPress={create} />
    </Screen>
  );
}
