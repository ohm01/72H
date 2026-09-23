import { Camera, LogManager, Map, Marker, NativeUserLocation } from '@maplibre/maplibre-react-native';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, type ViewStyle } from 'react-native';

import { View, useThemeColor } from '@/components/Themed';
import { useColorScheme } from '@/components/useColorScheme';
import type { LatLon } from '@/lib/geo';
import { assetsDir } from '@/lib/mapDownload';
import { buildOfflineStyle, unionBBox } from '@/lib/mapStyle';
import type { MapArea, MeetingPoint } from '@/lib/repo';

// Fonts cover Latin, Greek and Cyrillic only (scripts/fetch-map-assets.sh). Labels in other scripts
// just lose those characters; that is expected offline, so don't report it as an error.
LogManager.onLog(({ message }) => message.includes('Failed to load glyph range'));

type Props = {
  areas: MapArea[];
  meetingPoints?: MeetingPoint[];
  /** Extra highlighted point, e.g. the position being picked for a meeting point. */
  picked?: LatLon | null;
  showUser?: boolean;
  onPress?: (p: LatLon) => void;
  onLongPress?: (p: LatLon) => void;
  style?: ViewStyle;
};

/** Map rendered only from downloaded files: works in airplane mode. */
export default function OfflineMap({ areas, meetingPoints = [], picked, showUser = true, onPress, onLongPress, style }: Props) {
  const { i18n } = useTranslation();
  const dark = useColorScheme() === 'dark';
  const tint = useThemeColor({}, 'tint');
  const danger = useThemeColor({}, 'danger');

  const mapStyle = useMemo(
    () => buildOfflineStyle(areas, assetsDir().uri, { dark, lang: i18n.language }),
    [areas, dark, i18n.language]
  );
  const bounds = unionBBox(areas);
  const located = meetingPoints.filter((m) => m.lat != null && m.lon != null);

  return (
    <Map
      style={[styles.map, style]}
      mapStyle={mapStyle}
      logo={false}
      compass
      attribution
      onPress={onPress && ((e) => onPress({ lon: e.nativeEvent.lngLat[0], lat: e.nativeEvent.lngLat[1] }))}
      onLongPress={onLongPress && ((e) => onLongPress({ lon: e.nativeEvent.lngLat[0], lat: e.nativeEvent.lngLat[1] }))}>
      <Camera
        initialViewState={
          picked
            ? { center: [picked.lon, picked.lat], zoom: 15 }
            : bounds
              ? { bounds: [bounds.west, bounds.south, bounds.east, bounds.north] }
              : undefined
        }
        minZoom={6}
        maxZoom={16}
      />
      {showUser && <NativeUserLocation mode="heading" />}
      {located.map((m) => (
        <Marker key={m.id} id={m.id} lngLat={[m.lon!, m.lat!]} anchor="bottom">
          <View style={[styles.pin, { backgroundColor: tint }]} accessibilityLabel={m.name} />
        </Marker>
      ))}
      {picked && (
        <Marker id="picked" lngLat={[picked.lon, picked.lat]} anchor="center">
          <View style={[styles.picked, { borderColor: danger }]} />
        </Marker>
      )}
    </Map>
  );
}

const styles = StyleSheet.create({
  map: { flex: 1 },
  pin: { width: 22, height: 22, borderRadius: 11, borderWidth: 3, borderColor: '#ffffff' },
  picked: { width: 26, height: 26, borderRadius: 13, borderWidth: 4, backgroundColor: 'transparent' },
});
