import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';

import { View } from '@/components/Themed';
import { Button, Card, Label, Muted, Screen, Stepper, TextField, Title } from '@/components/ui';
import { useLimits } from '@/lib/entitlement';
import { saveLocation, saveMeetingPoint, setHousehold, setSetting } from '@/lib/repo';

const STEPS = 4; // welcome, household, stock locations, meeting point

export default function Onboarding() {
  const db = useSQLiteContext();
  const { t } = useTranslation();
  const limits = useLimits();
  const [step, setStep] = useState(0);
  const [persons, setPersons] = useState(2);
  const [pets, setPets] = useState(0);
  const [locationNames, setLocationNames] = useState([t('onboarding.locationDefault')]);
  const [meetingName, setMeetingName] = useState('');
  const [meetingNote, setMeetingNote] = useState('');

  async function finish(withMeetingPoint: boolean) {
    await db.withTransactionAsync(async () => {
      await setHousehold(db, { persons, pets });
      const names = locationNames.map((n) => n.trim()).filter(Boolean);
      for (const name of names.length ? names : [t('onboarding.locationDefault')]) {
        await saveLocation(db, { name, lat: null, lon: null });
      }
      if (withMeetingPoint && meetingName.trim()) {
        await saveMeetingPoint(db, {
          name: meetingName.trim(),
          note: meetingNote.trim() || null,
          address: null,
          lat: null,
          lon: null,
          photoUri: null,
        });
      }
      await setSetting(db, 'onboarded', '1');
    });
    router.replace('/');
  }

  const next = () => setStep((s) => Math.min(STEPS - 1, s + 1));
  const back = () => setStep((s) => Math.max(0, s - 1));

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <Screen>
        <Muted>{`${step + 1} / ${STEPS}`}</Muted>

        {step === 0 && (
          <Card>
            <Title>{t('onboarding.welcomeTitle')}</Title>
            <Muted>{t('onboarding.welcomeText')}</Muted>
          </Card>
        )}

        {step === 1 && (
          <Card>
            <Title>{t('onboarding.householdTitle')}</Title>
            <Label>{t('onboarding.persons')}</Label>
            <Stepper value={persons} onChange={setPersons} min={1} max={20} />
            <Label>{t('onboarding.pets')}</Label>
            <Stepper value={pets} onChange={setPets} min={0} max={20} />
          </Card>
        )}

        {step === 2 && (
          <Card>
            <Title>{t('onboarding.locationTitle')}</Title>
            <Muted>{t('onboarding.locationText')}</Muted>
            {locationNames.map((name, i) => (
              <TextField
                key={i}
                value={name}
                onChangeText={(v) => setLocationNames((all) => all.map((n, j) => (j === i ? v : n)))}
                placeholder={t('locations.namePlaceholder')}
              />
            ))}
            {locationNames.length < limits.stockLocations ? (
              <Button title={t('onboarding.addLocation')} variant="secondary" onPress={() => setLocationNames((all) => [...all, ''])} />
            ) : (
              <Muted>{t('onboarding.locationsPlus')}</Muted>
            )}
          </Card>
        )}

        {step === 3 && (
          <Card>
            <Title>{t('onboarding.meetingTitle')}</Title>
            <Muted>{t('onboarding.meetingText')}</Muted>
            <Label>{t('onboarding.meetingName')}</Label>
            <TextField value={meetingName} onChangeText={setMeetingName} placeholder={t('onboarding.meetingPlaceholder')} />
            <Label>{`${t('onboarding.meetingNote')} (${t('common.optional')})`}</Label>
            <TextField value={meetingNote} onChangeText={setMeetingNote} multiline />
          </Card>
        )}

        <View style={{ gap: 8 }}>
          {step < STEPS - 1 ? (
            <Button title={t('common.next')} onPress={next} disabled={step === 2 && !locationNames[0]?.trim()} />
          ) : (
            <>
              <Button title={t('onboarding.finish')} onPress={() => finish(true)} disabled={!meetingName.trim()} />
              <Button title={t('common.skip')} variant="secondary" onPress={() => finish(false)} />
            </>
          )}
          {step > 0 && <Button title={t('common.back')} variant="secondary" onPress={back} />}
        </View>
      </Screen>
    </SafeAreaView>
  );
}
