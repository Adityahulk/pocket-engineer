import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { StatePill } from '@/components/state-pill';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { EmptyState, ErrorState, ScreenIntro } from '@/components/ui/section';
import { SkeletonCard } from '@/components/ui/skeleton';
import { api } from '@/lib/api';
import { useLiveInterval, usePullToRefresh } from '@/lib/live';
import { layout, palette, spacing, type } from '@/lib/theme';

export default function DecisionsScreen() {
  const insets = useSafeAreaInsets();
  const decisions = useQuery({ queryKey: ['decisions'], queryFn: api.decisions, refetchInterval: useLiveInterval(4_000) });
  const pull = usePullToRefresh(decisions.refetch);
  const loading = decisions.isLoading && !decisions.data;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.lg }]}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={pull.refreshing} onRefresh={pull.onRefresh} tintColor={palette.citron} />}>
      <ScreenIntro
        eyebrow="HUMAN GATE"
        title="Decisions"
        body="Verified patches waiting for you. Approve to open a PR, or reject and tell Alex what to change."
      />

      {loading ? <><SkeletonCard /><SkeletonCard /></> : null}

      {decisions.data?.map((task) => (
        <Card
          key={task.id}
          accessibilityLabel={`Review patch: ${task.goal}`}
          onPress={() => router.push({ pathname: '/task/[id]', params: { id: task.id } })}
          style={styles.card}>
          <View style={styles.top}>
            <Badge label={task.mode.toUpperCase()} tone="amber" />
            {task.priority !== 'normal' ? <Badge label={task.priority.toUpperCase()} tone="red" icon="alert-circle" /> : null}
            <View style={styles.spacer} />
            <StatePill state={task.state} />
          </View>
          <Text style={styles.goal}>{task.goal}</Text>
          <View style={styles.footer}>
            <Avatar name={task.engineer_name} size={26} tone="accent" />
            <Text style={styles.owner}>{task.engineer_name}</Text>
            <Text style={styles.review}>REVIEW PATCH</Text>
            <Icon name="chevron-right" size={14} color={palette.citron} />
          </View>
        </Card>
      ))}

      {decisions.isError && !decisions.data ? (
        <ErrorState title="Could not load decisions" error={decisions.error} onRetry={pull.onRefresh} />
      ) : null}

      {!loading && !decisions.isError && !decisions.data?.length ? (
        <EmptyState
          icon="check-circle"
          title="Nothing waiting on you"
          body="Alex will ping you the moment a patch passes verification and needs a human decision."
        >
          <Button label="SEE ACTIVE MISSIONS" variant="secondary" trailingIcon="chevron-right" onPress={() => router.navigate('/missions')} />
        </EmptyState>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.ink },
  content: { padding: spacing.lg, paddingBottom: 80, maxWidth: layout.maxWidth, width: '100%', alignSelf: 'center' },
  card: { marginBottom: 10 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  spacer: { flex: 1 },
  goal: { ...type.heading, color: palette.paper, fontSize: 17, lineHeight: 24, marginTop: 14 },
  footer: { flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 16 },
  owner: { ...type.caption, color: palette.muted, flex: 1 },
  review: { ...type.label, color: palette.citron, fontSize: 8 },
});
