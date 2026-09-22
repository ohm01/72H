import { useState } from 'react';
import DateTimePicker from '@react-native-community/datetimepicker';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';

import { Text, View, useThemeColor } from '@/components/Themed';
import { formatIsoDate, parseDate } from '@/lib/expiry';

// Small set of shared building blocks. Keep it minimal; add only what screens need.

export function Screen({ children }: { children: React.ReactNode }) {
  const background = useThemeColor({}, 'background');
  return (
    <ScrollView style={{ backgroundColor: background }} contentContainerStyle={styles.screen} keyboardShouldPersistTaps="handled">
      {children}
    </ScrollView>
  );
}

export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  const card = useThemeColor({}, 'card');
  const border = useThemeColor({}, 'border');
  return <View style={[styles.card, { backgroundColor: card, borderColor: border }, style]}>{children}</View>;
}

export function Title({ children }: { children: React.ReactNode }) {
  return <Text style={styles.title}>{children}</Text>;
}

export function Label({ children }: { children: React.ReactNode }) {
  return <Text style={styles.label}>{children}</Text>;
}

export function Muted({ children, style }: { children: React.ReactNode; style?: object }) {
  const muted = useThemeColor({}, 'muted');
  return <Text style={[{ color: muted }, style]}>{children}</Text>;
}

type ButtonProps = {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
};

export function Button({ title, onPress, variant = 'primary', disabled }: ButtonProps) {
  const tint = useThemeColor({}, 'tint');
  const onTint = useThemeColor({}, 'onTint');
  const danger = useThemeColor({}, 'danger');
  const border = useThemeColor({}, 'border');
  const text = useThemeColor({}, 'text');
  const bg = variant === 'primary' ? tint : 'transparent';
  const fg = variant === 'primary' ? onTint : variant === 'danger' ? danger : text;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: bg, borderColor: variant === 'primary' ? tint : border, opacity: disabled ? 0.4 : pressed ? 0.7 : 1 },
      ]}>
      <Text style={[styles.buttonText, { color: fg }]}>{title}</Text>
    </Pressable>
  );
}

export function TextField(props: TextInputProps) {
  const text = useThemeColor({}, 'text');
  const border = useThemeColor({}, 'border');
  const card = useThemeColor({}, 'card');
  const muted = useThemeColor({}, 'muted');
  return (
    <TextInput
      placeholderTextColor={muted}
      {...props}
      style={[styles.input, { color: text, borderColor: border, backgroundColor: card }, props.style]}
    />
  );
}

export function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const tint = useThemeColor({}, 'tint');
  const onTint = useThemeColor({}, 'onTint');
  const border = useThemeColor({}, 'border');
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.chip, { borderColor: selected ? tint : border, backgroundColor: selected ? tint : 'transparent' }]}>
      <Text style={{ color: selected ? onTint : undefined }}>{label}</Text>
    </Pressable>
  );
}

export function ChipRow({ children }: { children: React.ReactNode }) {
  return <View style={styles.chipRow}>{children}</View>;
}

export function Stepper({ value, onChange, min = 0, max = 99 }: { value: number; onChange: (v: number) => void; min?: number; max?: number }) {
  return (
    <View style={styles.stepper}>
      <Button title="−" variant="secondary" onPress={() => onChange(Math.max(min, value - 1))} disabled={value <= min} />
      <Text style={styles.stepperValue}>{value}</Text>
      <Button title="+" variant="secondary" onPress={() => onChange(Math.min(max, value + 1))} disabled={value >= max} />
    </View>
  );
}

/** Optional date (YYYY-MM-DD or null). */
export function DateField({
  value,
  onChange,
  setLabel,
  clearLabel,
}: {
  value: string | null;
  onChange: (v: string | null) => void;
  setLabel: string;
  clearLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const date = value ? parseDate(value) : new Date();
  return (
    <View style={styles.dateRow}>
      {Platform.OS === 'ios' && value ? (
        <DateTimePicker value={date} mode="date" display="compact" onChange={(_, d) => d && onChange(formatIsoDate(d))} />
      ) : (
        <Button title={value ?? setLabel} variant="secondary" onPress={() => setOpen(true)} />
      )}
      {value ? <Button title={clearLabel} variant="secondary" onPress={() => onChange(null)} /> : null}
      {open && (
        <DateTimePicker
          value={date}
          mode="date"
          onChange={(event, d) => {
            setOpen(false);
            if (event.type === 'set' && d) onChange(formatIsoDate(d));
          }}
        />
      )}
    </View>
  );
}

export const styles = StyleSheet.create({
  screen: { padding: 16, gap: 12, paddingBottom: 48 },
  card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, padding: 14, gap: 8 },
  title: { fontSize: 20, fontWeight: '600' },
  label: { fontSize: 13, fontWeight: '600', marginTop: 8 },
  button: { borderWidth: 1, borderRadius: 10, paddingVertical: 12, paddingHorizontal: 16, alignItems: 'center' },
  buttonText: { fontSize: 16, fontWeight: '600' },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16 },
  chip: { borderWidth: 1, borderRadius: 16, paddingVertical: 6, paddingHorizontal: 12 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  stepperValue: { fontSize: 20, fontWeight: '600', minWidth: 32, textAlign: 'center' },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
