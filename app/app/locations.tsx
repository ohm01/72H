import { type Href, router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, StyleSheet } from 'react-native';

import { View } from '@/components/Themed';
import { Button, Card, Muted, Screen, TextField } from '@/components/ui';
import { useLimits } from '@/lib/entitlement';
import { syncReminders } from '@/lib/notifications';
import { listBags } from '@/lib/gobags';
import { deleteLocation, listItems, listLocations, saveLocation } from '@/lib/repo';
import { useDbQuery } from '@/lib/useDbQuery';

export default function LocationsScreen() {
  const db = useSQLiteContext();
  const { t } = useTranslation();
  const limits = useLimits();
  const { data, reload } = useDbQuery(async (d) => ({ locations: await listLocations(d), bags: await listBags(d) }));
  const locations = data?.locations;
  const bagIds = new Set(data?.bags.map((b) => b.id));
  const [newName, setNewName] = useState('');
  const [edits, setEdits] = useState<Record<string, string>>({});

  async function add() {
    if (!newName.trim()) return;
    await saveLocation(db, { name: newName.trim(), lat: null, lon: null });
    setNewName('');
    reload();
  }

  async function rename(id: string) {
    const name = edits[id]?.trim();
    const loc = locations?.find((l) => l.id === id);
    if (!name || !loc || name === loc.name) return;
    await saveLocation(db, { ...loc, name });
    reload();
  }

  async function remove(id: string, name: string) {
    // The last location stays: items always need one.
    if ((locations?.length ?? 0) <= 1) return;
    const count = (await listItems(db)).filter((i) => i.locationId === id).length;
    Alert.alert(t('common.confirmDelete', { name }), count ? t('locations.deleteWarning', { count }) : undefined, [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          await deleteLocation(db, id);
          // Its items are gone too: drop their expiry reminders.
          await syncReminders(await listItems(db), limits.expiryReminders);
          reload();
        },
      },
    ]);
  }

  return (
    <Screen>
      <Muted>{t('locations.hint')}</Muted>
      {locations?.map((l) => (
        <Card key={l.id}>
          <TextField
            value={edits[l.id] ?? l.name}
            onChangeText={(v) => setEdits((e) => ({ ...e, [l.id]: v }))}
            onEndEditing={() => rename(l.id)}
          />
          {bagIds.has(l.id) && (
            <Button title={t('guides.whatToPack')} variant="secondary" onPress={() => router.push(`/guide/gobag?bag=${l.id}` as Href)} />
          )}
          {(locations?.length ?? 0) > 1 && <Button title={t('common.delete')} variant="danger" onPress={() => remove(l.id, l.name)} />}
        </Card>
      ))}
      <Card>
        <View style={styles.addRow}>
          <TextField style={{ flex: 1 }} value={newName} onChangeText={setNewName} placeholder={t('locations.namePlaceholder')} />
        </View>
        <Button title={t('locations.add')} onPress={add} disabled={!newName.trim()} />
      </Card>
      {bagIds.size === 0 && (
        <Card>
          <Muted>{t('guides.gobagOffer')}</Muted>
          <Button title={t('guides.prepareGobag')} variant="secondary" onPress={() => router.push('/gobag-setup')} />
        </Card>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  addRow: { flexDirection: 'row', gap: 8 },
});
