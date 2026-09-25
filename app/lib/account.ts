// Account + family on this phone. Session token and family key live in the Keychain/Keystore (SecureStore), never in SQLite.
import * as SecureStore from 'expo-secure-store';

import { apiRequest } from './api';
import { fromBase64, KEY_BYTES, newFamilyKey, toBase64Url } from './crypto';

const SESSION = 'session';
const FAMILY_KEY = 'familyKey';
const FAMILY_ID = 'familyId';
const PENDING_INVITE = 'pendingInvite';

export type Session = { token: string; userId: string; email: string };
export type Member = { userId: string; email: string; role: 'admin' | 'member'; status: 'pending' | 'active' };
export type Family = { id: string; myRole: 'admin' | 'member'; myStatus: 'pending' | 'active'; members: Member[] };
export type Invite = { familyId: string; token: string; key: string };

const INVITE_BASE = `${process.env.EXPO_PUBLIC_API_URL ?? 'https://api.rodinnapripravenost.cz'}/join`;

export async function getSession(): Promise<Session | null> {
  const raw = await SecureStore.getItemAsync(SESSION);
  return raw ? (JSON.parse(raw) as Session) : null;
}

export async function startLogin(email: string, lang: string): Promise<void> {
  await apiRequest('POST', '/v1/auth/email/start', { body: { email, lang } });
}

export async function finishLogin(email: string, code: string, deviceName: string): Promise<Session> {
  const session = await apiRequest<Session>('POST', '/v1/auth/email/verify', { body: { email, code, deviceName } });
  await SecureStore.setItemAsync(SESSION, JSON.stringify(session));
  return session;
}

export async function logout(): Promise<void> {
  const s = await getSession();
  if (s) await apiRequest('POST', '/v1/auth/logout', { token: s.token }).catch(() => {});
  await SecureStore.deleteItemAsync(SESSION);
}

/** Family of the signed-in user, or null (no account or no family). */
export async function loadFamily(session: Session): Promise<Family | null> {
  try {
    return await apiRequest<Family>('GET', '/v1/family', { token: session.token });
  } catch (e) {
    if ((e as { status?: number }).status === 404) return null;
    throw e;
  }
}

export async function createFamily(session: Session): Promise<Family> {
  const family = await apiRequest<Family>('POST', '/v1/families', { token: session.token });
  await setFamilyKey(family.id, newFamilyKey());
  return family;
}

export async function getFamilyKey(): Promise<Uint8Array | null> {
  const raw = await SecureStore.getItemAsync(FAMILY_KEY);
  return raw ? fromBase64(raw) : null;
}

/** Which family the stored key belongs to (sync starts over when it changes). */
export async function getFamilyId(): Promise<string | null> {
  return SecureStore.getItemAsync(FAMILY_ID);
}

async function setFamilyKey(familyId: string, key: Uint8Array): Promise<void> {
  await SecureStore.setItemAsync(FAMILY_KEY, toBase64Url(key));
  await SecureStore.setItemAsync(FAMILY_ID, familyId);
}

export async function forgetFamily(): Promise<void> {
  await SecureStore.deleteItemAsync(FAMILY_KEY);
  await SecureStore.deleteItemAsync(FAMILY_ID);
}

/** Invite link: the key rides in the #fragment, which is never sent to the server. */
export async function createInviteLink(session: Session): Promise<string> {
  const key = await getFamilyKey();
  if (!key) throw new Error('no family key on this phone');
  const inv = await apiRequest<{ familyId: string; token: string }>('POST', '/v1/family/invites', { token: session.token });
  return `${INVITE_BASE}#${inv.familyId}.${inv.token}.${toBase64Url(key)}`;
}

/** Accepts the https link, the app72h:// deep link or just the fragment. */
export function parseInvite(link: string): Invite | null {
  const fragment = link.includes('#') ? link.slice(link.indexOf('#') + 1) : link;
  const [familyId, token, key] = fragment.split('.');
  if (!familyId || !token || !key || !/^[0-9a-f-]{36}$/i.test(familyId)) return null;
  try {
    if (fromBase64(key).length !== KEY_BYTES) return null;
  } catch {
    return null;
  }
  return { familyId, token, key };
}

/** Kept until the user signs in, so opening an invite first and logging in second still works. */
export async function savePendingInvite(invite: Invite | null): Promise<void> {
  if (invite) await SecureStore.setItemAsync(PENDING_INVITE, JSON.stringify(invite));
  else await SecureStore.deleteItemAsync(PENDING_INVITE);
}

export async function getPendingInvite(): Promise<Invite | null> {
  const raw = await SecureStore.getItemAsync(PENDING_INVITE);
  return raw ? (JSON.parse(raw) as Invite) : null;
}

export async function joinFamily(session: Session, invite: Invite): Promise<Family> {
  const family = await apiRequest<Family>('POST', '/v1/families/join', {
    token: session.token,
    body: { familyId: invite.familyId, token: invite.token },
  });
  await setFamilyKey(invite.familyId, fromBase64(invite.key));
  await savePendingInvite(null);
  return family;
}

export async function approveMember(session: Session, userId: string): Promise<void> {
  await apiRequest('POST', `/v1/family/members/${userId}/approve`, { token: session.token });
}

/** userId 'me' = leave the family. */
export async function removeMember(session: Session, userId: string): Promise<void> {
  await apiRequest('DELETE', `/v1/family/members/${userId}`, { token: session.token });
  if (userId === 'me') await forgetFamily();
}

export async function exportAccount(session: Session): Promise<unknown> {
  return apiRequest('GET', '/v1/me/export', { token: session.token });
}

export async function deleteAccount(session: Session): Promise<void> {
  await apiRequest('DELETE', '/v1/me', { token: session.token });
  await forgetFamily();
  await SecureStore.deleteItemAsync(SESSION);
}
