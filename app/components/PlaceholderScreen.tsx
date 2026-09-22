import { StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Text, View } from '@/components/Themed';

// Temporary content for tabs that are not implemented yet.
export default function PlaceholderScreen({ titleKey }: { titleKey: string }) {
  const { t } = useTranslation();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t(titleKey)}</Text>
      <Text style={styles.subtitle}>{t('common.comingSoon')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  subtitle: {
    marginTop: 8,
    opacity: 0.6,
  },
});
