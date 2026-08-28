import { useQuery } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import * as WebBrowser from 'expo-web-browser';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { Alert, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar } from '@/components/ui/avatar';
import { Badge, LiveDot } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Divider, SectionHeader } from '@/components/ui/section';
import { Skeleton } from '@/components/ui/skeleton';
import { Touchable } from '@/components/ui/touchable';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { registerPushNotifications } from '@/lib/notifications';
import { glow, layout, palette, radius, shadow, spacing, type } from '@/lib/theme';

export default function CommandCenterScreen() {
  const auth = useAuth();
  const center = useQuery({ queryKey: ['command-center'], queryFn: api.commandCenter, refetchInterval: 4_000 });
  const github = useQuery({ queryKey: ['github-config'], queryFn: api.githubConfig });
  const primaryProject = center.data?.projects.find((project) => project.health_status === 'incident') ?? center.data?.projects[0];
  const hour = new Date().getHours();
  const hello = hour < 12 ? 'Good morning.' : hour < 18 ? 'Good afternoon.' : 'Good evening.';
  const engineerName = center.data?.engineer_name ?? 'Alex';
  const loading = center.isLoading && !center.data;

  useEffect(() => { void registerPushNotifications(); }, []);

  function callEngineer(projectId?: string) {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push({ pathname: '/voice', params: projectId ? { projectId } : {} });
  }

  async function connectGitHub() {
    if (!github.data?.installation_url) {
      Alert.alert('GitHub App not configured', 'Add POCKET_GITHUB_APP_SLUG on the API to enable GitHub installation. The local incident demo is ready now.');
      return;
    }
    await WebBrowser.openBrowserAsync(github.data.installation_url);
  }

  return <View style={styles.screen}>
    <View style={styles.glowOne} /><View style={styles.glowTwo} />
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={center.isFetching} onRefresh={() => center.refetch()} tintColor={palette.mint} />}>
        <View style={styles.brandRow}>
          <View style={styles.mark}><Text style={styles.markText}>PE</Text></View>
          <View style={styles.brandCopy}>
            <Text style={styles.brand}>Mission Control</Text>
            <Text style={styles.brandSub}>POCKET ENGINEER</Text>
          </View>
          <Badge
            label={center.isError ? 'OFFLINE' : 'LIVE'}
            tone={center.isError ? 'red' : 'mint'}
            pulse={!center.isError}
          />
        </View>

        <View style={styles.heroRow}>
          <View style={styles.heroCopy}>
            <Text style={styles.eyebrow}>YOUR SOFTWARE ESTATE</Text>
            <Text style={styles.title}>{hello}</Text>
            <Text style={styles.subtitle}>Talk to {engineerName} and it gets done.</Text>
          </View>
          <Touchable
            accessibilityLabel="Call your engineer"
            onPress={() => callEngineer(primaryProject?.id)}
            style={styles.callButton}
            hoverStyle={styles.callButtonHover}>
            <View style={styles.callWaves}><View style={styles.waveSmall} /><View style={styles.waveTall} /><View style={styles.waveMid} /></View>
            <Text style={styles.callText}>CALL{`\n`}ENGINEER</Text>
          </Touchable>
        </View>

        <View style={styles.metrics}>
          <Metric
            value={center.data?.incident_count ?? 0}
            label="INCIDENTS"
            color={center.data?.incident_count ? palette.red : palette.mint}
            loading={loading}
            onPress={() => primaryProject && router.push({ pathname: '/project/[id]', params: { id: primaryProject.id } })}
          />
          <Metric value={center.data?.active_missions ?? 0} label="MISSIONS" color={palette.amber} loading={loading} onPress={() => router.push('/missions')} />
          <Metric value={center.data?.approval_count ?? 0} label="DECISIONS" color={palette.blue} loading={loading} last onPress={() => router.push('/inbox')} />
        </View>

        {center.data?.incident_count ? (
          <Card
            tone="red"
            padded={false}
            accessibilityLabel={`Investigate incident in ${primaryProject?.name ?? 'project'}`}
            onPress={() => primaryProject && router.push({ pathname: '/project/[id]', params: { id: primaryProject.id } })}
            style={styles.incidentCard}>
            <View style={styles.incidentBody}>
              <View style={styles.incidentTop}>
                <View style={styles.alertIcon}><Text style={styles.alertIconText}>!</Text></View>
                <View style={styles.incidentCopy}>
                  <Text style={styles.incidentLabel}>PRODUCTION INCIDENT</Text>
                  <Text style={styles.incidentTitle}>{primaryProject?.name}</Text>
                </View>
                <Text style={styles.arrow}>↗</Text>
              </View>
              <Text style={styles.incidentSummary}>{primaryProject?.health_summary}</Text>
            </View>
            <View style={styles.incidentFooter}>
              <Text style={styles.incidentAction}>TAP TO INVESTIGATE</Text>
              <LiveDot color={palette.red} pulse size={6} />
              <Text style={styles.incidentTime}>LIVE</Text>
            </View>
          </Card>
        ) : (
          <Card tone="mint" style={styles.healthyCard}>
            <View style={styles.healthyIconWrap}><Text style={styles.healthyIcon}>✓</Text></View>
            <View style={styles.healthyCopy}>
              <Text style={styles.healthyTitle}>{loading ? 'Checking your estate…' : 'All systems healthy'}</Text>
              <Text style={styles.healthyText}>Your AI engineers are standing by.</Text>
            </View>
          </Card>
        )}

        <SectionHeader title="AI ENGINEERS" count={center.data?.engineers.length ?? 0} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.engineerRail}>
          {center.data?.engineers.map((engineer) => (
            <Card
              key={engineer.id}
              accessibilityLabel={`Call ${engineer.name}`}
              onPress={() => callEngineer(engineer.project_id ?? primaryProject?.id)}
              style={styles.engineerCard}>
              <View style={styles.engineerHead}>
                <Avatar name={engineer.name} size={38} tone="blue" />
                <View style={styles.engineerStatus}>
                  <LiveDot color={engineer.status === 'available' ? palette.mint : palette.amber} pulse={engineer.status !== 'available'} />
                  <Text style={styles.engineerStatusText}>{engineer.status.replaceAll('_', ' ').toUpperCase()}</Text>
                </View>
              </View>
              <Text style={styles.engineerName}>{engineer.name}</Text>
              <Text style={styles.engineerSpecialty} numberOfLines={2}>{engineer.specialty}</Text>
            </Card>
          ))}
          <Card tone="mint" accessibilityLabel="Talk it through" onPress={() => callEngineer(primaryProject?.id)} style={styles.engineerCallCard}>
            <Text style={styles.engineerCallIcon}>◉</Text>
            <Text style={styles.engineerCallTitle}>Talk it through</Text>
            <Text style={styles.engineerCallSub}>Say what you want done</Text>
          </Card>
        </ScrollView>

        <SectionHeader title="MY SOFTWARE" count={center.data?.projects.length ?? 0} />
        {center.isError && (
          <Card tone="red" style={styles.errorCard}>
            <Text style={styles.errorTitle}>Mission Control is offline</Text>
            <Text style={styles.errorText}>Start the API, then pull down to retry.{`\n`}{api.baseUrl}</Text>
          </Card>
        )}
        {loading && !center.isError ? (
          <View style={styles.projectSkeletons}>
            {[0, 1].map((key) => (
              <View key={key} style={styles.projectSkeleton}>
                <Skeleton width={45} height={45} round={radius.md} />
                <View style={styles.projectSkeletonCopy}><Skeleton width="52%" height={13} /><Skeleton width="80%" height={11} /></View>
              </View>
            ))}
          </View>
        ) : null}
        {center.data?.projects.map((project) => {
          const incident = project.health_status === 'incident';
          return (
            <Card
              key={project.id}
              accessibilityLabel={`Open ${project.name}`}
              onPress={() => router.push({ pathname: '/project/[id]', params: { id: project.id } })}
              style={styles.projectCard}>
              <Avatar name={project.name} size={45} square tone={incident ? 'red' : 'blue'} />
              <View style={styles.projectCopy}>
                <View style={styles.projectNameRow}>
                  <Text style={styles.projectName} numberOfLines={1}>{project.name}</Text>
                  {project.is_demo ? <Badge label="DEMO" tone="violet" dot={false} style={styles.demoBadge} /> : null}
                </View>
                <Text style={styles.projectHealth} numberOfLines={1}>{project.health_summary}</Text>
              </View>
              <View style={styles.projectRight}>
                <LiveDot color={incident ? palette.red : palette.mint} pulse={incident} size={7} />
                <Text style={styles.projectArrow}>›</Text>
              </View>
            </Card>
          );
        })}

        <Card tone="outline" accessibilityLabel="Connect software from GitHub" onPress={connectGitHub} style={styles.connect}>
          <Text style={styles.connectPlus}>＋</Text>
          <Text style={styles.connectText}>CONNECT SOFTWARE</Text>
          <Text style={styles.connectProvider}>GITHUB</Text>
        </Card>

        <Divider style={styles.footerRule} />
        <Text style={styles.footer}>OBSERVE · DIRECT · VERIFY · SHIP</Text>
        {auth.session ? (
          <Button
            label={`SIGN OUT · ${auth.session.user.email ?? ''}`.toUpperCase()}
            variant="ghost"
            size="sm"
            onPress={() => { void auth.signOut(); }}
            style={styles.signOut}
          />
        ) : null}
      </ScrollView>
    </SafeAreaView>
  </View>;
}

