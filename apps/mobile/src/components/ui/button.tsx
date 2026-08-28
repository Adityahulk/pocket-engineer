import { ActivityIndicator, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { Touchable } from '@/components/ui/touchable';
import { glow, palette, radius, type } from '@/lib/theme';

type Variant = 'primary' | 'light' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

type ButtonProps = {
  label: string;
  onPress: () => void;
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  disabled?: boolean;
  full?: boolean;
  trailing?: string;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
};

export function Button({
  label, onPress, variant = 'primary', size = 'md', loading = false,
  disabled = false, full = false, trailing, style, accessibilityLabel,
}: ButtonProps) {
  const inactive = disabled || loading;
  return (
    <Touchable
      onPress={onPress}
      disabled={inactive}
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: inactive, busy: loading }}
      style={[styles.base, sizes[size], variants[variant], full && styles.full, style]}
      hoverStyle={hovers[variant]}>
      {loading ? (
        <ActivityIndicator size="small" color={variant === 'primary' || variant === 'light' ? palette.ink : palette.paper} />
      ) : (
        <View style={styles.row}>
          <Text style={[styles.label, labelSizes[size], labels[variant]]} numberOfLines={1}>{label}</Text>
          {trailing ? <Text style={[styles.trailing, labels[variant]]}>{trailing}</Text> : null}
        </View>
      )}
    </Touchable>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, borderWidth: 1 },
  full: { alignSelf: 'stretch' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  label: { ...type.label, textAlign: 'center' },
  trailing: { fontSize: 12, fontWeight: '900' },
});

const sizes = StyleSheet.create({
  sm: { minHeight: 36, paddingHorizontal: 13 },
  md: { minHeight: 46, paddingHorizontal: 17 },
  lg: { minHeight: 54, paddingHorizontal: 22, borderRadius: radius.lg },
});

const labelSizes = StyleSheet.create({
  sm: { fontSize: 9, letterSpacing: 1.3 },
  md: { fontSize: 10 },
  lg: { fontSize: 11 },
});

const variants = StyleSheet.create({
  primary: { backgroundColor: palette.mint, borderColor: palette.mint, ...glow('#0C6B52') },
  light: { backgroundColor: palette.paper, borderColor: palette.paper },
  secondary: { backgroundColor: palette.panelRaised, borderColor: palette.lineBright },
  ghost: { backgroundColor: 'transparent', borderColor: palette.line },
  danger: { backgroundColor: palette.redWash, borderColor: palette.redLine },
});

const hovers = StyleSheet.create({
  primary: { backgroundColor: '#A6F5D5' },
  light: { backgroundColor: '#FFFFFF' },
  secondary: { backgroundColor: palette.panelHover, borderColor: palette.muted },
  ghost: { backgroundColor: palette.panel, borderColor: palette.lineBright },
  danger: { borderColor: palette.red },
});

const labels = StyleSheet.create({
  primary: { color: palette.ink },
  light: { color: palette.ink },
  secondary: { color: palette.paper },
  ghost: { color: palette.paper },
  danger: { color: palette.red },
});
