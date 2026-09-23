import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Linking, StyleSheet } from 'react-native';

import { View } from '@/components/Themed';
import EmergencyNumbers from '@/components/EmergencyNumbers';
import { Button, Card, Muted, Screen, Title } from '@/components/ui';
import { emergencyFor } from '@/lib/emergency';
import { listContacts } from '@/lib/repo';
import { telHref } from '@/lib/targets';
import { useDbQuery } from '@/lib/useDbQuery';
import { loadStandard } from '@/lib/useStandard';

/** Family contacts, readable offline. Members, invites and sharing arrive with accounts (M3). */
export default function FamilyScreen() {
  const { t } = useTranslation();
  const { data } = useDbQuery(async (db) => ({ contacts: await listContacts(db), home: (await loadStandard(db)).home }));

  if (!data) return null;
  const { contacts, home } = data;

  return (
    <Screen>
      <EmergencyNumbers emergency={emergencyFor(home)} />
      <Muted>{t('contacts.hint')}</Muted>
      {contacts.map((c) => (
        <Card key={c.id}>
          <Title>{c.name}</Title>
          <Muted>{[c.relation, c.phone].filter(Boolean).join(' · ')}</Muted>
          {c.address ? <Muted>{c.address}</Muted> : null}
          <View style={styles.row}>
            {c.phone ? (
              <View style={styles.grow}>
                <Button title={t('contacts.call')} onPress={() => Linking.openURL(telHref(c.phone!))} />
              </View>
            ) : null}
            {c.lat != null && c.lon != null ? (
              <View style={styles.grow}>
                <Button title={t('map.navigate')} variant="secondary" onPress={() => router.push(`/navigate/${c.id}?kind=contact`)} />
              </View>
            ) : null}
            <View style={styles.grow}>
              <Button title={t('common.edit')} variant="secondary" onPress={() => router.push(`/contact/${c.id}`)} />
            </View>
          </View>
        </Card>
      ))}
      <Button title={t('contacts.add')} variant={contacts.length ? 'secondary' : 'primary'} onPress={() => router.push('/contact/new')} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8, backgroundColor: 'transparent' },
  grow: { flex: 1, backgroundColor: 'transparent' },
});
