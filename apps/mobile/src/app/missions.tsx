import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { MissionProgress } from '@/components/ui/progress';
import { EmptyState, ScreenIntro } from '@/components/ui/section';
import { SkeletonCard } from '@/components/ui/skeleton';
import { api } from '@/lib/api';
import { layout, palette, spacing, type } from '@/lib/theme';

export default function MissionsScreen() {
  const missions = useQuery({ queryKey: ['missions'], queryFn: api.missions, refetchInterval: 3_000 });
  const loading = missions.isLoading && !missions.data;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={missions.isFetching} onRefresh={() => missions.refetch()} tintColor={palette.citron} />}>
      <ScreenIntro
        eyebrow="IN FLIGHT"
        eyebrowTone={palette.amber}
        title="Active missions"
        body="Work Alex is investigating, changing, or verifying right now."
      />

      {loading ? <><SkeletonCard lines={3} /><SkeletonCard lines={3} /></> : null}

      {missions.data?.map((task) => (
        <Card
          key={task.id}
          accessibilityLabel={`Open mission: ${task.goal}`}
          onPress={() => router.push({ pathname: '/task/[id]', params: { id: task.id } })}
          style={styles.card}>
          <View style={styles.top}>
            <Badge label={task.autonomy.toUpperCase()} tone={task.autonomy === 'autopilot' ? 'violet' : 'accent'} icon={task.autonomy === 'autopilot' ? 'zap' : 'user-check'} />
            <Badge label={task.mode.toUpperCase()} tone="neutral" />
            <View style={styles.spacer} />
            <Avatar name={task.engineer_name} size={26} tone="accent" />
          </View>
          <Text style={styles.goal} numberOfLines={3}>{task.goal}</Text>
          <MissionProgress state={task.state} />
        </Card>
      ))}

      {!loading && !missions.data?.length ? (
        <EmptyState
          icon="activity"
          title="No missions in flight"
          body="Call Alex, describe the outcome you want, and the mission starts itself."
        >
          <Button label="CALL ENGINEER" icon="mic" onPress={() => router.push('/voice')} />
        </EmptyState>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.ink },
  content: { padding: spacing.lg, paddingBottom: 80, maxWidth: layout.maxWidth, width: '100%', alignSelf: 'center' },
  card: { marginBottom: 10, gap: 16 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  spacer: { flex: 1 },
  goal: { ...type.heading, color: palette.paper, fontSize: 16, lineHeight: 23 },
});
