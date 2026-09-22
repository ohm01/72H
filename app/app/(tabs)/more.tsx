import { useSQLiteContext } from 'expo-sqlite';
import { useTranslation } from 'react-i18next';

import { Button, Card, Chip, ChipRow, Label, Muted, Screen, Stepper } from '@/components/ui';
import { LANGUAGES, type LanguagePreference, applyLanguage } from '@/i18n';
import { useLimits } from '@/lib/entitlement';
import { ensurePermission, syncReminders } from '@/lib/notifications';
import { type Household, getHousehold, getSetting, listItems, setHousehold, setSetting } from '@/lib/repo';
import { useDbQuery } from '@/lib/useDbQuery';

const LANGUAGE_NAMES: Record<string, string> = { cs: 'Čeština', en: 'English' };

export default function MoreScreen() {
  const db = useSQLiteContext();
  const { t } = useTranslation();
  const limits = useLimits();
  const { data, reload } = useDbQuery(async (d) => ({
    household: await getHousehold(d),
    language: ((await getSetting(d, 'language')) ?? 'system') as LanguagePreference,
  }));

  if (!data) return null;

  async function updateHousehold(h: Household) {
    await setHousehold(db, h);
    reload();
  }

  async function setLanguage(pref: LanguagePreference) {
    await setSetting(db, 'language', pref);
    await applyLanguage(pref);
    reload();
  }

  async function enableReminders() {
    await ensurePermission();
    await syncReminders(await listItems(db), limits.expiryReminders);
  }

  return (
    <Screen>
      <Card>
        <Label>{t('more.household')}</Label>
        <Muted>{t('onboarding.persons')}</Muted>
        <Stepper value={data.household.persons} min={1} max={20} onChange={(persons) => updateHousehold({ ...data.household, persons })} />
        <Muted>{t('onboarding.pets')}</Muted>
        <Stepper value={data.household.pets} min={0} max={20} onChange={(pets) => updateHousehold({ ...data.household, pets })} />
      </Card>

      <Card>
        <Label>{t('more.reminders')}</Label>
        {limits.expiryReminders ? (
          <>
            <Muted>{t('more.remindersText')}</Muted>
            <Button title={t('more.remindersEnable')} variant="secondary" onPress={enableReminders} />
          </>
        ) : (
          <Muted>{t('more.remindersPlus')}</Muted>
        )}
      </Card>

      <Card>
        <Label>{t('more.language')}</Label>
        <ChipRow>
          <Chip label={t('more.languageSystem')} selected={data.language === 'system'} onPress={() => setLanguage('system')} />
          {LANGUAGES.map((l) => (
            <Chip key={l} label={LANGUAGE_NAMES[l] ?? l} selected={data.language === l} onPress={() => setLanguage(l)} />
          ))}
        </ChipRow>
      </Card>

      <Card>
        <Label>{t('more.about')}</Label>
        <Muted>{t('more.disclaimer')}</Muted>
      </Card>
    </Screen>
  );
}