function Metric({ value, label, color, last = false, loading = false, onPress }: {
  value: number; label: string; color: string; last?: boolean; loading?: boolean; onPress?: () => void;
}) {
  return (
    <Touchable
      onPress={onPress}
      accessibilityLabel={`${value} ${label.toLowerCase()}`}
      style={[styles.metric, !last && styles.metricBorder]}
      hoverStyle={styles.metricHover}>
      {loading
        ? <Skeleton width={28} height={24} />
        : <Text style={[styles.metricValue, { color }]}>{value}</Text>}
      <Text style={styles.metricLabel}>{label}</Text>
    </Touchable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.ink, overflow: 'hidden' },
  safe: { flex: 1 },
  content: { paddingHorizontal: spacing.lg, paddingBottom: 72, maxWidth: layout.maxWidth, width: '100%', alignSelf: 'center' },
  glowOne: { position: 'absolute', width: 380, height: 380, borderRadius: 190, backgroundColor: '#123D51', opacity: 0.24, top: -190, right: -140 },
  glowTwo: { position: 'absolute', width: 240, height: 240, borderRadius: 120, backgroundColor: '#3D161E', opacity: 0.18, top: 420, left: -180 },

  brandRow: { height: 74, flexDirection: 'row', alignItems: 'center', gap: 11 },
  mark: { width: 36, height: 36, borderRadius: 11, backgroundColor: palette.mint, alignItems: 'center', justifyContent: 'center' },
  markText: { color: palette.ink, fontWeight: '900', fontSize: 12 },
  brandCopy: { flex: 1 },
  brand: { color: palette.paper, fontSize: 16, fontWeight: '900', letterSpacing: -0.3 },
  brandSub: { ...type.label, color: palette.mutedDeep, fontSize: 7, marginTop: 3 },

  heroRow: { flexDirection: 'row', alignItems: 'flex-end', paddingTop: 34, paddingBottom: 28, gap: spacing.md },
  heroCopy: { flex: 1 },
  eyebrow: { ...type.label, color: palette.mint },
  title: { ...type.display, color: palette.paper, marginTop: 13 },
  subtitle: { ...type.display, color: palette.muted, fontSize: 26, lineHeight: 32, letterSpacing: -0.9, marginTop: 4 },
  callButton: {
    width: 96, height: 96, borderRadius: 48, backgroundColor: palette.mint,
    alignItems: 'center', justifyContent: 'center', ...shadow, ...glow('#0C6B52'),
  },
  callButtonHover: { backgroundColor: '#A6F5D5' },
  callWaves: { height: 23, flexDirection: 'row', alignItems: 'center', gap: 3 },
  waveSmall: { width: 3, height: 9, borderRadius: 2, backgroundColor: palette.ink },
  waveTall: { width: 3, height: 22, borderRadius: 2, backgroundColor: palette.ink },
  waveMid: { width: 3, height: 14, borderRadius: 2, backgroundColor: palette.ink },
  callText: { color: palette.ink, fontSize: 8, lineHeight: 10, fontWeight: '900', letterSpacing: 1, textAlign: 'center', marginTop: 6 },

  metrics: {
    flexDirection: 'row', backgroundColor: palette.panel, borderColor: palette.line,
    borderWidth: 1, borderRadius: radius.lg, marginBottom: 15, overflow: 'hidden',
  },
  metric: { flex: 1, paddingVertical: 15, alignItems: 'center', gap: 5 },
  metricHover: { backgroundColor: palette.panelHover },
  metricBorder: { borderRightWidth: 1, borderRightColor: palette.line },
  metricValue: { fontSize: 24, lineHeight: 28, fontWeight: '900', letterSpacing: -1 },
  metricLabel: { ...type.label, color: palette.muted, fontSize: 7 },

  incidentCard: { overflow: 'hidden' },
  incidentBody: { padding: spacing.md },
  incidentTop: { flexDirection: 'row', alignItems: 'center' },
  alertIcon: { width: 42, height: 42, borderRadius: 13, backgroundColor: palette.red, alignItems: 'center', justifyContent: 'center' },
  alertIconText: { color: palette.ink, fontSize: 21, fontWeight: '900' },
  incidentCopy: { flex: 1, marginLeft: 12 },
  incidentLabel: { ...type.label, color: palette.red, fontSize: 8 },
  incidentTitle: { ...type.heading, color: palette.paper, marginTop: 5 },
  arrow: { color: palette.redText, fontSize: 19 },
  incidentSummary: { ...type.body, color: palette.redText, marginTop: 14 },
  incidentFooter: {
    flexDirection: 'row', alignItems: 'center', gap: 7, borderTopWidth: 1, borderTopColor: palette.redLine,
    paddingHorizontal: spacing.md, paddingVertical: 12,
  },
  incidentAction: { ...type.label, color: palette.red, flex: 1, fontSize: 8 },
  incidentTime: { ...type.label, color: palette.redText, fontSize: 8 },

  healthyCard: { flexDirection: 'row', alignItems: 'center', gap: 13 },
  healthyIconWrap: { width: 38, height: 38, borderRadius: radius.md, backgroundColor: palette.mintLine, alignItems: 'center', justifyContent: 'center' },
  healthyIcon: { color: palette.mint, fontSize: 19, fontWeight: '900' },
  healthyCopy: { flex: 1 },
  healthyTitle: { ...type.bodyStrong, color: palette.paper },
  healthyText: { ...type.caption, color: palette.mintText, marginTop: 3 },

  engineerRail: { gap: 10, paddingRight: spacing.lg, paddingBottom: 4 },
  engineerCard: { width: 178 },
  engineerHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  engineerStatus: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  engineerStatusText: { ...type.label, color: palette.muted, fontSize: 7 },
  engineerName: { ...type.bodyStrong, color: palette.paper, marginTop: 14 },
  engineerSpecialty: { ...type.caption, color: palette.muted, fontSize: 11, marginTop: 4 },
  engineerCallCard: { width: 178, justifyContent: 'center' },
  engineerCallIcon: { color: palette.mint, fontSize: 22 },
  engineerCallTitle: { ...type.bodyStrong, color: palette.paper, marginTop: 12 },
  engineerCallSub: { ...type.caption, color: palette.mintText, fontSize: 11, marginTop: 4 },

  projectSkeletons: { gap: 10, marginBottom: 10 },
  projectSkeleton: {
    flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: palette.panel,
    borderColor: palette.line, borderWidth: 1, borderRadius: radius.lg, padding: 13,
  },
  projectSkeletonCopy: { flex: 1, gap: 8 },
  projectCard: { flexDirection: 'row', alignItems: 'center', padding: 13, marginBottom: 10 },
  projectCopy: { flex: 1, marginLeft: 12 },
  projectNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  projectName: { ...type.bodyStrong, color: palette.paper, flexShrink: 1 },
  demoBadge: { paddingVertical: 2, paddingHorizontal: 7 },
  projectHealth: { ...type.caption, color: palette.muted, fontSize: 11, marginTop: 4 },
  projectRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  projectArrow: { color: palette.muted, fontSize: 24 },

  connect: { flexDirection: 'row', alignItems: 'center', padding: 15, marginTop: 4 },
  connectPlus: { color: palette.mint, fontSize: 19 },
  connectText: { ...type.label, color: palette.paper, marginLeft: 11, flex: 1 },
  connectProvider: { ...type.label, color: palette.mutedDeep, fontSize: 8 },

  errorCard: { marginBottom: 12 },
  errorTitle: { ...type.bodyStrong, color: palette.red },
  errorText: { ...type.caption, color: palette.redText, marginTop: 6 },

  footerRule: { marginTop: spacing.xl },
  footer: { ...type.label, color: palette.mutedDeep, textAlign: 'center', marginTop: 18 },
  signOut: { alignSelf: 'center', marginTop: 18, maxWidth: 320 },
});
