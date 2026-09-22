import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert } from 'react-native';

import { View } from '@/components/Themed';
import { Button, Chip, ChipRow, DateField, Label, Muted, Screen, TextField } from '@/components/ui';
import { useLimits } from '@/lib/entitlement';
import { ensurePermission, syncReminders } from '@/lib/notifications';
import {
  DEFAULT_UNIT,
  ITEM_TYPES,
  type ItemType,
  type Location,
  UNITS,
  type Unit,
  deleteItem,
  getItem,
  listItems,
  listLocations,
  saveItem,
} from '@/lib/repo';

export default function ItemScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'new';
  const db = useSQLiteContext();
  const { t } = useTranslation();
  const limits = useLimits();

  const [locations, setLocations] = useState<Location[]>([]);
  const [name, setName] = useState('');
  const [type, setType] = useState<ItemType>('water');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState<Unit>('l');
  const [locationId, setLocationId] = useState<string | null>(null);
  const [expiresOn, setExpiresOn] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const locs = await listLocations(db);
      setLocations(locs);
      if (isNew) {
        setLocationId(locs[0]?.id ?? null);
        return;
      }
      const item = await getItem(db, id);
      if (!item) return router.back();
      setName(item.name);
      setType(item.type);
      setQuantity(String(item.quantity));
      setUnit(item.unit);
      setLocationId(item.locationId);
      setExpiresOn(item.expiresOn);
      setNote(item.note ?? '');
    })();
  }, [db, id, isNew]);

  function pickType(next: ItemType) {
    setType(next);
    if (isNew) setUnit(DEFAULT_UNIT[next]);
  }

  async function refreshReminders() {
    if (limits.expiryReminders && expiresOn) await ensurePermission();
    await syncReminders(await listItems(db), limits.expiryReminders);
  }

  async function onSave() {
    const qty = Number(quantity.replace(',', '.'));
    if (!name.trim()) return setError(t('item.errorName'));
    if (!(qty > 0)) return setError(t('item.errorQuantity'));
    if (!locationId) return setError(t('item.errorLocation'));
    await saveItem(db, {
      id: isNew ? undefined : id,
      name: name.trim(),
      type,
      quantity: qty,
      unit,
      locationId,
      expiresOn,
      note: note.trim() || null,
    });
    await refreshReminders();
    router.back();
  }

  function onDelete() {
    Alert.alert(t('common.confirmDelete', { name }), undefined, [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          await deleteItem(db, id);
          await refreshReminders();
          router.back();
        },
      },
    ]);
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: isNew ? t('item.newTitle') : t('item.editTitle') }} />

      <Label>{t('item.name')}</Label>
      <TextField value={name} onChangeText={setName} placeholder={t('item.namePlaceholder')} autoFocus={isNew} />

      <Label>{t('item.type')}</Label>
      <ChipRow>
        {ITEM_TYPES.map((it) => (
          <Chip key={it} label={t(`itemTypes.${it}`)} selected={type === it} onPress={() => pickType(it)} />
        ))}
      </ChipRow>

      <Label>{t('item.quantity')}</Label>
      <TextField value={quantity} onChangeText={setQuantity} keyboardType="decimal-pad" />
      <ChipRow>
        {UNITS.map((u) => (
          <Chip key={u} label={t(`unitNames.${u}`)} selected={unit === u} onPress={() => setUnit(u)} />
        ))}
      </ChipRow>
      {(type === 'water' || type === 'food') && <Muted>{t('item.readinessHint')}</Muted>}

      <Label>{t('item.location')}</Label>
      <ChipRow>
        {locations.map((l) => (
          <Chip key={l.id} label={l.name} selected={locationId === l.id} onPress={() => setLocationId(l.id)} />
        ))}
      </ChipRow>

      <Label>{`${t('item.expiresOn')} (${t('common.optional')})`}</Label>
      <DateField value={expiresOn} onChange={setExpiresOn} setLabel={t('item.setExpiry')} clearLabel={t('item.clearExpiry')} />

      <Label>{`${t('item.note')} (${t('common.optional')})`}</Label>
      <TextField value={note} onChangeText={setNote} multiline />

      {error && <Muted style={{ color: '#c62828' }}>{error}</Muted>}

      <View style={{ gap: 8, marginTop: 8 }}>
        <Button title={t('common.save')} onPress={onSave} />
        {!isNew && <Button title={t('common.delete')} variant="danger" onPress={onDelete} />}
      </View>
    </Screen>
  );
}
