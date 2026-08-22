import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { StatePill } from '@/components/state-pill';
import { api } from '@/lib/api';
import { palette, radius, spacing, type } from '@/lib/theme';

export default function ProjectScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [goal, setGoal] = useState('Checkout returns 500 for customers without a discount. Find the root cause and fix it.');
  const [mode, setMode] = useState<'fix' | 'modify'>('fix');
  const project = useQuery({ queryKey: ['project', id], queryFn: () => api.project(id!) });
  const tasks = useQuery({ queryKey: ['tasks', id], queryFn: () => api.tasks(id!), refetchInterval: 2_000 });
  const createTask = useMutation({
    mutationFn: () => api.createTask(id!, goal.trim(), mode),
    onSuccess: async (task) => {
      await queryClient.invalidateQueries({ queryKey: ['tasks', id] });
      router.push({ pathname: '/task/[id]', params: { id: task.id } });
    },
  });

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.headerRow}>
        <View style={styles.projectMark}><Text style={styles.projectMarkText}>{project.data?.name.slice(0, 2).toUpperCase() ?? 'PE'}</Text></View>
        <View style={styles.headerCopy}><Text style={styles.projectName}>{project.data?.name ?? 'Loading project…'}</Text><Text style={styles.repo} numberOfLines={1}>{project.data?.repo_url}</Text></View>
        {project.data && <StatePill state={project.data.status} />}
      </View>

      {project.data && <View style={[styles.healthCard, project.data.health_status === 'incident' && styles.healthIncident]}>
        <View style={[styles.healthDot, { backgroundColor: project.data.health_status === 'incident' ? palette.red : palette.mint }]} />
        <View style={styles.healthCopy}><Text style={styles.healthLabel}>{project.data.health_status === 'incident' ? 'INCIDENT DETECTED' : 'PRODUCTION HEALTHY'}</Text><Text style={styles.healthText}>{project.data.health_summary}</Text></View>
        <Pressable onPress={() => router.push({ pathname: '/voice', params: { projectId: id! } })} style={styles.callEngineer}><Text style={styles.callEngineerText}>CALL ↗</Text></Pressable>
      </View>}

      <View style={styles.rule} />
      <Text style={styles.eyebrow}>NEW MISSION</Text>
      <Text style={styles.title}>What outcome should your engineer own?</Text>

      <View style={styles.modeRow}>
        {(['fix', 'modify'] as const).map((value) => (
          <Pressable key={value} style={[styles.mode, mode === value && styles.modeActive]} onPress={() => setMode(value)}>
            <Text style={[styles.modeText, mode === value && styles.modeTextActive]}>{value.toUpperCase()}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.composer}>
        <TextInput value={goal} onChangeText={setGoal} placeholder="Describe the outcome, not the implementation…" placeholderTextColor="#667489"
          style={styles.input} multiline maxLength={8000} textAlignVertical="top" />
        <View style={styles.composerFooter}>
          <Text style={styles.safety}>READ → PLAN → CHANGE → VERIFY</Text>
          <Pressable disabled={goal.trim().length < 3 || createTask.isPending} onPress={() => createTask.mutate()}
            style={({ pressed }) => [styles.runButton, pressed && styles.pressed, (goal.trim().length < 3 || createTask.isPending) && styles.disabled]}>
            {createTask.isPending ? <ActivityIndicator color={palette.ink} /> : <Text style={styles.runText}>START MISSION ↗</Text>}
          </Pressable>
        </View>
      </View>
      {createTask.isError && <Text style={styles.error}>{createTask.error.message}</Text>}

      <View style={styles.sectionHeader}><Text style={styles.eyebrow}>RECENT ACTIVITY</Text><Text style={styles.count}>{tasks.data?.length ?? 0}</Text></View>
      {tasks.data?.map((task) => (
        <Pressable key={task.id} style={({ pressed }) => [styles.taskCard, pressed && styles.pressed]}
          onPress={() => router.push({ pathname: '/task/[id]', params: { id: task.id } })}>
          <View style={styles.taskTop}><Text style={styles.taskMode}>{task.mode.toUpperCase()}</Text><StatePill state={task.state} /></View>
          <Text style={styles.taskGoal} numberOfLines={2}>{task.goal}</Text><Text style={styles.taskDate}>{new Date(task.created_at).toLocaleString()}</Text>
        </Pressable>
      ))}
      {!tasks.isLoading && tasks.data?.length === 0 && <Text style={styles.noTasks}>No Missions yet. Your first verified outcome starts here.</Text>}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.ink }, content: { padding: spacing.lg, paddingBottom: 80, maxWidth: 720, width: '100%', alignSelf: 'center' },
  headerRow: { flexDirection: 'row', alignItems: 'center' }, projectMark: { width: 44, height: 44, borderRadius: 14, backgroundColor: palette.amber, alignItems: 'center', justifyContent: 'center' }, projectMarkText: { color: palette.ink, fontWeight: '900', fontSize: 11 }, headerCopy: { flex: 1, marginLeft: 12, marginRight: 10 }, projectName: { color: palette.paper, fontWeight: '900', fontSize: 18 }, repo: { color: palette.muted, fontSize: 11, marginTop: 4 },
  rule: { height: 1, backgroundColor: palette.line, marginVertical: 28 }, eyebrow: { ...type.label, color: palette.mint }, title: { color: palette.paper, fontSize: 30, lineHeight: 36, letterSpacing: -1, fontWeight: '900', marginTop: 10 },
  healthCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#0D2824', borderColor: '#24554A', borderWidth: 1, borderRadius: radius.md, padding: 13, marginTop: 20 }, healthIncident: { backgroundColor: '#28141A', borderColor: '#71303C' }, healthDot: { width: 9, height: 9, borderRadius: 5 }, healthCopy: { flex: 1, marginLeft: 10 }, healthLabel: { ...type.label, color: palette.paper, fontSize: 8 }, healthText: { color: palette.muted, fontSize: 10, marginTop: 4 }, callEngineer: { backgroundColor: palette.paper, borderRadius: 10, paddingHorizontal: 11, paddingVertical: 9 }, callEngineerText: { ...type.label, color: palette.ink, fontSize: 8 },
  modeRow: { flexDirection: 'row', gap: 8, marginTop: 20 }, mode: { borderColor: palette.line, borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 }, modeActive: { backgroundColor: palette.paper, borderColor: palette.paper }, modeText: { ...type.label, color: palette.muted }, modeTextActive: { color: palette.ink },
  composer: { backgroundColor: palette.panel, borderRadius: radius.lg, borderWidth: 1, borderColor: palette.line, marginTop: 12, overflow: 'hidden' }, input: { minHeight: 142, color: palette.paper, padding: spacing.md, fontSize: 16, lineHeight: 24 }, composerFooter: { borderTopWidth: 1, borderTopColor: palette.line, padding: 12, flexDirection: 'row', alignItems: 'center' }, safety: { ...type.label, color: '#5D6D80', flex: 1, fontSize: 8 },
  runButton: { backgroundColor: palette.mint, minWidth: 120, height: 42, paddingHorizontal: 15, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }, runText: { color: palette.ink, fontSize: 10, fontWeight: '900', letterSpacing: 1 }, disabled: { opacity: 0.4 }, pressed: { opacity: 0.72 }, error: { color: palette.red, marginTop: 10 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginTop: 38, marginBottom: 12 }, count: { color: palette.muted, marginLeft: 'auto', fontSize: 12 },
  taskCard: { backgroundColor: palette.panel, borderColor: palette.line, borderWidth: 1, borderRadius: radius.md, padding: spacing.md, marginBottom: 10 }, taskTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, taskMode: { ...type.label, color: palette.amber }, taskGoal: { color: palette.paper, fontSize: 14, lineHeight: 21, fontWeight: '700', marginTop: 14 }, taskDate: { color: palette.muted, fontSize: 10, marginTop: 9 }, noTasks: { color: palette.muted, textAlign: 'center', padding: 24, lineHeight: 20 },
});
