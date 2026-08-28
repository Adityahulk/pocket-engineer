import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Touchable } from '@/components/ui/touchable';
import { palette, radius, shadowSoft, spacing } from '@/lib/theme';

export type CardTone = 'panel' | 'mint' | 'amber' | 'red' | 'blue' | 'paper' | 'outline';

type CardProps = {
  children: ReactNode;
  tone?: CardTone;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  accessibilityLabel?: string;
  padded?: boolean;
};

export function Card({ children, tone = 'panel', style, onPress, accessibilityLabel, padded = true }: CardProps) {
  const composed = [styles.base, padded && styles.padded, tones[tone], style];
  if (!onPress) return <View style={composed}>{children}</View>;
  return (
    <Touchable onPress={onPress} accessibilityLabel={accessibilityLabel} style={composed} hoverStyle={hoverTones[tone]}>
      {children}
    </Touchable>
  );
}

const styles = StyleSheet.create({
  base: { borderRadius: radius.lg, borderWidth: 1, ...shadowSoft },
  padded: { padding: spacing.md },
});

const tones = StyleSheet.create({
  panel: { backgroundColor: palette.panel, borderColor: palette.line },
  mint: { backgroundColor: palette.mintWash, borderColor: palette.mintLine },
  amber: { backgroundColor: palette.amberWash, borderColor: palette.amberLine },
  red: { backgroundColor: palette.redWash, borderColor: palette.redLine },
  blue: { backgroundColor: palette.blueWash, borderColor: palette.blueLine },
  paper: { backgroundColor: palette.paper, borderColor: palette.paper },
  outline: { backgroundColor: 'transparent', borderColor: palette.line, borderStyle: 'dashed' },
});

const hoverTones = StyleSheet.create({
  panel: { backgroundColor: palette.panelHover, borderColor: palette.lineBright },
  mint: { borderColor: palette.mintDark },
  amber: { borderColor: palette.amber },
  red: { borderColor: palette.red },
  blue: { borderColor: palette.blue },
  paper: { backgroundColor: '#FFFFFF' },
  outline: { borderColor: palette.lineBright, backgroundColor: palette.panel },
});
