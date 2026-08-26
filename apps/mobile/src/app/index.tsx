import { useQuery } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import * as WebBrowser from 'expo-web-browser';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { registerPushNotifications } from '@/lib/notifications';
import { palette, radius, shadow, spacing, type } from '@/lib/theme';

export default function CommandCenterScreen() {
  const auth = useAuth();
  const center = useQuery({ queryKey: ['command-center'], queryFn: api.commandCenter, refetchInterval: 4_000 });
  const github = useQuery({ queryKey: ['github-config'], queryFn: api.githubConfig });
  const primaryProject = center.data?.projects.find((project) => project.health_status === 'incident') ?? center.data?.projects[0];
  const hour = new Date().getHours();
  const hello = hour < 12 ? 'Good morning.' : hour < 18 ? 'Good afternoon.' : 'Good evening.';

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
      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={center.isFetching} onRefresh={() => center.refetch()} tintColor={palette.mint} />}>
        <View style={styles.brandRow}>
          <View style={styles.mark}><Text style={styles.markText}>PE</Text></View>
          <View><Text style={styles.brand}>Mission Control</Text><Text style={styles.brandSub}>POCKET ENGINEER</Text></View>
          <View style={styles.livePill}><View style={[styles.liveDot, { backgroundColor: center.isError ? palette.red : palette.mint }]} /><Text style={styles.liveText}>{center.isError ? 'OFFLINE' : 'LIVE'}</Text></View>
        </View>

        <View style={styles.heroRow}>
          <View style={styles.heroCopy}><Text style={styles.eyebrow}>YOUR SOFTWARE ESTATE</Text><Text style={styles.title}>{hello}{`\n`}Talk to {center.data?.engineer_name ?? 'Alex'} and it gets done.</Text></View>
          <Pressable accessibilityLabel="Call your engineer" onPress={() => callEngineer(primaryProject?.id)} style={({ pressed }) => [styles.callButton, pressed && styles.pressed]}>
            <View style={styles.callWaves}><View style={styles.waveSmall} /><View style={styles.waveTall} /><View style={styles.waveMid} /></View><Text style={styles.callText}>CALL{`\n`}ENGINEER</Text>
          </Pressable>
        </View>

        <View style={styles.metrics}>
          <Metric value={center.data?.incident_count ?? 0} label="INCIDENTS" color={center.data?.incident_count ? palette.red : palette.mint} onPress={() => primaryProject && router.push({ pathname: '/project/[id]', params: { id: primaryProject.id } })} />
          <Metric value={center.data?.active_missions ?? 0} label="MISSIONS" color={palette.amber} onPress={() => router.push('/missions')} />
          <Metric value={center.data?.approval_count ?? 0} label="DECISIONS" color={palette.blue} last onPress={() => router.push('/inbox')} />
        </View>

        {center.data?.incident_count ? <Pressable onPress={() => primaryProject && router.push({ pathname: '/project/[id]', params: { id: primaryProject.id } })} style={({ pressed }) => [styles.incidentCard, pressed && styles.pressed]}>
          <View style={styles.incidentTop}><View style={styles.alertIcon}><Text style={styles.alertIconText}>!</Text></View><View style={styles.incidentCopy}><Text style={styles.incidentLabel}>PRODUCTION INCIDENT</Text><Text style={styles.incidentTitle}>{primaryProject?.name}</Text></View><Text style={styles.arrow}>↗</Text></View>
          <Text style={styles.incidentSummary}>{primaryProject?.health_summary}</Text>
          <View style={styles.incidentFooter}><Text style={styles.incidentAction}>TAP TO INVESTIGATE</Text><Text style={styles.incidentTime}>NOW</Text></View>
        </Pressable> : <View style={styles.healthyCard}><Text style={styles.healthyIcon}>✓</Text><View><Text style={styles.healthyTitle}>All systems healthy</Text><Text style={styles.healthyText}>Your AI engineers are standing by.</Text></View></View>}

        <SectionHeader title="AI ENGINEERS" count={center.data?.engineers.length ?? 0} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.engineerRail}>
          {center.data?.engineers.map((engineer) => <Pressable key={engineer.id} onPress={() => callEngineer(engineer.project_id ?? primaryProject?.id)} style={styles.engineerCard}>
            <View style={styles.engineerAvatar}><Text style={styles.engineerAvatarText}>{engineer.name.split(' ').map((part) => part[0]).join('').slice(0, 2)}</Text></View>
            <View style={styles.engineerStatus}><View style={[styles.engineerDot, { backgroundColor: engineer.status === 'available' ? palette.mint : palette.amber }]} /><Text style={styles.engineerStatusText}>{engineer.status.replaceAll('_', ' ').toUpperCase()}</Text></View>
            <Text style={styles.engineerName}>{engineer.name}</Text><Text style={styles.engineerSpecialty}>{engineer.specialty}</Text>
          </Pressable>)}
          <Pressable onPress={() => callEngineer(primaryProject?.id)} style={styles.engineerCallCard}><Text style={styles.engineerCallIcon}>◉</Text><Text style={styles.engineerCallTitle}>Talk it through</Text><Text style={styles.engineerCallSub}>Say what you want done</Text></Pressable>
        </ScrollView>

        <SectionHeader title="MY SOFTWARE" count={center.data?.projects.length ?? 0} />
        {center.isError && <View style={styles.errorCard}><Text style={styles.errorTitle}>Mission Control is offline</Text><Text style={styles.errorText}>Start the API, then pull down to retry.{`\n`}{api.baseUrl}</Text></View>}
        {center.data?.projects.map((project) => <Pressable key={project.id} style={({ pressed }) => [styles.projectCard, pressed && styles.pressed]} onPress={() => router.push({ pathname: '/project/[id]', params: { id: project.id } })}>
          <View style={[styles.projectIcon, project.health_status === 'incident' && styles.projectIconIncident]}><Text style={styles.projectIconText}>{project.name.slice(0, 2).toUpperCase()}</Text></View>
          <View style={styles.projectCopy}><Text style={styles.projectName}>{project.name}{project.is_demo ? ' · DEMO' : ''}</Text><Text style={styles.projectHealth} numberOfLines={1}>{project.health_summary}</Text></View>
          <View style={styles.projectRight}><View style={[styles.healthDot, { backgroundColor: project.health_status === 'incident' ? palette.red : palette.mint }]} /><Text style={styles.projectArrow}>›</Text></View>
        </Pressable>)}

        <Pressable onPress={connectGitHub} style={styles.connect}><Text style={styles.connectPlus}>＋</Text><Text style={styles.connectText}>CONNECT SOFTWARE</Text><Text style={styles.connectProvider}>GITHUB</Text></Pressable>
        <View style={styles.footerRule} /><Text style={styles.footer}>OBSERVE · DIRECT · VERIFY · SHIP</Text>
        {auth.session ? <Pressable onPress={auth.signOut} style={styles.signOut}><Text style={styles.signOutText}>SIGN OUT · {auth.session.user.email?.toUpperCase()}</Text></Pressable> : null}
      </ScrollView>
    </SafeAreaView>
  </View>;
}

