import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { EmptyState, ScreenIntro } from '@/components/ui/section';
import { SkeletonCard } from '@/components/ui/skeleton';
import { api } from '@/lib/api';
import { layout, palette, radius, spacing, type } from '@/lib/theme';
import type { GitHubRepository } from '@/lib/types';

export default function GitHubRepositoryScreen() {
  const params = useLocalSearchParams<{ installation_id?: string }>();
  const queryClient = useQueryClient();
  const installationId = Number(params.installation_id);
  const repositories = useQuery({
    queryKey: ['github-repositories', installationId],
    queryFn: () => api.githubRepositories(installationId),
    enabled: Number.isFinite(installationId) && installationId > 0,
  });
  const connect = useMutation({
    mutationFn: (repository: GitHubRepository) => api.createProject(repository, installationId),
    onSuccess: async (project) => {
      await queryClient.invalidateQueries({ queryKey: ['projects'] });
      await queryClient.invalidateQueries({ queryKey: ['command-center'] });
      router.replace({ pathname: '/project/[id]', params: { id: project.id } });
    },
  });

  if (!Number.isFinite(installationId)) {
    return (
      <View style={styles.center}>
        <EmptyState
          glyph="⚙"
          title="Installation ID missing"
          body="Set the GitHub App setup URL to this site’s /github path, or pocket-engineer://github for a native build."
        />
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <ScreenIntro
        eyebrow="GITHUB APP INSTALLED"
        title="Choose a repository"
        body="Pocket Engineer receives access only to repositories selected during installation."
      />

      {repositories.isLoading ? <><SkeletonCard lines={1} /><SkeletonCard lines={1} /></> : null}
      {repositories.isError ? <Text style={styles.error}>{repositories.error.message}</Text> : null}

      {repositories.data?.map((repository) => (
        <Card
          key={repository.full_name}
          accessibilityLabel={`Connect ${repository.full_name}`}
          onPress={() => connect.mutate(repository)}
          style={styles.card}>
          <View style={styles.icon}><Text style={styles.iconText}>GH</Text></View>
          <View style={styles.copy}>
            <Text style={styles.name} numberOfLines={1}>{repository.full_name}</Text>
            <Text style={styles.meta}>{repository.default_branch}</Text>
          </View>
          <Badge label={repository.private ? 'PRIVATE' : 'PUBLIC'} tone={repository.private ? 'mint' : 'neutral'} dot={false} />
          <Text style={styles.arrow}>›</Text>
        </Card>
      ))}

      {!repositories.isLoading && repositories.data?.length === 0 ? (
        <EmptyState
          glyph="◌"
          title="No repositories shared"
          body="Open the GitHub App installation settings and grant access to at least one repository."
        />
      ) : null}

      {connect.isError ? <Text style={styles.error}>{connect.error.message}</Text> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.ink },
  content: { padding: spacing.lg, paddingBottom: 60, maxWidth: layout.narrowWidth, width: '100%', alignSelf: 'center' },
  center: { flex: 1, backgroundColor: palette.ink, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  card: { flexDirection: 'row', alignItems: 'center', gap: 11, marginBottom: 10 },
  icon: { width: 40, height: 40, borderRadius: radius.md, backgroundColor: palette.paper, alignItems: 'center', justifyContent: 'center' },
  iconText: { color: palette.ink, fontWeight: '900', fontSize: 10 },
  copy: { flex: 1 },
  name: { ...type.bodyStrong, color: palette.paper },
  meta: { ...type.label, color: palette.muted, fontSize: 8, marginTop: 5 },
  arrow: { color: palette.muted, fontSize: 24 },
  error: { ...type.body, color: palette.red, marginTop: 12 },
});
