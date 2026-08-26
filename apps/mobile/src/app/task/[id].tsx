import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { StatePill } from '@/components/state-pill';
import { api, streamTaskEvents } from '@/lib/api';
import { parseUnifiedDiff } from '@/lib/diff';
import { palette, radius, spacing, type } from '@/lib/theme';

const terminal = new Set(['ready_for_review', 'completed', 'failed', 'cancelled']);

export default function TaskScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [openCheck, setOpenCheck] = useState<string | null>(null);
  const [openFile, setOpenFile] = useState<string | null>(null);
  const task = useQuery({ queryKey: ['task', id], queryFn: () => api.task(id!) });
  const events = useQuery({ queryKey: ['task-events', id], queryFn: () => api.taskEvents(id!) });
  const refresh = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['task', id] }),
      queryClient.invalidateQueries({ queryKey: ['task-events', id] }),
      queryClient.invalidateQueries({ queryKey: ['command-center'] }),
    ]);
  }, [id, queryClient]);
  const approve = useMutation({ mutationFn: () => api.approve(id!, 'approved'), onSuccess: refresh });
  const reject = useMutation({ mutationFn: () => api.approve(id!, 'rejected', 'Rejected from Mission Control'), onSuccess: refresh });
  const createPr = useMutation({ mutationFn: () => api.createPullRequest(id!), onSuccess: refresh });
  const cancel = useMutation({ mutationFn: () => api.cancel(id!), onSuccess: refresh });
  const data = task.data;
  const files = useMemo(() => parseUnifiedDiff(data?.diff ?? ''), [data?.diff]);

  useEffect(() => {
    if (!id || terminal.has(data?.state ?? '')) return;
    const controller = new AbortController();
    let poll: ReturnType<typeof setInterval> | undefined;
    streamTaskEvents(id, 0, () => { void refresh(); }, controller.signal).catch(() => {
      poll = setInterval(() => { void refresh(); }, 1200);
    });
    return () => {
      controller.abort();
      if (poll) clearInterval(poll);
    };
  }, [id, data?.state, refresh]);

  if (task.isLoading || !data) {
    return <View style={styles.center}><ActivityIndicator color={palette.mint} /><Text style={styles.loading}>Loading Mission…</Text></View>;
  }

  const checksPassed = data.verification.filter((check) => check.status === 'passed').length;
  const initials = data.engineer_name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase();
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.topRow}><Text style={styles.taskId}>MISSION {data.id.slice(0, 8).toUpperCase()}</Text><StatePill state={data.state} /></View>
      <Text style={styles.goal}>{data.goal}</Text>
      <Text style={styles.sha}>{data.autonomy.toUpperCase()}{data.base_sha ? ` · BASE ${data.base_sha.slice(0, 12)}` : ''}</Text>

      <View style={styles.engineerCard}><View style={styles.engineerAvatar}><Text style={styles.engineerAvatarText}>{initials}</Text></View><View style={styles.engineerCopy}><Text style={styles.engineerLabel}>MISSION OWNER</Text><Text style={styles.engineerName}>{data.engineer_name}</Text></View><Pressable onPress={() => router.push({ pathname: '/voice', params: { projectId: data.project_id, missionId: data.id } })} style={styles.callButton}><Text style={styles.callButtonText}>CALL ↗</Text></Pressable></View>

      <View style={styles.timeline}>
        <Text style={styles.eyebrow}>AGENT PROGRESS</Text>
        {events.data?.map((event, index) => (
          <View key={event.sequence} style={styles.eventRow}>
            <View style={styles.eventRail}><View style={[styles.eventDot, index === (events.data?.length ?? 0) - 1 && styles.eventDotActive]} />{index < (events.data?.length ?? 0) - 1 && <View style={styles.eventLine} />}</View>
            <View style={styles.eventCopy}><Text style={styles.eventMessage}>{event.message}</Text><Text style={styles.eventTime}>{new Date(event.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</Text></View>
          </View>
        ))}
        {!terminal.has(data.state) && <View style={styles.working}><ActivityIndicator size="small" color={palette.amber} /><Text style={styles.workingText}>{data.engineer_name} is working in the background</Text></View>}
      </View>

      {data.error && <Section label="MISSION STOPPED"><Text style={styles.error}>{data.error}</Text></Section>}
      {data.summary && <><Section label="OUTCOME"><Text style={styles.sectionTitle}>{data.summary}</Text></Section><Section label="ROOT CAUSE"><Text style={styles.body}>{data.root_cause}</Text></Section></>}

      {data.verification.length > 0 && <Section label={`VERIFICATION · ${checksPassed}/${data.verification.length} PASSED`}>
        {data.verification.map((check) => {
          const key = `${check.name}-${check.command}`;
          const open = openCheck === key;
          return <Pressable key={key} onPress={() => setOpenCheck(open ? null : key)} style={styles.checkRow}>
            <View style={[styles.checkMark, check.status !== 'passed' && styles.checkMarkFailed]}><Text style={styles.checkMarkText}>{check.status === 'passed' ? '✓' : '!'}</Text></View>
            <View style={styles.checkCopy}><Text style={styles.checkName}>{check.name}</Text><Text style={styles.checkMeta}>{check.status.toUpperCase()} · {check.duration_ms}MS · TAP LOGS</Text>
              {open && <Text selectable style={styles.log}>{check.output || check.command || 'No output captured.'}</Text>}
            </View>
          </Pressable>;
        })}
      </Section>}

      {files.length > 0 && <Section label={`REVIEWED PATCH · ${files.length} FILE${files.length === 1 ? '' : 'S'}`}>
        {files.map((file) => {
          const open = openFile === file.path;
          return <View key={file.path} style={styles.fileBlock}>
            <Pressable onPress={() => setOpenFile(open ? null : file.path)} style={styles.fileHeader}>
              <Text style={styles.filePath}>{file.path}</Text>
              <Text style={styles.fileStats}>+{file.additions} −{file.deletions}</Text>
            </Pressable>
            {open && <ScrollView horizontal style={styles.diffScroll} contentContainerStyle={styles.diffContent}>
              <View>{file.lines.map((line, index) => <Text key={`${file.path}-${index}`} selectable style={[styles.diffLine, line.type === 'add' && styles.diffAdd, line.type === 'del' && styles.diffDel, line.type === 'meta' && styles.diffMeta]}>{line.text || ' '}</Text>)}</View>
            </ScrollView>}
          </View>;
        })}
      </Section>}

      {data.state === 'ready_for_review' && data.approval_status === 'pending' && <View style={styles.approvalCard}>
        <Text style={styles.approvalLabel}>HUMAN APPROVAL REQUIRED</Text><Text style={styles.approvalTitle}>Ship this patch as a pull request?</Text>
        <Text style={styles.approvalText}>Only the reviewed patch will be used. The default branch is not modified. You can also tell Alex to ship it on a call.</Text>
        <Pressable style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]} onPress={() => approve.mutate()}>{approve.isPending ? <ActivityIndicator color={palette.ink} /> : <Text style={styles.primaryText}>APPROVE PATCH</Text>}</Pressable>
        <Pressable style={styles.rejectButton} onPress={() => reject.mutate()}><Text style={styles.rejectText}>{reject.isPending ? 'REJECTING…' : 'REJECT PATCH'}</Text></Pressable>
      </View>}

      {data.state === 'ready_for_review' && data.approval_status === 'approved' && <Pressable style={({ pressed }) => [styles.primaryButton, styles.standaloneButton, pressed && styles.pressed]} onPress={() => createPr.mutate()}>{createPr.isPending ? <ActivityIndicator color={palette.ink} /> : <Text style={styles.primaryText}>CREATE PULL REQUEST ↗</Text>}</Pressable>}

      {data.pull_request_url && <Pressable style={styles.prCard} onPress={() => Linking.openURL(data.pull_request_url!)}><View><Text style={styles.approvalLabel}>PULL REQUEST{data.pull_request_state ? ` · ${data.pull_request_state.toUpperCase()}` : ''}</Text><Text style={styles.prTitle}>Ready for team review</Text></View><Text style={styles.prArrow}>↗</Text></Pressable>}
      {(approve.isError || createPr.isError || reject.isError) && <Text style={styles.error}>{approve.error?.message ?? createPr.error?.message ?? reject.error?.message}</Text>}
      {!terminal.has(data.state) && <Pressable style={styles.cancelButton} onPress={() => cancel.mutate()}><Text style={styles.cancelText}>CANCEL MISSION</Text></Pressable>}
    </ScrollView>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return <View style={styles.section}><Text style={styles.eyebrow}>{label}</Text><View style={styles.sectionInner}>{children}</View></View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.ink }, center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.ink }, loading: { color: palette.muted, marginTop: 12 },
  content: { padding: spacing.lg, paddingBottom: 80, maxWidth: 760, width: '100%', alignSelf: 'center' }, topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, taskId: { ...type.label, color: palette.muted }, goal: { color: palette.paper, fontSize: 26, lineHeight: 33, fontWeight: '900', letterSpacing: -0.6, marginTop: 22 }, sha: { ...type.label, color: '#526176', marginTop: 12 },
  engineerCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#0D2824', borderColor: '#24554A', borderWidth: 1, borderRadius: radius.md, padding: 12, marginTop: 20 }, engineerAvatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: palette.mint, alignItems: 'center', justifyContent: 'center' }, engineerAvatarText: { color: palette.ink, fontSize: 9, fontWeight: '900' }, engineerCopy: { flex: 1, marginLeft: 10 }, engineerLabel: { ...type.label, color: '#6FA092', fontSize: 7 }, engineerName: { color: palette.paper, fontSize: 13, fontWeight: '800', marginTop: 3 }, callButton: { backgroundColor: palette.paper, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9 }, callButtonText: { ...type.label, color: palette.ink, fontSize: 8 },
  timeline: { marginTop: 30, backgroundColor: palette.panel, borderWidth: 1, borderColor: palette.line, borderRadius: radius.lg, padding: spacing.md }, eyebrow: { ...type.label, color: palette.mint }, eventRow: { flexDirection: 'row', minHeight: 50, marginTop: 16 }, eventRail: { width: 18, alignItems: 'center' }, eventDot: { width: 9, height: 9, borderRadius: 5, marginTop: 4, backgroundColor: '#526176' }, eventDotActive: { backgroundColor: palette.amber }, eventLine: { width: 1, flex: 1, marginTop: 5, backgroundColor: palette.line }, eventCopy: { flex: 1, paddingLeft: 10, paddingBottom: 10 }, eventMessage: { color: palette.paper, fontSize: 13, lineHeight: 19, fontWeight: '600' }, eventTime: { color: palette.muted, fontSize: 9, marginTop: 4 },
  working: { flexDirection: 'row', alignItems: 'center', gap: 9, backgroundColor: '#29240F', borderRadius: 10, padding: 11, marginTop: 6 }, workingText: { color: palette.amber, fontSize: 11, fontWeight: '700' }, section: { marginTop: 30 }, sectionInner: { backgroundColor: palette.panel, borderColor: palette.line, borderWidth: 1, borderRadius: radius.md, padding: spacing.md, marginTop: 10 }, sectionTitle: { color: palette.paper, fontSize: 17, lineHeight: 24, fontWeight: '800' }, body: { color: '#BBC5D1', fontSize: 14, lineHeight: 22 }, error: { color: palette.red, lineHeight: 21 },
  checkRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 9 }, checkMark: { width: 30, height: 30, borderRadius: 10, backgroundColor: palette.mint, alignItems: 'center', justifyContent: 'center' }, checkMarkFailed: { backgroundColor: palette.red }, checkMarkText: { color: palette.ink, fontWeight: '900' }, checkCopy: { marginLeft: 11, flex: 1 }, checkName: { color: palette.paper, fontWeight: '700', fontSize: 13 }, checkMeta: { ...type.label, color: palette.muted, fontSize: 8, marginTop: 3 }, log: { color: '#B7C5D7', fontFamily: 'monospace', fontSize: 10, lineHeight: 15, marginTop: 8 },
  fileBlock: { marginBottom: 10 }, fileHeader: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 }, filePath: { color: palette.paper, fontWeight: '700', fontSize: 12, flex: 1 }, fileStats: { ...type.label, color: palette.mint, fontSize: 8 },
  diffScroll: { backgroundColor: '#050A11', borderRadius: 10, maxHeight: 280 }, diffContent: { padding: 12 }, diffLine: { color: '#B7C5D7', fontFamily: 'monospace', fontSize: 10, lineHeight: 16 }, diffAdd: { color: '#8EF0C7' }, diffDel: { color: '#FF8792' }, diffMeta: { color: '#526176' },
  approvalCard: { marginTop: 30, backgroundColor: palette.paper, borderRadius: radius.lg, padding: spacing.lg }, approvalLabel: { ...type.label, color: palette.mintDark }, approvalTitle: { color: palette.ink, fontSize: 21, lineHeight: 27, fontWeight: '900', marginTop: 9 }, approvalText: { color: '#536170', fontSize: 13, lineHeight: 20, marginTop: 7, marginBottom: 18 }, primaryButton: { minHeight: 50, backgroundColor: palette.mint, borderRadius: 13, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 }, standaloneButton: { marginTop: 24 }, primaryText: { color: palette.ink, fontWeight: '900', letterSpacing: 1, fontSize: 11 }, pressed: { opacity: 0.72 },
  rejectButton: { alignItems: 'center', paddingTop: 14 }, rejectText: { ...type.label, color: '#8A5A62', fontSize: 9 },
  prCard: { marginTop: 24, backgroundColor: palette.panelRaised, borderColor: palette.mintDark, borderWidth: 1, borderRadius: radius.md, padding: spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, prTitle: { color: palette.paper, fontSize: 16, fontWeight: '800', marginTop: 6 }, prArrow: { color: palette.mint, fontSize: 24 }, cancelButton: { alignSelf: 'center', padding: 16, marginTop: 20 }, cancelText: { ...type.label, color: palette.muted },
});
