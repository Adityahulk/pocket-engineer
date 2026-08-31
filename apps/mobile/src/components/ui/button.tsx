import { ActivityIndicator, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { Icon, type IconName } from '@/components/ui/icon';
import { Touchable } from '@/components/ui/touchable';
import { glow, hitTarget, palette, radius, type } from '@/lib/theme';

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
  icon?: IconName;
  trailingIcon?: IconName;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
};

const iconSizes: Record<Size, number> = { sm: 12, md: 14, lg: 15 };

export function Button({
  label, onPress, variant = 'primary', size = 'md', loading = false, disabled = false,
  full = false, icon, trailingIcon, style, accessibilityLabel,
}: ButtonProps) {
  const inactive = disabled || loading;
  const tint = labelColors[variant];
  return (
    <Touchable
      onPress={onPress}
      disabled={inactive}
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: inactive, busy: loading }}
      style={[styles.base, sizes[size], variants[variant], full && styles.full, style]}
      hoverStyle={hovers[variant]}>
      {loading ? (
        <ActivityIndicator size="small" color={tint} />
      ) : (
        <View style={styles.row}>
          {icon ? <Icon name={icon} size={iconSizes[size]} color={tint} /> : null}
          <Text style={[styles.label, labelSizes[size], { color: tint }]} numberOfLines={1}>{label}</Text>
          {trailingIcon ? <Icon name={trailingIcon} size={iconSizes[size]} color={tint} /> : null}
        </View>
      )}
    </Touchable>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, borderWidth: 1 },
  full: { alignSelf: 'stretch' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  label: { ...type.label },
});

const sizes = StyleSheet.create({
  sm: { minHeight: hitTarget, paddingHorizontal: 14 },
  md: { minHeight: 48, paddingHorizontal: 16 },
  lg: { minHeight: 54, paddingHorizontal: 22 },
});

const labelSizes = StyleSheet.create({
  sm: { fontSize: 10 },
  md: { fontSize: 11 },
  lg: { fontSize: 12 },
});

const variants = StyleSheet.create({
  primary: { backgroundColor: palette.citron, borderColor: palette.citron, ...glow('#5C7A0F') },
  light: { backgroundColor: palette.paper, borderColor: palette.paper },
  secondary: { backgroundColor: palette.panelRaised, borderColor: palette.lineBright },
  ghost: { backgroundColor: 'transparent', borderColor: palette.line },
  danger: { backgroundColor: palette.redWash, borderColor: palette.redLine },
});

const hovers = StyleSheet.create({
  primary: { backgroundColor: '#D7FF75' },
  light: { backgroundColor: '#FFFFFF' },
  secondary: { backgroundColor: palette.panelHover, borderColor: palette.muted },
  ghost: { backgroundColor: palette.panel, borderColor: palette.lineBright },
  danger: { borderColor: palette.red },
});

const labelColors: Record<Variant, string> = {
  primary: palette.ink,
  light: palette.ink,
  secondary: palette.paper,
  ghost: palette.paper,
  danger: palette.red,
};
