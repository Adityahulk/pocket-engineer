import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Linking, ScrollView, StyleSheet, Text, View } from 'react-native';

import { StatePill } from '@/components/state-pill';
import { Avatar } from '@/components/ui/avatar';
import { Badge, LiveDot } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { MissionProgress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Touchable } from '@/components/ui/touchable';
import { api, streamTaskEvents } from '@/lib/api';
import { parseUnifiedDiff } from '@/lib/diff';
import { layout, palette, radius, spacing, type } from '@/lib/theme';

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
    return (
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <Skeleton width={140} height={11} />
        <View style={styles.loadingBlock}><Skeleton width="92%" height={26} /><Skeleton width="64%" height={26} /></View>
        <View style={styles.loadingBlock}><Skeleton width="100%" height={72} round={radius.lg} /></View>
        <View style={styles.loadingBlock}><Skeleton width="100%" height={180} round={radius.lg} /></View>
      </ScrollView>
    );
  }

  const checksPassed = data.verification.filter((check) => check.status === 'passed').length;
  const allChecksPassed = data.verification.length > 0 && checksPassed === data.verification.length;
  const awaitingDecision = data.state === 'ready_for_review' && data.approval_status === 'pending';

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.topRow}>
        <Text style={styles.taskId}>MISSION {data.id.slice(0, 8).toUpperCase()}</Text>
        <StatePill state={data.state} />
      </View>
      <Text style={styles.goal}>{data.goal}</Text>
      <View style={styles.metaRow}>
        <Badge label={data.autonomy.toUpperCase()} tone={data.autonomy === 'autopilot' ? 'violet' : 'mint'} dot={false} />
        <Badge label={data.mode.toUpperCase()} tone="neutral" dot={false} />
        {data.base_sha ? <Text style={styles.sha}>BASE {data.base_sha.slice(0, 12)}</Text> : null}
      </View>

      <Card style={styles.progressCard}><MissionProgress state={data.state} /></Card>

      <Card tone="mint" style={styles.engineerCard}>
        <Avatar name={data.engineer_name} size={38} tone="mint" />
        <View style={styles.engineerCopy}>
          <Text style={styles.engineerLabel}>MISSION OWNER</Text>
          <Text style={styles.engineerName}>{data.engineer_name}</Text>
        </View>
        <Button
          label="CALL"
          trailing="↗"
          variant="light"
          size="sm"
          accessibilityLabel={`Call ${data.engineer_name} about this mission`}
          onPress={() => router.push({ pathname: '/voice', params: { projectId: data.project_id, missionId: data.id } })}
        />
      </Card>

      {awaitingDecision ? (
        <Card tone="paper" style={styles.approvalCard}>
          <View style={styles.approvalTop}>
            <Text style={styles.approvalLabel}>HUMAN APPROVAL REQUIRED</Text>
            {allChecksPassed ? <Text style={styles.approvalChecks}>{checksPassed}/{data.verification.length} CHECKS PASSED</Text> : null}
          </View>
          <Text style={styles.approvalTitle}>Ship this patch as a pull request?</Text>
          <Text style={styles.approvalText}>
            Only the reviewed patch will be used. The default branch is not modified. You can also tell {data.engineer_name} to ship it on a call.
          </Text>
          <Button label="APPROVE PATCH" size="lg" full loading={approve.isPending} onPress={() => approve.mutate()} />
          <Touchable onPress={() => reject.mutate()} style={styles.rejectButton} accessibilityLabel="Reject patch">
            <Text style={styles.rejectText}>{reject.isPending ? 'REJECTING…' : 'REJECT AND SEND FEEDBACK'}</Text>
          </Touchable>
        </Card>
      ) : null}

      {data.state === 'ready_for_review' && data.approval_status === 'approved' ? (
        <Button
          label="CREATE PULL REQUEST"
          trailing="↗"
          size="lg"
          full
          style={styles.standaloneButton}
          loading={createPr.isPending}
          onPress={() => createPr.mutate()}
        />
      ) : null}

      <Card style={styles.timeline}>
        <Text style={styles.eyebrow}>AGENT PROGRESS</Text>
        {events.data?.map((event, index) => {
          const last = index === (events.data?.length ?? 0) - 1;
          return (
            <View key={event.sequence} style={styles.eventRow}>
              <View style={styles.eventRail}>
                {last && !terminal.has(data.state)
                  ? <LiveDot color={palette.amber} pulse size={9} />
                  : <View style={[styles.eventDot, last && styles.eventDotActive]} />}
                {!last ? <View style={styles.eventLine} /> : null}
              </View>
              <View style={styles.eventCopy}>
                <Text style={styles.eventMessage}>{event.message}</Text>
                <Text style={styles.eventTime}>
                  {new Date(event.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </Text>
              </View>
            </View>
          );
        })}
        {!terminal.has(data.state) ? (
          <View style={styles.working}>
            <ActivityIndicator size="small" color={palette.amber} />
            <Text style={styles.workingText}>{data.engineer_name} is working in the background</Text>
          </View>
        ) : null}
      </Card>

      {data.error ? <Section label="MISSION STOPPED" tone="red"><Text style={styles.error}>{data.error}</Text></Section> : null}
      {data.summary ? (
        <>
          <Section label="OUTCOME"><Text style={styles.sectionTitle}>{data.summary}</Text></Section>
          <Section label="ROOT CAUSE"><Text style={styles.body}>{data.root_cause}</Text></Section>
        </>
      ) : null}

      {data.verification.length > 0 ? (
        <Section label={`VERIFICATION · ${checksPassed}/${data.verification.length} PASSED`}>
          {data.verification.map((check) => {
            const key = `${check.name}-${check.command}`;
            const open = openCheck === key;
            const passed = check.status === 'passed';
            return (
              <Touchable
                key={key}
                onPress={() => setOpenCheck(open ? null : key)}
                accessibilityLabel={`${check.name} logs`}
                accessibilityState={{ expanded: open }}
                style={styles.checkRow}>
                <View style={[styles.checkMark, !passed && styles.checkMarkFailed]}>
                  <Text style={styles.checkMarkText}>{passed ? '✓' : '!'}</Text>
                </View>
                <View style={styles.checkCopy}>
                  <Text style={styles.checkName}>{check.name}</Text>
                  <Text style={styles.checkMeta}>
                    {check.status.toUpperCase()} · {check.duration_ms}MS · {open ? 'HIDE LOGS' : 'TAP LOGS'}
                  </Text>
                  {open ? <Text selectable style={styles.log}>{check.output || check.command || 'No output captured.'}</Text> : null}
                </View>
              </Touchable>
            );
          })}
        </Section>
      ) : null}

      {files.length > 0 ? (
        <Section label={`REVIEWED PATCH · ${files.length} FILE${files.length === 1 ? '' : 'S'}`}>
          {files.map((file) => {
            const open = openFile === file.path;
            return (
              <View key={file.path} style={styles.fileBlock}>
                <Touchable
                  onPress={() => setOpenFile(open ? null : file.path)}
                  accessibilityLabel={`${file.path} diff`}
                  accessibilityState={{ expanded: open }}
                  style={styles.fileHeader}
                  hoverStyle={styles.fileHeaderHover}>
                  <Text style={styles.fileChevron}>{open ? '⌄' : '›'}</Text>
                  <Text style={styles.filePath} numberOfLines={1}>{file.path}</Text>
                  <Text style={styles.fileAdd}>+{file.additions}</Text>
                  <Text style={styles.fileDel}>−{file.deletions}</Text>
                </Touchable>
                {open ? (
                  <ScrollView horizontal style={styles.diffScroll} contentContainerStyle={styles.diffContent}>
                    <View>
                      {file.lines.map((line, index) => (
                        <Text
                          key={`${file.path}-${index}`}
                          selectable
                          style={[
                            styles.diffLine,
                            line.type === 'add' && styles.diffAdd,
                            line.type === 'del' && styles.diffDel,
                            line.type === 'meta' && styles.diffMeta,
                          ]}>
                          {line.text || ' '}
                        </Text>
                      ))}
                    </View>
                  </ScrollView>
                ) : null}
              </View>
            );
          })}
        </Section>
      ) : null}

      {data.pull_request_url ? (
        <Card
          tone="blue"
          accessibilityLabel="Open pull request"
          onPress={() => Linking.openURL(data.pull_request_url!)}
          style={styles.prCard}>
          <View style={styles.prCopy}>
            <Text style={styles.prLabel}>PULL REQUEST{data.pull_request_state ? ` · ${data.pull_request_state.toUpperCase()}` : ''}</Text>
            <Text style={styles.prTitle}>Ready for team review</Text>
          </View>
          <Text style={styles.prArrow}>↗</Text>
        </Card>
      ) : null}

      {approve.isError || createPr.isError || reject.isError ? (
        <Text style={styles.error}>{approve.error?.message ?? createPr.error?.message ?? reject.error?.message}</Text>
      ) : null}

      {!terminal.has(data.state) ? (
        <Button label="CANCEL MISSION" variant="ghost" size="sm" style={styles.cancelButton} onPress={() => cancel.mutate()} />
      ) : null}
    </ScrollView>
  );
}

