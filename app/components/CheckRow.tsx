import { Pressable, StyleSheet } from 'react-native';

import { Text, View } from '@/components/Themed';
import { Muted } from '@/components/ui';
import { ExpiryColors } from '@/constants/Colors';

/** Tappable checklist row: box, label, optional notes and amount. */
export default function CheckRow({
  label,
  notes = [],
  amount,
  checked,
  onToggle,
  link,
}: {
  label: string;
  notes?: string[];
  amount?: string;
  checked: boolean;
  onToggle: () => void;
  /** Extra action under the label, e.g. "What exactly". */
  link?: { label: string; onPress: () => void };
}) {
  return (
    <Pressable onPress={onToggle} accessibilityRole="checkbox" accessibilityState={{ checked }}>
      <View style={styles.row}>
        <View style={[styles.box, checked && { backgroundColor: ExpiryColors.green, borderColor: ExpiryColors.green }]}>
          {checked && <Text style={styles.tick}>✓</Text>}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.label, checked && styles.done]}>{label}</Text>
          {notes.map((n) => (
            <Muted key={n}>{n}</Muted>
          ))}
          {link && (
            <Text style={styles.link} onPress={link.onPress} accessibilityRole="link">
              {link.label}
            </Text>
          )}
        </View>
        {amount ? <Text style={styles.amount}>{amount}</Text> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  box: { width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: '#9e9e9e', alignItems: 'center', justifyContent: 'center' },
  tick: { color: '#fff', fontWeight: '700' },
  label: { fontSize: 16 },
  done: { opacity: 0.5 },
  amount: { fontWeight: '600' },
  link: { color: '#2e78b7', fontSize: 15, paddingTop: 4 },
});
