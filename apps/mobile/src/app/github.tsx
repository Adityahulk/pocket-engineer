import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { api } from '@/lib/api';
import { palette, radius, spacing, type } from '@/lib/theme';
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
    return <View style={styles.center}><Text style={styles.title}>Installation ID missing</Text><Text style={styles.body}>Set the GitHub App setup URL to this site’s /github path, or pocket-engineer://github for a native build.</Text></View>;
  }

  return <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
    <Text style={styles.eyebrow}>GITHUB APP INSTALLED</Text><Text style={styles.title}>Choose a repository</Text>
    <Text style={styles.body}>Pocket Engineer receives access only to repositories selected during installation.</Text>
    {repositories.isLoading && <ActivityIndicator style={styles.loader} color={palette.mint} />}
    {repositories.isError && <Text style={styles.error}>{repositories.error.message}</Text>}
    {repositories.data?.map((repository) => <Pressable key={repository.full_name} onPress={() => connect.mutate(repository)}
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.72 }]}>
      <View style={styles.icon}><Text style={styles.iconText}>GH</Text></View><View style={styles.copy}><Text style={styles.name}>{repository.full_name}</Text><Text style={styles.meta}>{repository.private ? 'PRIVATE' : 'PUBLIC'} · {repository.default_branch}</Text></View><Text style={styles.arrow}>›</Text>
    </Pressable>)}
    {connect.isError && <Text style={styles.error}>{connect.error.message}</Text>}
  </ScrollView>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.ink }, content: { padding: spacing.lg, paddingBottom: 60, maxWidth: 720, width: '100%', alignSelf: 'center' }, center: { flex: 1, backgroundColor: palette.ink, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  eyebrow: { ...type.label, color: palette.mint, marginTop: 16 }, title: { color: palette.paper, fontSize: 30, fontWeight: '900', letterSpacing: -1, marginTop: 10 }, body: { color: palette.muted, fontSize: 14, lineHeight: 21, marginTop: 10, marginBottom: 22, textAlign: 'left' }, loader: { marginTop: 30 },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: palette.panel, borderWidth: 1, borderColor: palette.line, borderRadius: radius.md, padding: spacing.md, marginBottom: 10 }, icon: { width: 40, height: 40, borderRadius: 12, backgroundColor: palette.paper, alignItems: 'center', justifyContent: 'center' }, iconText: { color: palette.ink, fontWeight: '900', fontSize: 10 }, copy: { flex: 1, marginLeft: 12 }, name: { color: palette.paper, fontSize: 14, fontWeight: '800' }, meta: { ...type.label, color: palette.muted, fontSize: 8, marginTop: 5 }, arrow: { color: palette.muted, fontSize: 26 }, error: { color: palette.red, lineHeight: 20, marginTop: 12 },
});
