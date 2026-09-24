import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Muted, Screen } from '@/components/ui';
import { parseInvite, savePendingInvite } from '@/lib/account';

/** Deep link app72h://join#<familyId>.<token>.<key>: keep the invite, then continue on the sharing screen. */
export default function JoinScreen() {
  const { t } = useTranslation();
  const url = Linking.useLinkingURL();
  const [invalid, setInvalid] = useState(false);

  useEffect(() => {
    if (!url) return;
    const invite = parseInvite(url);
    if (!invite) return setInvalid(true);
    void savePendingInvite(invite).then(() => router.replace('/share'));
  }, [url]);

  return <Screen>{invalid ? <Muted>{t('share.errors.invite_invalid')}</Muted> : null}</Screen>;
}
