import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { StatePill } from '@/components/state-pill';
import { Avatar } from '@/components/ui/avatar';
import { Badge, LiveDot } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { MissionProgress } from '@/components/ui/progress';
import { Divider, SectionHeader } from '@/components/ui/section';
import { Skeleton, SkeletonCard } from '@/components/ui/skeleton';
import { Touchable } from '@/components/ui/touchable';
import { api } from '@/lib/api';
import { layout, palette, radius, spacing, type } from '@/lib/theme';

export default function ProjectScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [goal, setGoal] = useState<string | null>(null);
  const [mode, setMode] = useState<'fix' | 'modify'>('fix');
  const [autopilot, setAutopilot] = useState(false);
  const project = useQuery({ queryKey: ['project', id], queryFn: () => api.project(id!) });
  const tasks = useQuery({ queryKey: ['tasks', id], queryFn: () => api.tasks(id!), refetchInterval: 2_000 });
  const composedGoal = goal ?? (project.data?.is_demo
    ? 'Checkout returns 500 for customers without a discount. Find the root cause and fix it.'
    : '');
  const createTask = useMutation({
    mutationFn: () => api.createTask(id!, composedGoal.trim(), mode, autopilot ? 'autopilot' : 'assisted'),
    onSuccess: async (task) => {
      await queryClient.invalidateQueries({ queryKey: ['tasks', id] });
      router.push({ pathname: '/task/[id]', params: { id: task.id } });
    },
  });
  const tooShort = composedGoal.trim().length < 3;
  const incident = project.data?.health_status === 'incident';

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}>
      <View style={styles.headerRow}>
        {project.data
          ? <Avatar name={project.data.name} size={46} square tone={incident ? 'red' : 'amber'} />
          : <Skeleton width={46} height={46} round={radius.md} />}
        <View style={styles.headerCopy}>
          {project.data ? (
            <>
              <View style={styles.nameRow}>
                <Text style={styles.projectName} numberOfLines={1}>{project.data.name}</Text>
                {project.data.is_demo ? <Badge label="DEMO" tone="violet" dot={false} /> : null}
              </View>
              <Text style={styles.repo} numberOfLines={1}>{project.data.repo_url}</Text>
            </>
          ) : (
            <View style={styles.headerSkeleton}><Skeleton width="58%" height={16} /><Skeleton width="82%" height={11} /></View>
          )}
        </View>
        {project.data ? <StatePill state={project.data.status} /> : null}
      </View>

      {project.data ? (
        <Card tone={incident ? 'red' : 'mint'} style={styles.healthCard}>
          <LiveDot color={incident ? palette.red : palette.mint} pulse={incident} size={9} />
          <View style={styles.healthCopy}>
            <Text style={styles.healthLabel}>
              {project.data.is_demo ? 'DEMO INCIDENT' : incident ? 'INCIDENT DETECTED' : 'PRODUCTION HEALTHY'}
            </Text>
            <Text style={styles.healthText}>{project.data.health_summary}</Text>
          </View>
          <Button
            label="CALL"
            trailing="↗"
            variant="light"
            size="sm"
            accessibilityLabel="Call your engineer about this project"
            onPress={() => router.push({ pathname: '/voice', params: { projectId: id! } })}
          />
        </Card>
      ) : null}

      <Divider style={styles.rule} />
      <Text style={styles.eyebrow}>NEW MISSION</Text>
      <Text style={styles.title}>What outcome should your engineer own?</Text>

      <View style={styles.modeRow}>
        {(['fix', 'modify'] as const).map((value) => (
          <Chip key={value} label={value.toUpperCase()} active={mode === value} onPress={() => setMode(value)} />
        ))}
        <View style={styles.modeSpacer} />
        <Chip
          label={autopilot ? 'AUTOPILOT' : 'ASSISTED'}
          active={autopilot}
          tone="violet"
          onPress={() => setAutopilot((value) => !value)}
        />
      </View>

      <View style={styles.composer}>
        <TextInput
          value={composedGoal}
          onChangeText={setGoal}
          placeholder="Describe the outcome, not the implementation…"
          placeholderTextColor={palette.mutedDeep}
          style={styles.input}
          multiline
          maxLength={8000}
          textAlignVertical="top"
          accessibilityLabel="Mission brief"
        />
        <View style={styles.composerFooter}>
          <View style={styles.safetyCopy}>
            <Text style={styles.safety}>{autopilot ? 'ALEX WILL OPEN THE PR AFTER TESTS' : 'READ → PLAN → CHANGE → VERIFY'}</Text>
            <Text style={styles.counter}>{composedGoal.trim().length}/8000</Text>
          </View>
          <Button
            label="START MISSION"
            trailing="↗"
            loading={createTask.isPending}
            disabled={tooShort}
            onPress={() => createTask.mutate()}
          />
        </View>
      </View>
      {createTask.isError ? <Text style={styles.error}>{createTask.error.message}</Text> : null}

      <SectionHeader title="RECENT ACTIVITY" count={tasks.data?.length ?? 0} />
      {tasks.isLoading && !tasks.data ? <SkeletonCard lines={2} /> : null}
      {tasks.data?.map((task) => (
        <Card
          key={task.id}
          accessibilityLabel={`Open mission: ${task.goal}`}
          onPress={() => router.push({ pathname: '/task/[id]', params: { id: task.id } })}
          style={styles.taskCard}>
          <View style={styles.taskTop}>
            <Badge label={task.mode.toUpperCase()} tone="amber" dot={false} />
            <View style={styles.modeSpacer} />
            <StatePill state={task.state} />
          </View>
          <Text style={styles.taskGoal} numberOfLines={2}>{task.goal}</Text>
          <MissionProgress state={task.state} />
          <Text style={styles.taskDate}>{new Date(task.created_at).toLocaleString()}</Text>
        </Card>
      ))}
      {!tasks.isLoading && tasks.data?.length === 0 ? (
        <Text style={styles.noTasks}>No missions yet. Your first verified outcome starts here.</Text>
      ) : null}
    </ScrollView>
  );
}

