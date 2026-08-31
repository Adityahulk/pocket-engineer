import { useEffect, useState } from 'react';
import { Animated, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { Icon, type IconName } from '@/components/ui/icon';
import { useReducedMotion } from '@/lib/reduced-motion';
import { palette, radius, type } from '@/lib/theme';

export type BadgeTone = 'accent' | 'amber' | 'blue' | 'red' | 'neutral' | 'violet';

const toneColor: Record<BadgeTone, string> = {
  accent: palette.citron, amber: palette.amber, blue: palette.blue,
  red: palette.red, neutral: palette.muted, violet: palette.violet,
};

type BadgeProps = {
  label: string;
  tone?: BadgeTone;
  dot?: boolean;
  pulse?: boolean;
  icon?: IconName;
  style?: StyleProp<ViewStyle>;
};

export function Badge({ label, tone = 'neutral', dot = false, pulse = false, icon, style }: BadgeProps) {
  const color = toneColor[tone];
  return (
    <View style={[styles.badge, { borderColor: color }, style]}>
      {icon ? <Icon name={icon} size={10} color={color} /> : null}
      {dot ? <LiveDot color={color} pulse={pulse} /> : null}
      <Text style={[styles.text, { color }]} numberOfLines={1}>{label}</Text>
    </View>
  );
}

export function LiveDot({ color, pulse = false, size = 6 }: { color: string; pulse?: boolean; size?: number }) {
  const [value] = useState(() => new Animated.Value(0));
  const reducedMotion = useReducedMotion();
  const animate = pulse && !reducedMotion;

  useEffect(() => {
    if (!animate) return;
    const animation = Animated.loop(Animated.sequence([
      Animated.timing(value, { toValue: 1, duration: 760, useNativeDriver: true }),
      Animated.timing(value, { toValue: 0, duration: 760, useNativeDriver: true }),
    ]));
    animation.start();
    return () => animation.stop();
  }, [animate, value]);

  const dot = { width: size, height: size, borderRadius: size / 2, backgroundColor: color };
  if (!animate) return <View style={dot} />;
  return <Animated.View style={[dot, { opacity: value.interpolate({ inputRange: [0, 1], outputRange: [1, 0.3] }) }]} />;
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1,
    borderRadius: radius.sm, paddingHorizontal: 8, paddingVertical: 4,
  },
  text: { ...type.labelSm, letterSpacing: 0.3 },
});