function Metric({ value, label, color, last = false, onPress }: { value: number; label: string; color: string; last?: boolean; onPress?: () => void }) {
  return <Pressable onPress={onPress} style={[styles.metric, !last && styles.metricBorder]}><Text style={[styles.metricValue, { color }]}>{value}</Text><Text style={styles.metricLabel}>{label}</Text></Pressable>;
}
function SectionHeader({ title, count }: { title: string; count: number }) {
  return <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>{title}</Text><Text style={styles.sectionCount}>{count}</Text></View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.ink, overflow: 'hidden' }, safe: { flex: 1 }, content: { paddingHorizontal: spacing.lg, paddingBottom: 64, maxWidth: 760, width: '100%', alignSelf: 'center' }, glowOne: { position: 'absolute', width: 360, height: 360, borderRadius: 180, backgroundColor: '#123D51', opacity: 0.28, top: -180, right: -130 }, glowTwo: { position: 'absolute', width: 230, height: 230, borderRadius: 115, backgroundColor: '#3D161E', opacity: 0.2, top: 400, left: -170 },
  brandRow: { height: 72, flexDirection: 'row', alignItems: 'center' }, mark: { width: 36, height: 36, borderRadius: 11, backgroundColor: palette.mint, alignItems: 'center', justifyContent: 'center', marginRight: 10 }, markText: { color: palette.ink, fontWeight: '900', fontSize: 12 }, brand: { color: palette.paper, fontSize: 16, fontWeight: '900' }, brandSub: { ...type.label, color: palette.muted, fontSize: 7, marginTop: 2 }, livePill: { marginLeft: 'auto', flexDirection: 'row', gap: 6, alignItems: 'center', borderColor: palette.line, borderWidth: 1, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 6 }, liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: palette.mint }, liveText: { ...type.label, color: palette.muted, fontSize: 8 },
  heroRow: { flexDirection: 'row', alignItems: 'flex-end', paddingTop: 38, paddingBottom: 27 }, heroCopy: { flex: 1, paddingRight: 10 }, eyebrow: { ...type.label, color: palette.mint }, title: { color: palette.paper, fontSize: 34, lineHeight: 38, letterSpacing: -1.3, fontWeight: '900', marginTop: 12 }, callButton: { width: 94, height: 94, borderRadius: 47, backgroundColor: palette.mint, alignItems: 'center', justifyContent: 'center', ...shadow }, callWaves: { height: 23, flexDirection: 'row', alignItems: 'center', gap: 3 }, waveSmall: { width: 3, height: 9, borderRadius: 2, backgroundColor: palette.ink }, waveTall: { width: 3, height: 22, borderRadius: 2, backgroundColor: palette.ink }, waveMid: { width: 3, height: 14, borderRadius: 2, backgroundColor: palette.ink }, callText: { color: palette.ink, fontSize: 8, lineHeight: 10, fontWeight: '900', letterSpacing: 1, textAlign: 'center', marginTop: 5 },
  metrics: { flexDirection: 'row', backgroundColor: palette.panel, borderColor: palette.line, borderWidth: 1, borderRadius: radius.md, marginBottom: 15 }, metric: { flex: 1, paddingVertical: 14, alignItems: 'center' }, metricBorder: { borderRightWidth: 1, borderRightColor: palette.line }, metricValue: { fontSize: 22, fontWeight: '900' }, metricLabel: { ...type.label, color: palette.muted, fontSize: 7, marginTop: 3 },
  incidentCard: { backgroundColor: '#28141A', borderColor: '#71303C', borderWidth: 1, borderRadius: radius.lg, padding: spacing.md }, incidentTop: { flexDirection: 'row', alignItems: 'center' }, alertIcon: { width: 42, height: 42, borderRadius: 13, backgroundColor: palette.red, alignItems: 'center', justifyContent: 'center' }, alertIconText: { color: palette.ink, fontSize: 21, fontWeight: '900' }, incidentCopy: { flex: 1, marginLeft: 12 }, incidentLabel: { ...type.label, color: palette.red, fontSize: 8 }, incidentTitle: { color: palette.paper, fontSize: 17, fontWeight: '900', marginTop: 4 }, arrow: { color: '#BE8790', fontSize: 19 }, incidentSummary: { color: '#DCB6BC', fontSize: 13, lineHeight: 20, marginTop: 15 }, incidentFooter: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: '#51262F', paddingTop: 12, marginTop: 14 }, incidentAction: { ...type.label, color: palette.red, flex: 1, fontSize: 8 }, incidentTime: { ...type.label, color: '#9C6A73', fontSize: 8 }, healthyCard: { flexDirection: 'row', gap: 12, alignItems: 'center', backgroundColor: '#0D2824', borderColor: '#24554A', borderWidth: 1, borderRadius: radius.md, padding: spacing.md }, healthyIcon: { color: palette.mint, fontSize: 24 }, healthyTitle: { color: palette.paper, fontWeight: '800' }, healthyText: { color: palette.muted, fontSize: 11, marginTop: 3 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginTop: 33, marginBottom: 12 }, sectionTitle: { ...type.label, color: palette.muted, flex: 1 }, sectionCount: { color: palette.ink, backgroundColor: palette.paper, borderRadius: 999, overflow: 'hidden', paddingHorizontal: 8, paddingVertical: 2, fontSize: 10, fontWeight: '900' },
  engineerRail: { gap: 10, paddingRight: spacing.lg }, engineerCard: { width: 170, backgroundColor: palette.panel, borderColor: palette.line, borderWidth: 1, borderRadius: radius.md, padding: 14 }, engineerAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: palette.blue, alignItems: 'center', justifyContent: 'center' }, engineerAvatarText: { color: palette.ink, fontSize: 10, fontWeight: '900' }, engineerStatus: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 12 }, engineerDot: { width: 6, height: 6, borderRadius: 3 }, engineerStatusText: { ...type.label, color: palette.muted, fontSize: 7 }, engineerName: { color: palette.paper, fontSize: 14, fontWeight: '800', marginTop: 9 }, engineerSpecialty: { color: palette.muted, fontSize: 10, lineHeight: 14, marginTop: 4 }, engineerCallCard: { width: 170, backgroundColor: '#0D2824', borderColor: '#24554A', borderWidth: 1, borderRadius: radius.md, padding: 14, justifyContent: 'center' }, engineerCallIcon: { color: palette.mint, fontSize: 23 }, engineerCallTitle: { color: palette.paper, fontSize: 14, fontWeight: '800', marginTop: 9 }, engineerCallSub: { color: '#73A99B', fontSize: 10, lineHeight: 14, marginTop: 4 },
  projectCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: palette.panel, borderColor: palette.line, borderWidth: 1, borderRadius: radius.md, padding: 13, marginBottom: 9 }, projectIcon: { width: 45, height: 45, borderRadius: 14, backgroundColor: palette.blue, alignItems: 'center', justifyContent: 'center' }, projectIconIncident: { backgroundColor: palette.red }, projectIconText: { color: palette.ink, fontSize: 10, fontWeight: '900' }, projectCopy: { flex: 1, marginLeft: 12 }, projectName: { color: palette.paper, fontSize: 14, fontWeight: '800' }, projectHealth: { color: palette.muted, fontSize: 10, marginTop: 4 }, projectRight: { flexDirection: 'row', alignItems: 'center', gap: 9 }, healthDot: { width: 7, height: 7, borderRadius: 4 }, projectArrow: { color: palette.muted, fontSize: 25 },
  connect: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderStyle: 'dashed', borderColor: '#3B4A5D', borderRadius: radius.md, padding: 14, marginTop: 5 }, connectPlus: { color: palette.mint, fontSize: 20 }, connectText: { ...type.label, color: palette.paper, marginLeft: 10, flex: 1 }, connectProvider: { ...type.label, color: palette.muted, fontSize: 8 }, errorCard: { backgroundColor: '#2A1519', borderColor: '#6E2F39', borderWidth: 1, padding: spacing.md, borderRadius: radius.md }, errorTitle: { color: palette.red, fontWeight: '800' }, errorText: { color: '#D7A8AE', marginTop: 6, lineHeight: 19, fontSize: 12 },
  footerRule: { height: 1, backgroundColor: palette.line, marginTop: 32 }, footer: { ...type.label, color: '#4D5B6C', textAlign: 'center', marginTop: 17 }, signOut: { alignSelf: 'center', paddingHorizontal: 16, paddingVertical: 12, marginTop: 8 }, signOutText: { ...type.label, color: palette.muted, fontSize: 8 }, pressed: { opacity: 0.72, transform: [{ scale: 0.992 }] },
});
