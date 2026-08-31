import { useEffect, useState } from 'react';
import { Animated, StyleSheet, View, type DimensionValue } from 'react-native';

import { useReducedMotion } from '@/lib/reduced-motion';
import { palette, radius, spacing } from '@/lib/theme';

export function Skeleton({ width = '100%', height = 14, round = radius.sm }: {
  width?: DimensionValue;
  height?: number;
  round?: number;
}) {
  const [value] = useState(() => new Animated.Value(0));
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (reducedMotion) return;
    const animation = Animated.loop(Animated.sequence([
      Animated.timing(value, { toValue: 1, duration: 780, useNativeDriver: true }),
      Animated.timing(value, { toValue: 0, duration: 780, useNativeDriver: true }),
    ]));
    animation.start();
    return () => animation.stop();
  }, [reducedMotion, value]);

  return (
    <Animated.View
      accessibilityRole="progressbar"
      style={{
        width, height, borderRadius: round, backgroundColor: palette.panelRaised,
        opacity: reducedMotion ? 0.7 : value.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0.9] }),
      }}
    />
  );
}

/** Placeholder that mirrors the shape of a mission or decision list row. */
export function SkeletonCard({ lines = 2 }: { lines?: number }) {
  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <Skeleton width={92} height={11} />
        <Skeleton width={70} height={22} round={radius.pill} />
      </View>
      <View style={styles.body}>
        {Array.from({ length: lines }).map((_, index) => (
          <Skeleton key={index} width={index === lines - 1 ? '62%' : '100%'} height={13} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: palette.panel, borderColor: palette.line, borderWidth: 1,
    borderRadius: radius.lg, padding: spacing.md, marginBottom: 10, gap: 16,
  },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  body: { gap: 8 },
});
