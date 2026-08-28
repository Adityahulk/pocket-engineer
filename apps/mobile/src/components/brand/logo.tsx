import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { palette, radius, type } from '@/lib/theme';

/**
 * The signal mark: five bars reading as a voice waveform inside a squircle.
 * Bar ratios are shared with the generated app icon and favicon, so the mark
 * stays identical across the product surfaces.
 */
export const SIGNAL_BARS = [0.38, 0.66, 1, 0.72, 0.44] as const;

type LogoMarkProps = {
  size?: number;
  tone?: 'citron' | 'ink' | 'outline';
  style?: StyleProp<ViewStyle>;
};

export function LogoMark({ size = 36, tone = 'citron', style }: LogoMarkProps) {
  const barWidth = Math.max(2, Math.round(size * 0.078));
  const gap = Math.max(2, Math.round(size * 0.062));
  const trackHeight = size * 0.54;
  const barColor = tone === 'citron' ? palette.ink : palette.citron;

  return (
    <View
      accessibilityRole="image"
      accessibilityLabel="Pocket Engineer"
      style={[
        styles.mark,
        {
          width: size,
          height: size,
          borderRadius: Math.round(size * 0.3),
          gap,
        },
        tone === 'citron' && styles.markCitron,
        tone === 'ink' && styles.markInk,
        tone === 'outline' && styles.markOutline,
        style,
      ]}>
      {SIGNAL_BARS.map((ratio, index) => (
        <View
          key={index}
          style={{
            width: barWidth,
            height: Math.round(trackHeight * ratio),
            borderRadius: barWidth,
            backgroundColor: barColor,
          }}
        />
      ))}
    </View>
  );
}

/** Mark plus name, used in the Command Center header and the sign-in card. */
export function LogoLockup({ size = 36, caption = 'MISSION CONTROL' }: { size?: number; caption?: string }) {
  return (
    <View style={styles.lockup}>
      <LogoMark size={size} />
      <View>
        <Text style={styles.wordmark}>Pocket Engineer</Text>
        <Text style={styles.caption}>{caption}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  mark: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  markCitron: { backgroundColor: palette.citron },
  markInk: { backgroundColor: palette.panelRaised },
  markOutline: { backgroundColor: 'transparent', borderWidth: 1, borderColor: palette.citronLine, borderRadius: radius.md },
  lockup: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  wordmark: { ...type.subheading, color: palette.paper },
  caption: { ...type.label, color: palette.mutedDeep, fontSize: 8, marginTop: 3 },
});