function Chip({ label, active, onPress, tone = 'paper' }: {
  label: string; active: boolean; onPress: () => void; tone?: 'paper' | 'violet';
}) {
  const activeStyle = tone === 'violet' ? styles.chipActiveViolet : styles.chipActive;
  return (
    <Touchable
      onPress={onPress}
      accessibilityState={{ selected: active }}
      style={[styles.chip, active && activeStyle]}
      hoverStyle={active ? undefined : styles.chipHover}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Touchable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.ink },
  content: { padding: spacing.lg, paddingBottom: 80, maxWidth: layout.narrowWidth, width: '100%', alignSelf: 'center' },

  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerCopy: { flex: 1 },
  headerSkeleton: { gap: 8 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  projectName: { ...type.heading, color: palette.paper, flexShrink: 1 },
  repo: { ...type.caption, color: palette.muted, fontSize: 11, marginTop: 4 },

  healthCard: { flexDirection: 'row', alignItems: 'center', gap: 11, marginTop: 20 },
  healthCopy: { flex: 1 },
  healthLabel: { ...type.label, color: palette.paper, fontSize: 8 },
  healthText: { ...type.caption, color: palette.muted, fontSize: 11, marginTop: 4 },

  rule: { marginVertical: spacing.xl },
  eyebrow: { ...type.label, color: palette.mint },
  title: { ...type.title, color: palette.paper, marginTop: 10 },

  modeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 22 },
  modeSpacer: { flex: 1 },
  chip: { borderColor: palette.line, borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: 15, paddingVertical: 9 },
  chipHover: { borderColor: palette.lineBright, backgroundColor: palette.panel },
  chipActive: { backgroundColor: palette.paper, borderColor: palette.paper },
  chipActiveViolet: { backgroundColor: palette.violet, borderColor: palette.violet },
  chipText: { ...type.label, color: palette.muted },
  chipTextActive: { color: palette.ink },

  composer: {
    backgroundColor: palette.panel, borderRadius: radius.lg, borderWidth: 1,
    borderColor: palette.line, marginTop: 12, overflow: 'hidden',
  },
  input: { minHeight: 148, color: palette.paper, padding: spacing.md, fontSize: 16, lineHeight: 24 },
  composerFooter: {
    borderTopWidth: 1, borderTopColor: palette.line, padding: 12,
    flexDirection: 'row', alignItems: 'center', gap: 12,
  },
  safetyCopy: { flex: 1, gap: 5 },
  safety: { ...type.label, color: palette.mutedDeep, fontSize: 8 },
  counter: { ...type.label, color: palette.mutedDeep, fontSize: 8, opacity: 0.7 },
  error: { ...type.body, color: palette.red, marginTop: 12 },

  taskCard: { marginBottom: 10, gap: 14 },
  taskTop: { flexDirection: 'row', alignItems: 'center' },
  taskGoal: { ...type.bodyStrong, color: palette.paper },
  taskDate: { ...type.label, color: palette.mutedDeep, fontSize: 8 },
  noTasks: { ...type.body, color: palette.muted, textAlign: 'center', padding: spacing.lg },
});
