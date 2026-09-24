import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking } from 'react-native';

import { Button, Card, Chip, ChipRow, Label, Muted, Screen, Stepper, TextField } from '@/components/ui';
import { LANGUAGES, type LanguagePreference, applyLanguage } from '@/i18n';
import { useLimits } from '@/lib/entitlement';
import { ensurePermission, syncReminders } from '@/lib/notifications';
import { KIDS_HELP_KEY, type Household, getHousehold, getSetting, listItems, setHousehold, setSetting } from '@/lib/repo';
import { useDbQuery } from '@/lib/useDbQuery';

const OFFICIAL_GUIDE_URL = 'https://www.72h.gov.cz/cs';
const LANGUAGE_NAMES: Record<string, string> = { cs: 'Čeština', en: 'English', sk: 'Slovenčina', pl: 'Polski', fi: 'Suomi' };

export default function MoreScreen() {
  const db = useSQLiteContext();
  const { t, i18n } = useTranslation();
  const limits = useLimits();
  const { data, reload } = useDbQuery(async (d) => ({
    household: await getHousehold(d),
    language: ((await getSetting(d, 'language')) ?? 'system') as LanguagePreference,
    kidsHelp: await getSetting(d, KIDS_HELP_KEY),
  }));
  const [kidsHelp, setKidsHelp] = useState<string | null>(null);

  if (!data) return null;
  const adults = data.household.persons - data.household.children;

  async function updateHousehold(h: Household) {
    await setHousehold(db, h);
    reload();
  }

  async function setLanguage(pref: LanguagePreference) {
    await setSetting(db, 'language', pref);
    await applyLanguage(pref);
    reload();
  }

  // Empty text = back to the default message.
  async function saveKidsHelp() {
    if (kidsHelp === null) return;
    await setSetting(db, KIDS_HELP_KEY, kidsHelp.trim());
    setKidsHelp(null);
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
        <Muted>{t('onboarding.adults')}</Muted>
        <Stepper value={adults} min={1} max={20} onChange={(a) => updateHousehold({ ...data.household, persons: a + data.household.children })} />
        <Muted>{t('onboarding.children')}</Muted>
        <Stepper
          value={data.household.children}
          min={0}
          max={20}
          onChange={(children) => updateHousehold({ ...data.household, children, persons: adults + children })}
        />
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
        <Label>{t('more.kidsHelp')}</Label>
        <Muted>{t('more.kidsHelpText')}</Muted>
        <TextField
          multiline
          value={kidsHelp ?? (data.kidsHelp || t('kids.help'))}
          onChangeText={setKidsHelp}
          onEndEditing={saveKidsHelp}
        />
        <Button title={t('guides.kidsTalk')} variant="secondary" onPress={() => router.push('/guide/kidsTalk')} />
      </Card>

      <Button title={t('more.compare')} variant="secondary" onPress={() => router.push('/compare')} />
      <Button title={t('stock.checklist')} variant="secondary" onPress={() => router.push('/checklist')} />

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
        {/* The official handbook is the Czech state's; link it from the Czech UI only. */}
        {i18n.language === 'cs' && (
          <>
            <Muted>{t('more.notAffiliated')}</Muted>
            <Button title={t('more.officialGuide')} variant="secondary" onPress={() => Linking.openURL(OFFICIAL_GUIDE_URL)} />
          </>
        )}
      </Card>
    </Screen>
  );
}
