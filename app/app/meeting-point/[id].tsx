import * as Location from 'expo-location';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, StyleSheet } from 'react-native';

import OfflineMap from '@/components/OfflineMap';
import { View } from '@/components/Themed';
import { Button, Card, Label, Muted, Screen, TextField } from '@/components/ui';
import type { LatLon } from '@/lib/geo';
import { deleteMeetingPoint, getMeetingPoint, listMapAreas, saveMeetingPoint } from '@/lib/repo';
import { useDbQuery } from '@/lib/useDbQuery';
import { useGeocode } from '@/lib/useGeocode';

export default function MeetingPointScreen() {
  const db = useSQLiteContext();
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ id: string; lat?: string; lon?: string }>();
  const isNew = params.id === 'new';
  const { data: areas } = useDbQuery(listMapAreas);

  const [loaded, setLoaded] = useState(isNew);
  const [name, setName] = useState('');
  const [note, setNote] = useState('');
  const [address, setAddress] = useState('');
  const [point, setPoint] = useState<LatLon | null>(
    params.lat && params.lon ? { lat: Number(params.lat), lon: Number(params.lon) } : null
  );
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  // Only look the address up after the user edits it, so a saved or picked position is not overwritten.
  const [addressEdited, setAddressEdited] = useState(false);
  const geo = useGeocode(addressEdited ? address : '');

  useEffect(() => {
    if (geo.status === 'found') setPoint(geo.point);
  }, [geo]);

  useEffect(() => {
    if (isNew) return;
    getMeetingPoint(db, params.id).then((mp) => {
      if (mp) {
        setName(mp.name);
        setNote(mp.note ?? '');
        setAddress(mp.address ?? '');
        setPoint(mp.lat != null && mp.lon != null ? { lat: mp.lat, lon: mp.lon } : null);
        setPhotoUri(mp.photoUri);
      }
      setLoaded(true);
    });
  }, [db, isNew, params.id]);

  async function takeMyLocation() {
    const { granted } = await Location.requestForegroundPermissionsAsync();
    if (!granted) return Alert.alert(t('map.locationDenied'));
    const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
    setPoint({ lat: loc.coords.latitude, lon: loc.coords.longitude });
  }

  async function save() {
    await saveMeetingPoint(db, {
      id: isNew ? undefined : params.id,
      name: name.trim(),
      note: note.trim() || null,
      address: address.trim() || null,
      lat: point?.lat ?? null,
      lon: point?.lon ?? null,
      photoUri,
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
          await deleteMeetingPoint(db, params.id);
          router.back();
        },
      },
    ]);
  }

  if (!loaded) return null;

  return (
    <Screen>
      <Stack.Screen options={{ title: t(isNew ? 'meetingPoint.newTitle' : 'meetingPoint.editTitle') }} />
      <Label>{t('meetingPoint.name')}</Label>
      <TextField value={name} onChangeText={setName} placeholder={t('meetingPoint.namePlaceholder')} />
      <Label>{t('meetingPoint.note')}</Label>
      <TextField value={note} onChangeText={setNote} placeholder={t('meetingPoint.notePlaceholder')} multiline />
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

      <Card>
        <Label>{t('meetingPoint.position')}</Label>
        <Muted>{point ? `${point.lat.toFixed(5)}, ${point.lon.toFixed(5)}` : t('meetingPoint.positionNone')}</Muted>
        <Button title={t('meetingPoint.useMyLocation')} variant="secondary" onPress={takeMyLocation} />
        {areas?.length ? (
          <>
            <Muted>{t('meetingPoint.tapMapHint')}</Muted>
            <View style={styles.map}>
              <OfflineMap areas={areas} picked={point} onPress={setPoint} />
            </View>
          </>
        ) : (
          <Muted>{t('meetingPoint.noMapHint')}</Muted>
        )}
      </Card>

      <Button title={t('common.save')} onPress={save} disabled={!name.trim()} />
      {!isNew && <Button title={t('common.delete')} variant="danger" onPress={remove} />}
    </Screen>
  );
}

const styles = StyleSheet.create({
  map: { height: 260, borderRadius: 10, overflow: 'hidden' },
});
