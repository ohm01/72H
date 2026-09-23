// Foreground GPS position and compass heading for the map and the arrow screens.
import * as Location from 'expo-location';
import { useEffect, useState } from 'react';

import { arrowRotationDeg, bearingDeg, distanceM, type LatLon } from './geo';

export type PositionState = {
  position: (LatLon & { accuracy: number | null }) | null;
  denied: boolean;
};

/** Watches the position while the screen is mounted. Asks for permission once. */
export function usePosition(enabled = true): PositionState {
  const [state, setState] = useState<PositionState>({ position: null, denied: false });

  useEffect(() => {
    if (!enabled) return;
    let sub: Location.LocationSubscription | undefined;
    let active = true;
    (async () => {
      const { granted } = await Location.requestForegroundPermissionsAsync();
      if (!active) return;
      if (!granted) return setState({ position: null, denied: true });
      // Show something quickly, then refine.
      const last = await Location.getLastKnownPositionAsync();
      if (active && last) setState({ position: toPos(last), denied: false });
      const s = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, distanceInterval: 5 },
        (loc) => setState({ position: toPos(loc), denied: false })
      );
      if (active) sub = s;
      else s.remove();
    })().catch((e) => console.warn('location failed', e));
    return () => {
      active = false;
      sub?.remove();
    };
  }, [enabled]);

  return state;
}

const toPos = (l: Location.LocationObject) => ({
  lat: l.coords.latitude,
  lon: l.coords.longitude,
  accuracy: l.coords.accuracy,
});

/** Compass heading in degrees from true north (falls back to magnetic), null until known. */
export function useHeading(enabled = true): number | null {
  const [heading, setHeading] = useState<number | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let sub: Location.LocationSubscription | undefined;
    let active = true;
    Location.watchHeadingAsync((h) => setHeading(h.trueHeading >= 0 ? h.trueHeading : h.magHeading))
      .then((s) => {
        if (active) sub = s;
        else s.remove();
      })
      .catch((e) => console.warn('heading failed', e));
    return () => {
      active = false;
      sub?.remove();
    };
  }, [enabled]);

  return heading;
}

/** Arrived when closer than this (GPS in cities is often ±10–20 m). */
export const ARRIVED_M = 30;

export type Guidance = {
  distanceM: number | null;
  /** Arrow rotation on screen; relative to north when there is no compass. */
  rotation: number;
  hasCompass: boolean;
  arrived: boolean;
  accuracy: number | null;
  denied: boolean;
};

/** Distance and arrow direction from the current position to a target. */
export function useGuidance(target: LatLon | null): Guidance {
  const { position, denied } = usePosition(target != null);
  const heading = useHeading(target != null);
  if (!target || !position) {
    return { distanceM: null, rotation: 0, hasCompass: heading != null, arrived: false, accuracy: null, denied };
  }
  const d = distanceM(position, target);
  const bearing = bearingDeg(position, target);
  return {
    distanceM: d,
    rotation: arrowRotationDeg(bearing, heading ?? 0),
    hasCompass: heading != null,
    arrived: d < ARRIVED_M,
    accuracy: position.accuracy,
    denied,
  };
}