function Section({ label, children, tone = 'panel' }: { label: string; children: React.ReactNode; tone?: 'panel' | 'red' }) {
  return (
    <View style={styles.section}>
      <Text style={[styles.eyebrow, tone === 'red' && styles.eyebrowRed]}>{label}</Text>
      <Card tone={tone} style={styles.sectionInner}>{children}</Card>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.ink },
  content: { padding: spacing.lg, paddingBottom: 80, maxWidth: layout.maxWidth, width: '100%', alignSelf: 'center' },
  loadingBlock: { gap: 10, marginTop: 22 },

  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  taskId: { ...type.label, color: palette.muted },
  goal: { ...type.title, color: palette.paper, fontSize: 26, lineHeight: 33, letterSpacing: -0.6, marginTop: 22 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14 },
  sha: { ...type.label, color: palette.mutedDeep, fontSize: 8 },

  progressCard: { marginTop: 22 },
  engineerCard: { flexDirection: 'row', alignItems: 'center', gap: 11, marginTop: 12 },
  engineerCopy: { flex: 1 },
  engineerLabel: { ...type.label, color: palette.mintText, fontSize: 7 },
  engineerName: { ...type.bodyStrong, color: palette.paper, fontSize: 14, marginTop: 3 },

  approvalCard: { marginTop: 22, padding: spacing.lg },
  approvalTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  approvalLabel: { ...type.label, color: palette.mintDark, flex: 1 },
  approvalChecks: { ...type.label, color: palette.mintDark, fontSize: 8 },
  approvalTitle: { ...type.title, color: palette.ink, fontSize: 22, lineHeight: 28, marginTop: 10 },
  approvalText: { ...type.body, color: '#536170', marginTop: 8, marginBottom: 20 },
  rejectButton: { alignItems: 'center', paddingTop: 16, paddingBottom: 4 },
  rejectText: { ...type.label, color: '#8A5A62', fontSize: 9 },
  standaloneButton: { marginTop: 22 },

  timeline: { marginTop: 22 },
  eyebrow: { ...type.label, color: palette.mint },
  eyebrowRed: { color: palette.red },
  eventRow: { flexDirection: 'row', minHeight: 48, marginTop: 16 },
  eventRail: { width: 18, alignItems: 'center', paddingTop: 4 },
  eventDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: palette.mutedDeep },
  eventDotActive: { backgroundColor: palette.mint },
  eventLine: { width: 1, flex: 1, marginTop: 5, backgroundColor: palette.lineBright },
  eventCopy: { flex: 1, paddingLeft: 11, paddingBottom: 10 },
  eventMessage: { ...type.body, color: palette.paper, fontSize: 13, lineHeight: 19, fontWeight: '600' },
  eventTime: { ...type.label, color: palette.mutedDeep, fontSize: 8, marginTop: 5 },
  working: {
    flexDirection: 'row', alignItems: 'center', gap: 9, backgroundColor: palette.amberWash,
    borderRadius: radius.md, padding: 12, marginTop: 8,
  },
  workingText: { ...type.caption, color: palette.amber, fontWeight: '700' },

  section: { marginTop: spacing.xl },
  sectionInner: { marginTop: 10 },
  sectionTitle: { ...type.heading, color: palette.paper, fontSize: 17, lineHeight: 24 },
  body: { ...type.body, color: '#BBC5D1' },
  error: { ...type.body, color: palette.red },

  checkRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 9 },
  checkMark: { width: 30, height: 30, borderRadius: radius.sm, backgroundColor: palette.mint, alignItems: 'center', justifyContent: 'center' },
  checkMarkFailed: { backgroundColor: palette.red },
  checkMarkText: { color: palette.ink, fontWeight: '900' },
  checkCopy: { marginLeft: 11, flex: 1 },
  checkName: { ...type.bodyStrong, color: palette.paper, fontSize: 13 },
  checkMeta: { ...type.label, color: palette.muted, fontSize: 8, marginTop: 4 },
  log: { ...type.mono, color: '#B7C5D7', fontSize: 10, lineHeight: 15, marginTop: 9 },

  fileBlock: { marginBottom: 8 },
  fileHeader: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingVertical: 9, paddingHorizontal: 8, borderRadius: radius.sm },
  fileHeaderHover: { backgroundColor: palette.panelHover },
  fileChevron: { color: palette.muted, fontSize: 13, width: 10 },
  filePath: { ...type.caption, color: palette.paper, fontWeight: '700', flex: 1 },
  fileAdd: { ...type.label, color: palette.mint, fontSize: 8 },
  fileDel: { ...type.label, color: palette.red, fontSize: 8 },
  diffScroll: { backgroundColor: palette.inkSunken, borderRadius: radius.md, maxHeight: 300 },
  diffContent: { padding: 12 },
  diffLine: { ...type.mono, color: '#B7C5D7', fontSize: 10, lineHeight: 16 },
  diffAdd: { color: palette.mint },
  diffDel: { color: palette.red },
  diffMeta: { color: palette.mutedDeep },

  prCard: { flexDirection: 'row', alignItems: 'center', marginTop: 22 },
  prCopy: { flex: 1 },
  prLabel: { ...type.label, color: palette.blue, fontSize: 8 },
  prTitle: { ...type.heading, color: palette.paper, fontSize: 16, marginTop: 6 },
  prArrow: { color: palette.blue, fontSize: 22 },

  cancelButton: { alignSelf: 'center', marginTop: 24 },
});
