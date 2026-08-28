import { useQuery } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import * as WebBrowser from 'expo-web-browser';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { Alert, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LogoLockup } from '@/components/brand/logo';
import { Avatar } from '@/components/ui/avatar';
import { Badge, LiveDot } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Divider, SectionHeader } from '@/components/ui/section';
import { Skeleton } from '@/components/ui/skeleton';
import { Touchable } from '@/components/ui/touchable';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { registerPushNotifications } from '@/lib/notifications';
import { fonts, glow, layout, palette, radius, spacing, type } from '@/lib/theme';

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
    {/* Layered discs stand in for a soft radial gradient. */}
    <View style={[styles.glow, styles.glowFar]} />
    <View style={[styles.glow, styles.glowMid]} />
    <View style={[styles.glow, styles.glowNear]} />
    <View style={styles.glowIncident} />
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={center.isFetching} onRefresh={() => center.refetch()} tintColor={palette.citron} />}>
        <View style={styles.brandRow}>
          <LogoLockup size={34} />
          <View style={styles.brandSpacer} />
          <Badge
            label={center.isError ? 'OFFLINE' : 'LIVE'}
            tone={center.isError ? 'red' : 'accent'}
            dot
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
            <View style={styles.callWaves}>
              {[9, 16, 24, 15, 10].map((height, index) => (
                <View key={index} style={[styles.waveBar, { height }]} />
              ))}
            </View>
            <Text style={styles.callText}>CALL</Text>
          </Touchable>
        </View>

        <View style={styles.metrics}>
          <Metric
            value={center.data?.incident_count ?? 0}
            label="INCIDENTS"
            color={center.data?.incident_count ? palette.red : palette.citron}
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
                <View style={styles.alertIcon}><Icon name="alert-triangle" size={17} color={palette.red} /></View>
                <View style={styles.incidentCopy}>
                  <Text style={styles.incidentLabel}>PRODUCTION INCIDENT</Text>
                  <Text style={styles.incidentTitle}>{primaryProject?.name}</Text>
                </View>
                <Icon name="arrow-up-right" size={16} color={palette.redText} />
              </View>
              <Text style={styles.incidentSummary}>{primaryProject?.health_summary}</Text>
            </View>
            <View style={styles.incidentFooter}>
              <Text style={styles.incidentAction}>TAP TO INVESTIGATE</Text>
              <LiveDot color={palette.red} pulse size={5} />
              <Text style={styles.incidentTime}>LIVE</Text>
            </View>
          </Card>
        ) : (
          <Card tone="accent" style={styles.healthyCard}>
            <View style={styles.healthyIconWrap}><Icon name="check" size={16} color={palette.citron} /></View>
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
                <Avatar name={engineer.name} size={36} tone="accent" square />
                <View style={styles.engineerStatus}>
                  <LiveDot color={engineer.status === 'available' ? palette.citron : palette.amber} pulse={engineer.status !== 'available'} size={5} />
                  <Text style={styles.engineerStatusText}>{engineer.status.replaceAll('_', ' ').toUpperCase()}</Text>
                </View>
              </View>
              <Text style={styles.engineerName}>{engineer.name}</Text>
              <Text style={styles.engineerSpecialty} numberOfLines={2}>{engineer.specialty}</Text>
            </Card>
          ))}
          <Card tone="accent" accessibilityLabel="Talk it through" onPress={() => callEngineer(primaryProject?.id)} style={styles.engineerCallCard}>
            <Icon name="mic" size={19} color={palette.citron} />
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
                <Skeleton width={44} height={44} round={radius.md} />
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
              <Avatar name={project.name} size={44} square tone={incident ? 'red' : 'quiet'} />
              <View style={styles.projectCopy}>
                <View style={styles.projectNameRow}>
                  <Text style={styles.projectName} numberOfLines={1}>{project.name}</Text>
                  {project.is_demo ? <Badge label="DEMO" tone="violet" style={styles.demoBadge} /> : null}
                </View>
                <Text style={styles.projectHealth} numberOfLines={1}>{project.health_summary}</Text>
              </View>
              <View style={styles.projectRight}>
                <LiveDot color={incident ? palette.red : palette.citron} pulse={incident} size={6} />
                <Icon name="chevron-right" size={16} color={palette.mutedDeep} />
              </View>
            </Card>
          );
        })}

        <Card tone="outline" accessibilityLabel="Connect software from GitHub" onPress={connectGitHub} style={styles.connect}>
          <Icon name="plus" size={15} color={palette.citron} />
          <Text style={styles.connectText}>CONNECT SOFTWARE</Text>
          <Icon name="github" size={14} color={palette.mutedDeep} />
        </Card>

        <Divider style={styles.footerRule} />
        <Text style={styles.footer}>OBSERVE · DIRECT · VERIFY · SHIP</Text>
        {auth.session ? (
          <Button
            label={auth.session.user.email ?? 'SIGN OUT'}
            icon="log-out"
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
        ? <Skeleton width={26} height={22} />
        : <Text style={[styles.metricValue, { color }]}>{value.toString().padStart(2, '0')}</Text>}
      <Text style={styles.metricLabel}>{label}</Text>
    </Touchable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.ink, overflow: 'hidden' },
  safe: { flex: 1 },
  content: { paddingHorizontal: spacing.lg, paddingBottom: 72, maxWidth: layout.maxWidth, width: '100%', alignSelf: 'center' },
  glow: { position: 'absolute', backgroundColor: '#2A3D0C', opacity: 0.07 },
  glowFar: { width: 560, height: 560, borderRadius: 280, top: -300, right: -220 },
  glowMid: { width: 400, height: 400, borderRadius: 200, top: -230, right: -160 },
  glowNear: { width: 250, height: 250, borderRadius: 125, top: -160, right: -100 },
  glowIncident: { position: 'absolute', width: 300, height: 300, borderRadius: 150, backgroundColor: '#3A1319', opacity: 0.08, top: 420, left: -210 },

  brandRow: { height: 74, flexDirection: 'row', alignItems: 'center' },
  brandSpacer: { flex: 1 },

  heroRow: { flexDirection: 'row', alignItems: 'flex-end', paddingTop: 32, paddingBottom: 28, gap: spacing.md },
  heroCopy: { flex: 1 },
  eyebrow: { ...type.label, color: palette.citron },
  title: { ...type.display, color: palette.paper, marginTop: 14 },
  subtitle: { ...type.title, color: palette.muted, fontSize: 25, lineHeight: 31, marginTop: 4 },
  callButton: {
    width: 92, height: 92, borderRadius: 46, backgroundColor: palette.citron,
    alignItems: 'center', justifyContent: 'center', ...glow('#5C7A0F'),
  },
  callButtonHover: { backgroundColor: '#D7FF75' },
  callWaves: { height: 24, flexDirection: 'row', alignItems: 'center', gap: 3 },
  waveBar: { width: 3, borderRadius: 2, backgroundColor: palette.ink },
  callText: { ...type.label, color: palette.ink, fontSize: 9, letterSpacing: 1.4, marginTop: 7 },

  metrics: {
    flexDirection: 'row', backgroundColor: palette.panel, borderColor: palette.line,
    borderWidth: 1, borderRadius: radius.lg, marginBottom: 14, overflow: 'hidden',
  },
  metric: { flex: 1, paddingVertical: 15, alignItems: 'center', gap: 6 },
  metricHover: { backgroundColor: palette.panelHover },
  metricBorder: { borderRightWidth: 1, borderRightColor: palette.line },
  metricValue: { fontFamily: fonts.mono, fontSize: 23, lineHeight: 26 },
  metricLabel: { ...type.label, color: palette.mutedDeep, fontSize: 8 },

  incidentCard: { overflow: 'hidden' },
  incidentBody: { padding: spacing.md },
  incidentTop: { flexDirection: 'row', alignItems: 'center' },
  alertIcon: {
    width: 40, height: 40, borderRadius: radius.md, backgroundColor: '#2A1216',
    borderWidth: 1, borderColor: palette.redLine, alignItems: 'center', justifyContent: 'center',
  },
  incidentCopy: { flex: 1, marginLeft: 12 },
  incidentLabel: { ...type.label, color: palette.red, fontSize: 8 },
  incidentTitle: { ...type.heading, color: palette.paper, marginTop: 5 },
  incidentSummary: { ...type.body, color: palette.redText, marginTop: 14 },
  incidentFooter: {
    flexDirection: 'row', alignItems: 'center', gap: 7, borderTopWidth: 1, borderTopColor: palette.redLine,
    paddingHorizontal: spacing.md, paddingVertical: 12,
  },
  incidentAction: { ...type.label, color: palette.red, flex: 1, fontSize: 8 },
  incidentTime: { ...type.label, color: palette.redText, fontSize: 8 },

  healthyCard: { flexDirection: 'row', alignItems: 'center', gap: 13 },
  healthyIconWrap: {
    width: 36, height: 36, borderRadius: radius.md, backgroundColor: palette.ink,
    borderWidth: 1, borderColor: palette.citronLine, alignItems: 'center', justifyContent: 'center',
  },
  healthyCopy: { flex: 1 },
  healthyTitle: { ...type.bodyStrong, color: palette.paper },
  healthyText: { ...type.caption, color: palette.citronText, marginTop: 3 },

  engineerRail: { gap: 10, paddingRight: spacing.lg, paddingBottom: 4 },
  engineerCard: { width: 178 },
  engineerHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  engineerStatus: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  engineerStatusText: { ...type.label, color: palette.mutedDeep, fontSize: 7 },
  engineerName: { ...type.bodyStrong, color: palette.paper, marginTop: 14 },
  engineerSpecialty: { ...type.caption, color: palette.muted, fontSize: 11, marginTop: 4 },
  engineerCallCard: { width: 178, justifyContent: 'center' },
  engineerCallTitle: { ...type.bodyStrong, color: palette.paper, marginTop: 12 },
  engineerCallSub: { ...type.caption, color: palette.citronText, fontSize: 11, marginTop: 4 },

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
  demoBadge: { paddingVertical: 2, paddingHorizontal: 6 },
  projectHealth: { ...type.caption, color: palette.muted, fontSize: 11, marginTop: 4 },
  projectRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },

  connect: { flexDirection: 'row', alignItems: 'center', gap: 11, padding: 15, marginTop: 4 },
  connectText: { ...type.label, color: palette.paper, flex: 1 },

  errorCard: { marginBottom: 12 },
  errorTitle: { ...type.bodyStrong, color: palette.red },
  errorText: { ...type.caption, color: palette.redText, marginTop: 6 },

  footerRule: { marginTop: spacing.xl },
  footer: { ...type.label, color: '#3C4149', textAlign: 'center', marginTop: 18, fontSize: 9 },
  signOut: { alignSelf: 'center', marginTop: 18, maxWidth: 320 },
});
