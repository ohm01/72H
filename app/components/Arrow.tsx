import { SymbolView } from 'expo-symbols';
import { View } from 'react-native';

import { useThemeColor } from '@/components/Themed';

/** Big arrow pointing `rotation` degrees clockwise from the top of the screen. */
export default function Arrow({ rotation, size = 160 }: { rotation: number; size?: number }) {
  const tint = useThemeColor({}, 'tint');
  return (
    <View testID="arrow" style={{ width: size, height: size, transform: [{ rotate: `${Math.round(rotation)}deg` }] }}>
      <SymbolView
        name={{ ios: 'arrow.up.circle.fill', android: 'arrow_circle_up', web: 'arrow_circle_up' }}
        tintColor={tint}
        size={size}
        accessibilityElementsHidden
        importantForAccessibility="no"
      />
    </View>
  );
}
