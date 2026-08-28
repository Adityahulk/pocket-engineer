import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { fonts, palette, radius } from '@/lib/theme';

export function initialsOf(value: string): string {
  const parts = value.trim().split(/[\s/_-]+/).filter(Boolean);
  const letters = parts.length > 1 ? parts.slice(0, 2).map((part) => part[0]).join('') : value.slice(0, 2);
  return letters.toUpperCase();
}

type AvatarProps = {
  name: string;
  size?: number;
  tone?: 'accent' | 'blue' | 'amber' | 'red' | 'violet' | 'quiet';
  square?: boolean;
  style?: StyleProp<ViewStyle>;
};

const backgrounds = {
  accent: palette.citronWash, blue: palette.blueWash, amber: palette.amberWash,
  red: palette.redWash, violet: '#16121F', quiet: palette.panelRaised,
};

const borders = {
  accent: palette.citronLine, blue: palette.blueLine, amber: palette.amberLine,
  red: palette.redLine, violet: '#2E2547', quiet: palette.line,
};

const inks = {
  accent: palette.citron, blue: palette.blue, amber: palette.amber,
  red: palette.red, violet: palette.violet, quiet: palette.muted,
};

/** Outlined initials tile. Solid fills are reserved for the brand mark and CTAs. */
export function Avatar({ name, size = 42, tone = 'blue', square = false, style }: AvatarProps) {
  return (
    <View
      style={[
        styles.base,
        {
          width: size,
          height: size,
          borderRadius: square ? radius.md : size / 2,
          backgroundColor: backgrounds[tone],
          borderColor: borders[tone],
        },
        style,
      ]}>
      <Text style={[styles.text, { color: inks[tone], fontSize: Math.max(9, Math.round(size * 0.29)) }]}>
        {initialsOf(name)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  text: { fontFamily: fonts.mono, letterSpacing: 0.2 },
});
