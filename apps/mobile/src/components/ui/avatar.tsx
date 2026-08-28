import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { palette, radius } from '@/lib/theme';

export function initialsOf(value: string): string {
  const parts = value.trim().split(/[\s/_-]+/).filter(Boolean);
  const letters = parts.length > 1 ? parts.slice(0, 2).map((part) => part[0]).join('') : value.slice(0, 2);
  return letters.toUpperCase();
}

type AvatarProps = {
  name: string;
  size?: number;
  tone?: 'mint' | 'blue' | 'amber' | 'red' | 'violet';
  square?: boolean;
  style?: StyleProp<ViewStyle>;
};

const toneColor = {
  mint: palette.mint, blue: palette.blue, amber: palette.amber,
  red: palette.red, violet: palette.violet,
};

export function Avatar({ name, size = 42, tone = 'blue', square = false, style }: AvatarProps) {
  return (
    <View
      style={[
        styles.base,
        { width: size, height: size, borderRadius: square ? radius.md : size / 2, backgroundColor: toneColor[tone] },
        style,
      ]}>
      <Text style={[styles.text, { fontSize: Math.max(9, Math.round(size * 0.28)) }]}>{initialsOf(name)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center' },
  text: { color: palette.ink, fontWeight: '900', letterSpacing: 0.4 },
});
