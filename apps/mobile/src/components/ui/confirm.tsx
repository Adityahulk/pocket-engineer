import { useState } from 'react';
import { Modal, StyleSheet, Text, TextInput, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Icon, type IconName } from '@/components/ui/icon';
import { Touchable } from '@/components/ui/touchable';
import { palette, radius, shadow, spacing, type } from '@/lib/theme';

type ConfirmTone = 'accent' | 'danger';

type ConfirmDialogProps = {
  title: string;
  body: string;
  confirmLabel: string;
  cancelLabel?: string;
  icon?: IconName;
  tone?: ConfirmTone;
  loading?: boolean;
  /** Renders a required free-text field whose value is passed to `onConfirm`. */
  prompt?: { label: string; placeholder: string; minLength?: number };
  onConfirm: (value: string) => void;
  onCancel: () => void;
};

/**
 * Blocking confirmation for actions that cannot be undone. Used instead of
 * `Alert.alert` so the same dialog works on web, and so a rejection can
 * collect the feedback the engineer needs to retry.
 */
export function ConfirmDialog({ visible, ...rest }: ConfirmDialogProps & { visible: boolean }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={rest.onCancel}>
      {/* Mounted only while open so the prompt field starts empty every time. */}
      {visible ? <ConfirmBody {...rest} /> : null}
    </Modal>
  );
}

function ConfirmBody({
  title, body, confirmLabel, cancelLabel = 'CANCEL', icon, tone = 'accent',
  loading = false, prompt, onConfirm, onCancel,
}: ConfirmDialogProps) {
  const [value, setValue] = useState('');
  const minLength = prompt?.minLength ?? 3;
  const incomplete = Boolean(prompt) && value.trim().length < minLength;

  return (
    <View style={styles.backdrop}>
      <Touchable
        style={styles.backdropFill}
        accessibilityLabel="Dismiss"
        disabled={loading}
        onPress={onCancel}
        pressStyle={styles.backdropFill}
      />
      <View style={styles.dialog} accessibilityViewIsModal>
        <View style={styles.head}>
          {icon ? (
            <View style={[styles.glyph, tone === 'danger' && styles.glyphDanger]}>
              <Icon name={icon} size={17} color={tone === 'danger' ? palette.red : palette.citron} />
            </View>
          ) : null}
          <Text style={styles.title}>{title}</Text>
        </View>
        <Text style={styles.body}>{body}</Text>

        {prompt ? (
          <View style={styles.promptWrap}>
            <Text style={styles.promptLabel}>{prompt.label}</Text>
            <TextInput
              value={value}
              onChangeText={setValue}
              placeholder={prompt.placeholder}
              placeholderTextColor={palette.muted}
              style={styles.promptInput}
              multiline
              maxLength={2000}
              textAlignVertical="top"
              accessibilityLabel={prompt.label}
            />
          </View>
        ) : null}

        <View style={styles.actions}>
          <Button label={cancelLabel} variant="ghost" style={styles.cancel} disabled={loading} onPress={onCancel} />
          <Button
            label={confirmLabel}
            variant={tone === 'danger' ? 'danger' : 'primary'}
            style={styles.confirm}
            loading={loading}
            disabled={incomplete}
            onPress={() => onConfirm(value.trim())}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: '#040507D9', justifyContent: 'center', padding: spacing.lg },
  backdropFill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  dialog: {
    width: '100%', maxWidth: 440, alignSelf: 'center', backgroundColor: palette.panelRaised,
    borderWidth: 1, borderColor: palette.lineBright, borderRadius: radius.xl, padding: spacing.lg, ...shadow,
  },

  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  glyph: {
    width: 40, height: 40, borderRadius: radius.md, backgroundColor: palette.citronWash,
    borderWidth: 1, borderColor: palette.citronLine, alignItems: 'center', justifyContent: 'center',
  },
  glyphDanger: { backgroundColor: palette.redWash, borderColor: palette.redLine },
  title: { ...type.heading, color: palette.paper, flex: 1 },
  body: { ...type.body, color: palette.muted, marginTop: 14 },

  promptWrap: { marginTop: 18 },
  promptLabel: { ...type.label, color: palette.muted },
  promptInput: {
    minHeight: 92, marginTop: 8, backgroundColor: palette.ink, borderWidth: 1, borderColor: palette.line,
    borderRadius: radius.md, color: palette.paper, padding: 12, fontSize: 15, lineHeight: 22,
  },

  actions: { flexDirection: 'row', gap: 10, marginTop: spacing.lg },
  cancel: { flex: 1 },
  confirm: { flex: 1.5 },
});
