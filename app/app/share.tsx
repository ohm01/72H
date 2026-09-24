import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Platform, Share, StyleSheet } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { View, useThemeColor } from '@/components/Themed';
import { Button, Card, Label, Muted, Screen, TextField, Title } from '@/components/ui';
import {
  approveMember,
  createFamily,
  createInviteLink,
  deleteAccount,
  exportAccount,
  finishLogin,
  getPendingInvite,
  getSession,
  joinFamily,
  loadFamily,
  logout,
  removeMember,
  startLogin,
  type Family,
  type Invite,
  type Session,
} from '@/lib/account';
import { ApiError, errorCode } from '@/lib/api';

type State = { session: Session | null; family: Family | null; invite: Invite | null };

/** Opt-in family sharing: sign in with an emailed code, create or join a family, invite members. */
export default function ShareScreen() {
  const { t, i18n } = useTranslation();
  const danger = useThemeColor({}, 'danger');
  const [state, setState] = useState<State | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState('');
  const [codeSentTo, setCodeSentTo] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [inviteLink, setInviteLink] = useState<string | null>(null);

  function message(e: unknown): string {
    const code_ = errorCode(e);
    if (code_ && i18n.exists(`share.errors.${code_}`)) return t(`share.errors.${code_}`);
    if (!(e instanceof ApiError)) return t('share.errors.network');
    console.warn('share failed', e);
    return t('share.errors.network');
  }

  const load = useCallback(async () => {
    try {
      const session = await getSession();
      let invite = await getPendingInvite();
      let family = session ? await loadFamily(session) : null;
      // Invite opened before signing in: join as soon as we have a session.
      if (session && invite && !family) {
        family = await joinFamily(session, invite);
        invite = null;
      }
      setState({ session, family, invite });
    } catch (e) {
      setError(message(e));
      setState((s) => s ?? { session: null, family: null, invite: null });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }

  if (!state) return null;
  const { session, family, invite } = state;
  const isAdmin = family?.myRole === 'admin';

  return (
    <Screen>
      {!session ? (
        <Card>
          {invite ? <Title>{t('share.inviteWaiting')}</Title> : null}
          <Muted>{t('share.intro')}</Muted>
          {codeSentTo === null ? (
            <>
              <Label>{t('share.email')}</Label>
              <TextField
                value={email}
                onChangeText={setEmail}
                placeholder={t('share.emailPlaceholder')}
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
              />
              <Button
                title={t('share.sendCode')}
                disabled={busy || !email.trim()}
                onPress={() =>
                  run(async () => {
                    await startLogin(email.trim(), i18n.language);
                    setCodeSentTo(email.trim());
                  })
                }
              />
            </>
          ) : (
            <>
              <Muted>{t('share.codeSent', { email: codeSentTo })}</Muted>
              <Label>{t('share.code')}</Label>
              <TextField value={code} onChangeText={setCode} keyboardType="number-pad" autoComplete="one-time-code" maxLength={6} />
              <Button
                title={t('share.login')}
                disabled={busy || code.length !== 6}
                onPress={() =>
                  run(async () => {
                    await finishLogin(codeSentTo, code, Platform.OS);
                    setCode('');
                    setCodeSentTo(null);
                    await load();
                  })
                }
              />
              <Button title={t('share.otherEmail')} variant="secondary" onPress={() => setCodeSentTo(null)} />
            </>
          )}
        </Card>
      ) : !family ? (
        <Card>
          <Muted>{t('share.noFamily')}</Muted>
          <Button title={t('share.createFamily')} disabled={busy} onPress={() => run(async () => void (await createFamily(session), await load()))} />
        </Card>
      ) : (
        <>
          {family.myStatus === 'pending' ? (
            <Card>
              <Muted>{t('share.pendingApproval')}</Muted>
              <Button title={t('share.refresh')} variant="secondary" onPress={() => run(load)} />
            </Card>
          ) : null}
          <Card>
            <Label>{t('share.members')}</Label>
            {family.members.map((m) => (
              <View key={m.userId} style={styles.member}>
                <Title>{m.email}</Title>
                <Muted>
                  {[m.role === 'admin' ? t('share.admin') : null, m.status === 'pending' ? t('share.pending') : null]
                    .filter(Boolean)
                    .join(' · ')}
                </Muted>
                {isAdmin && m.userId !== session.userId ? (
                  <View style={styles.row}>
                    {m.status === 'pending' ? (
                      <View style={styles.grow}>
                        <Button title={t('share.approve')} disabled={busy} onPress={() => run(async () => void (await approveMember(session, m.userId), await load()))} />
                      </View>
                    ) : null}
                    <View style={styles.grow}>
                      <Button
                        title={m.status === 'pending' ? t('share.reject') : t('share.remove')}
                        variant="secondary"
                        disabled={busy}
                        onPress={() => run(async () => void (await removeMember(session, m.userId), await load()))}
                      />
                    </View>
                  </View>
                ) : null}
              </View>
            ))}
          </Card>

          {isAdmin ? (
            <Card>
              <Label>{t('share.invite')}</Label>
              {inviteLink ? (
                <>
                  <View style={styles.qr}>
                    <QRCode value={inviteLink} size={220} />
                  </View>
                  <Muted>{t('share.inviteHint')}</Muted>
                  <Button title={t('share.shareLink')} variant="secondary" onPress={() => Share.share({ message: t('share.inviteMessage', { link: inviteLink }) })} />
                </>
              ) : (
                <Button title={t('share.createInvite')} disabled={busy} onPress={() => run(async () => setInviteLink(await createInviteLink(session)))} />
              )}
            </Card>
          ) : null}

          <Button
            title={t('share.leave')}
            variant="secondary"
            disabled={busy}
            onPress={() =>
              Alert.alert(t('share.leaveConfirm'), undefined, [
                { text: t('common.cancel'), style: 'cancel' },
                { text: t('share.leave'), style: 'destructive', onPress: () => run(async () => void (await removeMember(session, 'me'), setInviteLink(null), await load())) },
              ])
            }
          />
        </>
      )}

      {error ? <Muted style={{ color: danger }}>{error}</Muted> : null}

      {session ? (
        <Card>
          <Label>{t('share.account')}</Label>
          <Muted>{t('share.signedInAs', { email: session.email })}</Muted>
          <Button
            title={t('share.export')}
            variant="secondary"
            disabled={busy}
            onPress={() => run(async () => void (await Share.share({ message: JSON.stringify(await exportAccount(session), null, 2) })))}
          />
          <Button title={t('share.logout')} variant="secondary" disabled={busy} onPress={() => run(async () => void (await logout(), setInviteLink(null), await load()))} />
          <Button
            title={t('share.deleteAccount')}
            variant="danger"
            disabled={busy}
            onPress={() =>
              Alert.alert(t('share.deleteConfirm'), undefined, [
                { text: t('common.cancel'), style: 'cancel' },
                { text: t('common.delete'), style: 'destructive', onPress: () => run(async () => void (await deleteAccount(session), setInviteLink(null), await load())) },
              ])
            }
          />
        </Card>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  member: { gap: 4, paddingVertical: 6, backgroundColor: 'transparent' },
  row: { flexDirection: 'row', gap: 8, backgroundColor: 'transparent' },
  grow: { flex: 1, backgroundColor: 'transparent' },
  qr: { alignItems: 'center', padding: 16, backgroundColor: '#ffffff', borderRadius: 8 },
});
