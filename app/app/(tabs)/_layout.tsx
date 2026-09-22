import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { Tabs } from 'expo-router';
import { useTranslation } from 'react-i18next';

import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { useClientOnlyValue } from '@/components/useClientOnlyValue';

type TabDef = {
  name: string;
  titleKey: string;
  icon: SymbolViewProps['name'];
};

const TABS: TabDef[] = [
  { name: 'index', titleKey: 'tabs.stock', icon: { ios: 'shippingbox', android: 'inventory_2', web: 'inventory_2' } },
  { name: 'map', titleKey: 'tabs.map', icon: { ios: 'map', android: 'map', web: 'map' } },
  { name: 'family', titleKey: 'tabs.family', icon: { ios: 'person.3', android: 'group', web: 'group' } },
  { name: 'more', titleKey: 'tabs.more', icon: { ios: 'ellipsis.circle', android: 'more_horiz', web: 'more_horiz' } },
];

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const { t } = useTranslation();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme].tint,
        // Disable the static render of the header on web
        // to prevent a hydration error in React Navigation v6.
        headerShown: useClientOnlyValue(false, true),
      }}>
      {TABS.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: t(tab.titleKey),
            tabBarIcon: ({ color }) => <SymbolView name={tab.icon} tintColor={color} size={28} />,
          }}
        />
      ))}
    </Tabs>
  );
}
