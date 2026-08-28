import type { ReactNode } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { Touchable } from '@/components/ui/touchable';
import { palette, radius, spacing, type } from '@/lib/theme';

export function SectionHeader({ title, count, action, onAction, style }: {
  title: string;
  count?: number;
  action?: string;
  onAction?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.header, style]}>
      <Text style={styles.title}>{title}</Text>
      {typeof count === 'number' ? <View style={styles.count}><Text style={styles.countText}>{count}</Text></View> : null}
      <View style={styles.spacer} />
      {action && onAction ? (
        <Touchable onPress={onAction} accessibilityLabel={action} style={styles.action} hoverStyle={styles.actionHover}>
          <Text style={styles.actionText}>{action}</Text>
        </Touchable>
      ) : null}
    </View>
  );
}

export function ScreenIntro({ eyebrow, eyebrowTone = palette.mint, title, body }: {
  eyebrow: string;
  eyebrowTone?: string;
  title: string;
  body?: string;
}) {
  return (
    <View style={styles.intro}>
      <Text style={[styles.eyebrow, { color: eyebrowTone }]}>{eyebrow}</Text>
      <Text style={styles.introTitle}>{title}</Text>
      {body ? <Text style={styles.introBody}>{body}</Text> : null}
    </View>
  );
}

export function EmptyState({ glyph, title, body, children }: {
  glyph: string;
  title: string;
  body: string;
  children?: ReactNode;
}) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyGlyph}><Text style={styles.emptyGlyphText}>{glyph}</Text></View>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyBody}>{body}</Text>
      {children ? <View style={styles.emptyAction}>{children}</View> : null}
    </View>
  );
}

export function Divider({ style }: { style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.divider, style]} />;
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: spacing.xl, marginBottom: 12 },
  title: { ...type.label, color: palette.muted },
  count: { backgroundColor: palette.panelRaised, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 2, minWidth: 22, alignItems: 'center' },
  countText: { color: palette.paper, fontSize: 10, fontWeight: '900' },
  spacer: { flex: 1 },
  action: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.pill, borderWidth: 1, borderColor: palette.line },
  actionHover: { borderColor: palette.lineBright, backgroundColor: palette.panel },
  actionText: { ...type.label, color: palette.muted, fontSize: 8 },

  intro: { marginTop: spacing.sm, marginBottom: spacing.lg },
  eyebrow: { ...type.label },
  introTitle: { ...type.title, color: palette.paper, marginTop: 10 },
  introBody: { ...type.body, color: palette.muted, marginTop: 10, maxWidth: 560 },

  empty: { alignItems: 'center', paddingVertical: spacing.xl, paddingHorizontal: spacing.lg },
  emptyGlyph: {
    width: 52, height: 52, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center',
    backgroundColor: palette.panel, borderWidth: 1, borderColor: palette.line,
  },
  emptyGlyphText: { color: palette.mintText, fontSize: 22 },
  emptyTitle: { ...type.heading, color: palette.paper, marginTop: 16, textAlign: 'center' },
  emptyBody: { ...type.body, color: palette.muted, marginTop: 8, textAlign: 'center', maxWidth: 340 },
  emptyAction: { marginTop: 20 },
  divider: { height: 1, backgroundColor: palette.line },
});
