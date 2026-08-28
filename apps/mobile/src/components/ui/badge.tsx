import { useEffect, useState } from 'react';
import { Animated, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { palette, radius, type } from '@/lib/theme';

export type BadgeTone = 'mint' | 'amber' | 'blue' | 'red' | 'neutral' | 'violet';

const toneColor: Record<BadgeTone, string> = {
  mint: palette.mint, amber: palette.amber, blue: palette.blue,
  red: palette.red, neutral: palette.muted, violet: palette.violet,
};

type BadgeProps = {
  label: string;
  tone?: BadgeTone;
  dot?: boolean;
  pulse?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function Badge({ label, tone = 'neutral', dot = true, pulse = false, style }: BadgeProps) {
  const color = toneColor[tone];
  return (
    <View style={[styles.badge, { borderColor: color }, style]}>
      {dot ? <LiveDot color={color} pulse={pulse} /> : null}
      <Text style={[styles.text, { color }]} numberOfLines={1}>{label}</Text>
    </View>
  );
}

export function LiveDot({ color, pulse = false, size = 6 }: { color: string; pulse?: boolean; size?: number }) {
  const [value] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (!pulse) return;
    const animation = Animated.loop(Animated.sequence([
      Animated.timing(value, { toValue: 1, duration: 760, useNativeDriver: true }),
      Animated.timing(value, { toValue: 0, duration: 760, useNativeDriver: true }),
    ]));
    animation.start();
    return () => animation.stop();
  }, [pulse, value]);

  const dot = { width: size, height: size, borderRadius: size / 2, backgroundColor: color };
  if (!pulse) return <View style={dot} />;
  return (
    <Animated.View
      style={[dot, { opacity: value.interpolate({ inputRange: [0, 1], outputRange: [1, 0.32] }) }]}
    />
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1,
    borderRadius: radius.pill, paddingHorizontal: 9, paddingVertical: 5,
  },
  text: { ...type.label, fontSize: 9 },
});
