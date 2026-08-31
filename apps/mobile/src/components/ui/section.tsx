import type { ReactNode } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { Button } from '@/components/ui/button';
import { Icon, type IconName } from '@/components/ui/icon';
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
      <View style={styles.tick} />
      <Text style={styles.title}>{title}</Text>
      {typeof count === 'number' ? <Text style={styles.count}>{count.toString().padStart(2, '0')}</Text> : null}
      <View style={styles.spacer} />
      {action && onAction ? (
        <Touchable onPress={onAction} accessibilityLabel={action} style={styles.action} hoverStyle={styles.actionHover}>
          <Text style={styles.actionText}>{action}</Text>
        </Touchable>
      ) : null}
    </View>
  );
}

export function ScreenIntro({ eyebrow, eyebrowTone = palette.citron, title, body }: {
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

export function EmptyState({ icon, title, body, tone = 'accent', children }: {
  icon: IconName;
  title: string;
  body: string;
  tone?: 'accent' | 'red';
  children?: ReactNode;
}) {
  const red = tone === 'red';
  return (
    <View style={styles.empty}>
      <View style={[styles.emptyGlyph, red && styles.emptyGlyphRed]}>
        <Icon name={icon} size={20} color={red ? palette.red : palette.citron} />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyBody}>{body}</Text>
      {children ? <View style={styles.emptyAction}>{children}</View> : null}
    </View>
  );
}

/**
 * Failure needs its own state. Falling through to `EmptyState` tells the user
 * there is no work waiting when the truth is that we could not ask.
 */
export function ErrorState({ title, error, onRetry }: { title: string; error: unknown; onRetry: () => void }) {
  return (
    <EmptyState
      icon="alert-triangle"
      tone="red"
      title={title}
      body={error instanceof Error ? error.message : 'Mission Control could not reach the API.'}>
      <Button label="TRY AGAIN" icon="refresh-cw" variant="secondary" onPress={onRetry} />
    </EmptyState>
  );
}

export function Divider({ style }: { style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.divider, style]} />;
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: spacing.xl, marginBottom: 12 },
  tick: { width: 3, height: 11, borderRadius: 2, backgroundColor: palette.citron },
  title: { ...type.label, color: palette.muted },
  count: { ...type.label, color: palette.mutedDeep, fontSize: 9 },
  spacer: { flex: 1 },
  action: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.sm, borderWidth: 1, borderColor: palette.line },
  actionHover: { borderColor: palette.lineBright, backgroundColor: palette.panel },
  actionText: { ...type.label, color: palette.muted, fontSize: 8 },

  intro: { marginTop: spacing.sm, marginBottom: spacing.lg },
  eyebrow: { ...type.label },
  introTitle: { ...type.title, color: palette.paper, marginTop: 10 },
  introBody: { ...type.body, color: palette.muted, marginTop: 10, maxWidth: 560 },

  empty: { alignItems: 'center', paddingVertical: spacing.xl, paddingHorizontal: spacing.lg },
  emptyGlyph: {
    width: 48, height: 48, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center',
    backgroundColor: palette.citronWash, borderWidth: 1, borderColor: palette.citronLine,
  },
  emptyGlyphRed: { backgroundColor: palette.redWash, borderColor: palette.redLine },
  emptyTitle: { ...type.heading, color: palette.paper, marginTop: 16, textAlign: 'center' },
  emptyBody: { ...type.body, color: palette.muted, marginTop: 8, textAlign: 'center', maxWidth: 340 },
  emptyAction: { marginTop: 20 },
  divider: { height: 1, backgroundColor: palette.line },
});
