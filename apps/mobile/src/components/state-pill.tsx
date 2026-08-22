import { StyleSheet, Text, View } from 'react-native';

import { palette, type } from '@/lib/theme';

const success = new Set(['ready', 'ready_for_review', 'completed']);
const danger = new Set(['failed', 'cancelled']);

export function StatePill({ state }: { state: string }) {
  const color = danger.has(state) ? palette.red : success.has(state) ? palette.mint : palette.amber;
  return (
    <View style={[styles.pill, { borderColor: color }]}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={[styles.text, { color }]}>{state.replaceAll('_', ' ').toUpperCase()}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 6 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  text: type.label,
});

