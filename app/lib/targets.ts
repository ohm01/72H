// Something the arrow can lead to: a meeting point or a family contact with a known address.
import type { Href } from 'expo-router';
import type { SQLiteDatabase } from 'expo-sqlite';

import { getContact, getMeetingPoint } from './repo';

export type TargetKind = 'meeting' | 'contact';

export type Target = {
  id: string;
  kind: TargetKind;
  name: string;
  note: string | null;
  address: string | null;
  lat: number | null;
  lon: number | null;
};

export async function loadTarget(db: SQLiteDatabase, id: string, kind: TargetKind = 'meeting'): Promise<Target | null> {
  if (kind === 'contact') {
    const c = await getContact(db, id);
    if (!c) return null;
    const note = [c.relation, c.note].filter(Boolean).join(' · ') || null;
    return { id: c.id, kind, name: c.name, note, address: c.address, lat: c.lat, lon: c.lon };
  }
  const mp = await getMeetingPoint(db, id);
  return mp && { id: mp.id, kind, name: mp.name, note: mp.note, address: mp.address, lat: mp.lat, lon: mp.lon };
}

/** Edit screen for a target. */
export const editHref = (t: Pick<Target, 'id' | 'kind'>): Href => (t.kind === 'contact' ? `/contact/${t.id}` : `/meeting-point/${t.id}`) as Href;

/** Link query suffix for navigate/kids screens. */
export const kindQuery = (kind: TargetKind) => (kind === 'contact' ? '?kind=contact' : '');

/** Phone number usable in a tel: link. */
export const telHref = (phone: string) => `tel:${phone.replace(/[^\d+]/g, '')}`;
