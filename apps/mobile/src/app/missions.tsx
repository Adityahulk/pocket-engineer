import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { StatePill } from '@/components/state-pill';
import { api } from '@/lib/api';
import { palette, radius, spacing, type } from '@/lib/theme';

export default function MissionsScreen() {
  const missions = useQuery({ queryKey: ['missions'], queryFn: api.missions, refetchInterval: 3_000 });
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.eyebrow}>IN FLIGHT</Text>
      <Text style={styles.title}>Active missions</Text>
      <Text style={styles.body}>Work Alex is investigating, changing, or verifying right now.</Text>
      {missions.data?.map((task) => (
        <Pressable key={task.id} style={({ pressed }) => [styles.card, pressed && { opacity: 0.72 }]} onPress={() => router.push({ pathname: '/task/[id]', params: { id: task.id } })}>
          <View style={styles.top}><Text style={styles.mode}>{task.autonomy.toUpperCase()}</Text><StatePill state={task.state} /></View>
          <Text style={styles.goal}>{task.goal}</Text>
          <Text style={styles.meta}>{task.engineer_name} · {task.mode.toUpperCase()}</Text>
        </Pressable>
      ))}
      {!missions.isLoading && !missions.data?.length && <Text style={styles.empty}>No active missions. Call Alex and say what you want done.</Text>}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.ink }, content: { padding: spacing.lg, paddingBottom: 80, maxWidth: 760, width: '100%', alignSelf: 'center' },
  eyebrow: { ...type.label, color: palette.amber, marginTop: 8 }, title: { color: palette.paper, fontSize: 32, fontWeight: '900', letterSpacing: -1, marginTop: 10 },
  body: { color: palette.muted, fontSize: 14, lineHeight: 21, marginTop: 10, marginBottom: 22 },
  card: { backgroundColor: palette.panel, borderColor: palette.line, borderWidth: 1, borderRadius: radius.md, padding: spacing.md, marginBottom: 10 },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, mode: { ...type.label, color: palette.mint },
  goal: { color: palette.paper, fontSize: 16, lineHeight: 22, fontWeight: '800', marginTop: 12 }, meta: { ...type.label, color: palette.muted, fontSize: 8, marginTop: 12 },
  empty: { color: palette.muted, textAlign: 'center', padding: 28, lineHeight: 20 },
});
