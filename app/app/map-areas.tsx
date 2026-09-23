import * as Location from 'expo-location';
import { useSQLiteContext } from 'expo-sqlite';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, StyleSheet } from 'react-native';

import { View, useThemeColor } from '@/components/Themed';
import { Button, Card, Chip, ChipRow, Label, Muted, Screen, TextField, Title } from '@/components/ui';
import { ApiError } from '@/lib/api';
import { useLimits } from '@/lib/entitlement';
import { formatNumber } from '@/lib/format';
import type { LatLon } from '@/lib/geo';
import { downloadBlock, downloadsResetDate, radiusOptions } from '@/lib/mapAreas';
import { deleteAreaFile, downloadArea } from '@/lib/mapDownload';
import { countMapDownload, deleteMapArea, getMapDownloadsThisMonth, listMapAreas, saveMapArea } from '@/lib/repo';
import { useDbQuery } from '@/lib/useDbQuery';
import { usePosition } from '@/lib/useLocation';

type Status = { kind: 'idle' } | { kind: 'preparing' } | { kind: 'downloading'; fraction: number } | { kind: 'done' } | { kind: 'error'; message: string };

export default function MapAreasScreen() {
  const db = useSQLiteContext();
  const { t, i18n } = useTranslation();
  const limits = useLimits();
  const tint = useThemeColor({}, 'tint');
  const border = useThemeColor({}, 'border');
  const danger = useThemeColor({}, 'danger');

  const { data, reload } = useDbQuery(async (d) => ({
    areas: await listMapAreas(d),
    downloads: await getMapDownloadsThisMonth(d),
  }));

  const [source, setSource] = useState<'gps' | 'search'>('gps');
  const { position, denied } = usePosition(source === 'gps');
  const [query, setQuery] = useState('');
  const [found, setFound] = useState<LatLon | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [radiusKm, setRadiusKm] = useState(5);
  const [name, setName] = useState('');
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const abort = useRef<AbortController | null>(null);

  if (!data) return null;
  const { areas, downloads } = data;
  const reset = downloadsResetDate().toLocaleDateString(i18n.language);
  const block = downloadBlock(limits, areas.length, downloads);
  const center = source === 'gps' ? position : found;
  const options = center ? radiusOptions(center.lat, center.lon, limits.mapAreaMaxKm2) : [];
  const chosen = options.find((o) => o.radiusKm === radiusKm && o.allowed) ?? options.filter((o) => o.allowed).at(-1);
  const busy = status.kind === 'preparing' || status.kind === 'downloading';

  async function search() {
    setNotFound(false);
    try {
      const [hit] = await Location.geocodeAsync(query.trim());
      if (hit) setFound({ lat: hit.latitude, lon: hit.longitude });
      else setNotFound(true);
    } catch {
      setNotFound(true);
    }
  }

  async function download() {
    if (!chosen) return;
    const controller = new AbortController();
    abort.current = controller;
    setStatus({ kind: 'preparing' });
    try {
      const area = await downloadArea(
        chosen.bbox,
        name.trim() || t('mapAreas.defaultName', { n: areas.length + 1 }),
        (fraction) => setStatus({ kind: 'downloading', fraction }),
        controller.signal
      );
      await saveMapArea(db, area);
      await countMapDownload(db);
      setName('');
      setStatus({ kind: 'done' });
      reload();
    } catch (e) {
      if (controller.signal.aborted) return setStatus({ kind: 'idle' });
      setStatus({ kind: 'error', message: errorText(e) });
    }
  }

  function errorText(e: unknown): string {
    if (e instanceof ApiError) {
      const detail = (e.body as { detail?: unknown } | null)?.detail;
      if (e.status === 422 && typeof detail === 'string' && detail.includes('outside')) return t('mapAreas.errorOutside');
      if (e.status === 403 && detail && typeof detail === 'object' && 'maxKm2' in detail) {
        const d = detail as { areaKm2: number; maxKm2: number };
        return t('mapAreas.errorTooLarge', { area: formatNumber(d.areaKm2), max: formatNumber(d.maxKm2) });
      }
    }
    console.warn('map download failed', e);
    return t('mapAreas.errorNetwork');
  }

  function remove(id: string, areaName: string) {
    const area = areas.find((a) => a.id === id);
    if (!area) return;
    Alert.alert(t('common.confirmDelete', { name: areaName }), undefined, [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          deleteAreaFile(area);
          await deleteMapArea(db, id);
          reload();
        },
      },
    ]);
  }

  return (
    <Screen>
      <Muted>{t('mapAreas.hint')}</Muted>
      <Muted>
        {t('mapAreas.usage', {
          used: areas.length,
          max: limits.mapAreas,
          downloads,
          maxDownloads: limits.mapDownloadsPerMonth,
          reset,
        })}
      </Muted>

      {areas.map((a) => (
        <Card key={a.id}>
          <Title>{a.name}</Title>
          <Muted>
            {t('mapAreas.areaKm2', { km2: formatNumber(a.areaKm2) })} · {t('mapAreas.sizeMb', { mb: formatNumber(a.sizeBytes / 1e6) })}
          </Muted>
          <Button title={t('common.delete')} variant="danger" onPress={() => remove(a.id, a.name)} disabled={busy} />
        </Card>
      ))}

      {block ? (
        <Card>
          <Muted>
            {block === 'areas'
              ? t('mapAreas.blockAreas', { max: limits.mapAreas })
              : t('mapAreas.blockDownloads', { max: limits.mapDownloadsPerMonth, reset })}
          </Muted>
        </Card>
      ) : (
        <Card>
          <Label>{t('mapAreas.center')}</Label>
          <ChipRow>
            <Chip label={t('mapAreas.myLocation')} selected={source === 'gps'} onPress={() => setSource('gps')} />
            <Chip label={t('mapAreas.search')} selected={source === 'search'} onPress={() => setSource('search')} />
          </ChipRow>
          {source === 'gps' && denied && <Muted>{t('map.locationDenied')}</Muted>}
          {source === 'search' && (
            <View style={styles.row}>
              <TextField style={styles.grow} value={query} onChangeText={setQuery} placeholder={t('mapAreas.search')} onSubmitEditing={search} returnKeyType="search" />
              <Button title={t('mapAreas.searchButton')} variant="secondary" onPress={search} disabled={!query.trim()} />
            </View>
          )}
          {notFound && source === 'search' && <Muted>{t('mapAreas.notFound')}</Muted>}
          {center && <Muted>{`${center.lat.toFixed(4)}, ${center.lon.toFixed(4)}`}</Muted>}

          {options.length > 0 && (
            <>
              <Label>{t('mapAreas.size')}</Label>
              <ChipRow>
                {options
                  .filter((o) => o.allowed)
                  .map((o) => (
                    <Chip
                      key={o.radiusKm}
                      label={`${t('mapAreas.side', { side: o.radiusKm * 2 })} · ${t('mapAreas.areaKm2', { km2: formatNumber(Math.round(o.areaKm2)) })}`}
                      selected={chosen?.radiusKm === o.radiusKm}
                      onPress={() => setRadiusKm(o.radiusKm)}
                    />
                  ))}
              </ChipRow>
              {options.some((o) => !o.allowed) && <Muted>{t('mapAreas.sizePlus')}</Muted>}
            </>
          )}

          <Label>{t('mapAreas.name')}</Label>
          <TextField value={name} onChangeText={setName} placeholder={t('mapAreas.defaultName', { n: areas.length + 1 })} />

          {status.kind === 'preparing' && <Muted>{t('mapAreas.preparing')}</Muted>}
          {status.kind === 'downloading' && (
            <>
              <Muted>{t('mapAreas.downloading', { percent: Math.round(status.fraction * 100) })}</Muted>
              <View style={[styles.bar, { borderColor: border }]}>
                <View style={[styles.fill, { width: `${Math.round(status.fraction * 100)}%`, backgroundColor: tint }]} />
              </View>
            </>
          )}
          {status.kind === 'done' && <Muted>{t('mapAreas.done')}</Muted>}
          {status.kind === 'error' && <Muted style={{ color: danger }}>{status.message}</Muted>}

          {busy ? (
            <Button title={t('common.cancel')} variant="secondary" onPress={() => abort.current?.abort()} />
          ) : (
            <Button title={t('mapAreas.download')} onPress={download} disabled={!chosen} />
          )}
        </Card>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  grow: { flex: 1 },
  bar: { height: 10, borderWidth: 1, borderRadius: 5, overflow: 'hidden' },
  fill: { height: '100%' },
});
