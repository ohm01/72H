import { Link, router } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet } from 'react-native';

import GobagCard from '@/components/GobagCard';
import { Text, View } from '@/components/Themed';
import { Button, Card, Chip, ChipRow, Label, Muted, Screen, Title } from '@/components/ui';
import { ExpiryColors } from '@/constants/Colors';
import { compareByExpiry, expiryStatus } from '@/lib/expiry';
import { daysText, expiryText, quantityText } from '@/lib/format';
import { loadBags } from '@/lib/gobags';
import { computeReadiness, readinessByLocation } from '@/lib/readiness';
import { getHousehold, listItems, listLocations } from '@/lib/repo';
import { useDbQuery } from '@/lib/useDbQuery';
import { loadStandard, waterPerDay } from '@/lib/useStandard';

async function loadStock(db: Parameters<typeof listItems>[0]) {
  const [items, locations, household, standard] = await Promise.all([
    listItems(db),
    listLocations(db),
    getHousehold(db),
    loadStandard(db),
  ]);
  return { items, locations, household, standard, bags: await loadBags(db, household) };
}

export default function StockScreen() {
  const { t } = useTranslation();
  const { data } = useDbQuery(loadStock);
  const [filter, setFilter] = useState<string | null>(null);

  const view = useMemo(() => {
    if (!data) return null;
    const { items, locations, household, standard } = data;
    const water = waterPerDay(standard);
    const total = computeReadiness(items, household.persons, new Date(), water);
    const perLocation = readinessByLocation(items, household.persons, new Date(), water);
    const visible = items.filter((i) => !filter || i.locationId === filter).sort(compareByExpiry);
    const locationName = Object.fromEntries(locations.map((l) => [l.id, l.name]));
    return { total, perLocation, visible, locationName, locations, household, target: standard.rec.selfSufficiencyDays };
  }, [data, filter]);

  if (!view) return null;
  const target = view.target;
  const days = (n: number) => daysText(t, n);

  return (
    <Screen>
      <Card>
        <Label>{t('stock.readinessTitle')}</Label>
        <Text style={styles.big}>{t('stock.readinessValue', { days: days(view.total.days), target: days(target) })}</Text>
        <Muted>
          {t('stock.readinessHint', {
            persons: view.household.persons,
            water: days(view.total.waterDays),
            food: days(view.total.foodDays),
          })}
        </Muted>
        {view.total.days < target && <Muted>{t('stock.readinessGoal')}</Muted>}
        {view.locations.length > 1 && (
          <>
            <Label>{t('stock.byLocation')}</Label>
            {view.locations.map((l) => (
              <View key={l.id} style={styles.row}>
                <Text>{l.name}</Text>
                <Text>{days(view.perLocation[l.id]?.days ?? 0)}</Text>
              </View>
            ))}
          </>
        )}
      </Card>

      <GobagCard bags={data!.bags} />

      <Button title={t('stock.addItem')} onPress={() => router.push('/item/new')} />
      <View style={styles.links}>
        <Link href="/checklist" style={styles.link}>
          <Text style={styles.linkText}>{t('stock.checklist')}</Text>
        </Link>
        <Link href="/locations" style={styles.link}>
          <Text style={styles.linkText}>{t('stock.locations')}</Text>
        </Link>
      </View>

      {view.locations.length > 1 && (
        <ChipRow>
          <Chip label={t('common.all')} selected={filter === null} onPress={() => setFilter(null)} />
          {view.locations.map((l) => (
            <Chip key={l.id} label={l.name} selected={filter === l.id} onPress={() => setFilter(l.id)} />
          ))}
        </ChipRow>
      )}

      <Title>{t('stock.items')}</Title>
      {view.visible.length === 0 && <Muted>{t('stock.empty')}</Muted>}
      {view.visible.map((item) => {
        const status = expiryStatus(item.expiresOn);
        return (
          <Pressable key={item.id} onPress={() => router.push(`/item/${item.id}`)}>
            <Card style={{ borderLeftWidth: 6, borderLeftColor: ExpiryColors[status] }}>
              <View style={styles.row}>
                <Text style={styles.itemName}>{item.name}</Text>
                <Text>{quantityText(t, item.quantity, item.unit)}</Text>
              </View>
              <View style={styles.row}>
                <Muted>{`${t(`itemTypes.${item.type}`)} · ${view.locationName[item.locationId] ?? ''}`}</Muted>
                <Text style={{ color: status === 'green' || status === 'none' ? undefined : ExpiryColors[status] }}>
                  {expiryText(t, item.expiresOn)}
                </Text>
              </View>
            </Card>
          </Pressable>
        );
      })}
    </Screen>
  );
}

const styles = StyleSheet.create({
  big: { fontSize: 28, fontWeight: '700' },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  itemName: { fontSize: 16, fontWeight: '600', flexShrink: 1 },
  links: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  link: { paddingVertical: 6 },
  linkText: { color: '#2e78b7', fontSize: 15 },
});
