import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert } from 'react-native';

import { Button, Label, Muted, Screen, TextField } from '@/components/ui';
import type { LatLon } from '@/lib/geo';
import { deleteContact, getContact, saveContact } from '@/lib/repo';
import { useGeocode } from '@/lib/useGeocode';

export default function ContactScreen() {
  const db = useSQLiteContext();
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'new';

  const [loaded, setLoaded] = useState(isNew);
  const [name, setName] = useState('');
  const [relation, setRelation] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [note, setNote] = useState('');
  const [point, setPoint] = useState<LatLon | null>(null);
  // Look the address up only after the user edits it (keeps a saved position otherwise).
  const [addressEdited, setAddressEdited] = useState(false);
  const geo = useGeocode(addressEdited ? address : '');

  useEffect(() => {
    if (isNew) return;
    getContact(db, id).then((c) => {
      if (c) {
        setName(c.name);
        setRelation(c.relation ?? '');
        setPhone(c.phone ?? '');
        setAddress(c.address ?? '');
        setNote(c.note ?? '');
        setPoint(c.lat != null && c.lon != null ? { lat: c.lat, lon: c.lon } : null);
      }
      setLoaded(true);
    });
  }, [db, id, isNew]);

  useEffect(() => {
    if (geo.status === 'found') setPoint(geo.point);
    // An address that cannot be found must not keep an old position.
    if (geo.status === 'notFound') setPoint(null);
  }, [geo]);

  async function save() {
    await saveContact(db, {
      id: isNew ? undefined : id,
      name: name.trim(),
      relation: relation.trim() || null,
      phone: phone.trim() || null,
      address: address.trim() || null,
      lat: point?.lat ?? null,
      lon: point?.lon ?? null,
      note: note.trim() || null,
    });
    router.back();
  }

  function remove() {
    Alert.alert(t('common.confirmDelete', { name }), undefined, [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          await deleteContact(db, id);
          router.back();
        },
      },
    ]);
  }

  if (!loaded) return null;

  return (
    <Screen>
      <Stack.Screen options={{ title: t(isNew ? 'contacts.newTitle' : 'contacts.editTitle') }} />
      <Label>{t('contacts.name')}</Label>
      <TextField value={name} onChangeText={setName} placeholder={t('contacts.namePlaceholder')} />
      <Label>{t('contacts.relation')}</Label>
      <TextField value={relation} onChangeText={setRelation} placeholder={t('contacts.relationPlaceholder')} />
      <Label>{t('contacts.phone')}</Label>
      <TextField value={phone} onChangeText={setPhone} keyboardType="phone-pad" textContentType="telephoneNumber" placeholder="+420 …" />
      <Label>{t('meetingPoint.address')}</Label>
      <TextField
        value={address}
        onChangeText={(v) => {
          setAddress(v);
          setAddressEdited(true);
        }}
        placeholder={t('meetingPoint.addressPlaceholder')}
      />
      {geo.status === 'searching' && <Muted>{t('geocode.searching')}</Muted>}
      {geo.status === 'found' && <Muted>{t('geocode.found', { label: geo.label || `${geo.point.lat.toFixed(4)}, ${geo.point.lon.toFixed(4)}` })}</Muted>}
      {geo.status === 'notFound' && <Muted>{t('geocode.notFound')}</Muted>}
      <Label>{`${t('meetingPoint.note')} (${t('common.optional')})`}</Label>
      <TextField value={note} onChangeText={setNote} multiline />

      <Button title={t('common.save')} onPress={save} disabled={!name.trim() || (!phone.trim() && !address.trim())} />
      {!isNew && <Button title={t('common.delete')} variant="danger" onPress={remove} />}
    </Screen>
  );
}
