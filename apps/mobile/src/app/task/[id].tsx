import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { router, useIsFocused, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { StatePill } from '@/components/state-pill';
import { Avatar } from '@/components/ui/avatar';
import { Badge, LiveDot } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm';
import { Icon } from '@/components/ui/icon';
import { MissionProgress } from '@/components/ui/progress';
import { ErrorState } from '@/components/ui/section';
import { Skeleton } from '@/components/ui/skeleton';
import { Touchable } from '@/components/ui/touchable';
import { api, streamTaskEvents } from '@/lib/api';
import { parseUnifiedDiff } from '@/lib/diff';
import { layout, palette, radius, spacing, type } from '@/lib/theme';

const terminal = new Set(['ready_for_review', 'completed', 'failed', 'cancelled']);

type Dialog = 'approve' | 'reject' | 'cancel';

export default function TaskScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const focused = useIsFocused();
  const [openCheck, setOpenCheck] = useState<string | null>(null);
  /** `undefined` means the reviewer has not touched the patch list yet. */
  const [openFile, setOpenFile] = useState<string | null | undefined>(undefined);
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [timelineOpen, setTimelineOpen] = useState<boolean | null>(null);
  const task = useQuery({ queryKey: ['task', id], queryFn: () => api.task(id!) });
  const events = useQuery({ queryKey: ['task-events', id], queryFn: () => api.taskEvents(id!) });
  const refresh = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['task', id] }),
      queryClient.invalidateQueries({ queryKey: ['task-events', id] }),
      queryClient.invalidateQueries({ queryKey: ['command-center'] }),
    ]);
  }, [id, queryClient]);
  const settle = useCallback(async () => { setDialog(null); await refresh(); }, [refresh]);
  const approve = useMutation({ mutationFn: () => api.approve(id!, 'approved'), onSuccess: settle });
  const reject = useMutation({
    mutationFn: (feedback: string) => api.approve(id!, 'rejected', feedback),
    onSuccess: settle,
  });
  const createPr = useMutation({ mutationFn: () => api.createPullRequest(id!), onSuccess: refresh });
  const cancel = useMutation({ mutationFn: () => api.cancel(id!), onSuccess: settle });
  const data = task.data;
  const files = useMemo(() => parseUnifiedDiff(data?.diff ?? ''), [data?.diff]);

  useEffect(() => {
    if (!id || !focused || terminal.has(data?.state ?? '')) return;
    const controller = new AbortController();
    let poll: ReturnType<typeof setInterval> | undefined;
    streamTaskEvents(id, 0, () => { void refresh(); }, controller.signal).catch(() => {
      poll = setInterval(() => { void refresh(); }, 1200);
    });
    return () => {
      controller.abort();
      if (poll) clearInterval(poll);
    };
  }, [id, focused, data?.state, refresh]);

  function confirm(next: Dialog) {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setDialog(next);
  }

  if (!data) {
    // Retries can be exhausted while `data` is still undefined, so an error
    // has to win here or the screen shows a skeleton that never resolves.
    if (task.isError) {
      return (
        <View style={styles.centered}>
          <ErrorState title="Could not load this mission" error={task.error} onRetry={() => void task.refetch()} />
        </View>
      );
    }
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
  const awaitingDecision = data.state === 'ready_for_review' && data.approval_status === 'pending';
  const inFlight = !terminal.has(data.state);
  const showEvents = timelineOpen ?? inFlight;
  const decisionError = approve.error?.message ?? reject.error?.message ?? createPr.error?.message ?? cancel.error?.message;
  // A one-file patch is the common case; opening it by default saves the
  // reviewer a tap on the one thing they are being asked to judge.
  const activeFile = openFile === undefined ? (files.length === 1 ? files[0].path : null) : openFile;

  const outcome = data.summary ? (
    <View key="outcome">
      <Section label="OUTCOME"><Text style={styles.sectionTitle}>{data.summary}</Text></Section>
      <Section label="ROOT CAUSE"><Text style={styles.body}>{data.root_cause}</Text></Section>
    </View>
  ) : null;

  const stopped = data.error
    ? <Section key="stopped" label="MISSION STOPPED" tone="red"><Text style={styles.error}>{data.error}</Text></Section>
    : null;

  const patch = files.length > 0 ? (
    <Section key="patch" label={`REVIEWED PATCH · ${files.length} FILE${files.length === 1 ? '' : 'S'}`}>
      {files.map((file) => {
        const open = activeFile === file.path;
        return (
          <View key={file.path} style={styles.fileBlock}>
            <Touchable
              onPress={() => setOpenFile(open ? null : file.path)}
              accessibilityLabel={`${file.path} diff`}
              accessibilityState={{ expanded: open }}
              style={styles.fileHeader}
              hoverStyle={styles.fileHeaderHover}>
              <Icon name={open ? 'chevron-down' : 'chevron-right'} size={14} color={palette.muted} />
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
  ) : null;

  const verification = data.verification.length > 0 ? (
    <Section key="verification" label={`VERIFICATION · ${checksPassed}/${data.verification.length} PASSED`}>
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
              <Icon name={passed ? 'check' : 'alert-triangle'} size={15} color={passed ? palette.citron : palette.red} />
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
  ) : null;

  const timeline = (
    <Card key="timeline" style={styles.timeline}>
      <Touchable
        onPress={() => setTimelineOpen(!showEvents)}
        accessibilityLabel="Agent progress"
        accessibilityState={{ expanded: showEvents }}
        style={styles.timelineHeader}>
        <Text style={styles.eyebrow}>AGENT PROGRESS</Text>
        <Text style={styles.timelineCount}>{events.data?.length ?? 0} STEPS</Text>
        <Icon name={showEvents ? 'chevron-up' : 'chevron-down'} size={15} color={palette.muted} />
      </Touchable>
      {showEvents ? events.data?.map((event, index) => {
        const last = index === (events.data?.length ?? 0) - 1;
        return (
          <View key={event.sequence} style={styles.eventRow}>
            <View style={styles.eventRail}>
              {last && inFlight
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
      }) : null}
      {inFlight ? (
        <View style={styles.working}>
          <ActivityIndicator size="small" color={palette.amber} />
          <Text style={styles.workingText}>{data.engineer_name} is working in the background</Text>
        </View>
      ) : null}
    </Card>
  );

  const pullRequest = data.pull_request_url ? (
    <Card
      key="pr"
      tone="blue"
      accessibilityLabel="Open pull request"
      onPress={() => Linking.openURL(data.pull_request_url!)}
      style={styles.prCard}>
      <View style={styles.prCopy}>
        <Text style={styles.prLabel}>PULL REQUEST{data.pull_request_state ? ` · ${data.pull_request_state.toUpperCase()}` : ''}</Text>
        <Text style={styles.prTitle}>Ready for team review</Text>
      </View>
      <Icon name="arrow-up-right" size={18} color={palette.blue} />
    </Card>
  ) : null;

  // A pending decision reorders the screen around the evidence: what changed
  // and whether it passed comes first, and the run log moves out of the way.
  const sections = awaitingDecision
    ? [stopped, outcome, patch, verification, timeline, pullRequest]
    : [timeline, stopped, outcome, verification, patch, pullRequest];

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={[styles.content, awaitingDecision && { paddingBottom: 210 + insets.bottom }]}
        showsVerticalScrollIndicator={false}>
        <View style={styles.topRow}>
          <Text style={styles.taskId}>MISSION {data.id.slice(0, 8).toUpperCase()}</Text>
          <StatePill state={data.state} />
        </View>
        <Text style={styles.goal}>{data.goal}</Text>
        <View style={styles.metaRow}>
          <Badge
            label={data.autonomy.toUpperCase()}
            tone={data.autonomy === 'autopilot' ? 'violet' : 'accent'}
            icon={data.autonomy === 'autopilot' ? 'zap' : 'user-check'}
          />
          <Badge label={data.mode.toUpperCase()} tone="neutral" />
          {data.base_sha ? <Text style={styles.sha}>BASE {data.base_sha.slice(0, 12)}</Text> : null}
        </View>

        <Card style={styles.progressCard}><MissionProgress state={data.state} /></Card>

        <Card tone="accent" style={styles.engineerCard}>
          <Avatar name={data.engineer_name} size={38} tone="accent" />
          <View style={styles.engineerCopy}>
            <Text style={styles.engineerLabel}>MISSION OWNER</Text>
            <Text style={styles.engineerName}>{data.engineer_name}</Text>
          </View>
          <Button
            label="CALL"
            icon="mic"
            variant="light"
            size="sm"
            accessibilityLabel={`Call ${data.engineer_name} about this mission`}
            onPress={() => router.push({ pathname: '/voice', params: { projectId: data.project_id, missionId: data.id } })}
          />
        </Card>

        {data.state === 'ready_for_review' && data.approval_status === 'approved' ? (
          <Button
            label="CREATE PULL REQUEST"
            icon="git-pull-request"
            trailingIcon="arrow-up-right"
            size="lg"
            full
            style={styles.standaloneButton}
            loading={createPr.isPending}
            onPress={() => createPr.mutate()}
          />
        ) : null}

        {sections}

        {decisionError ? <Text style={styles.decisionError}>{decisionError}</Text> : null}

        {inFlight ? (
          <Button label="CANCEL MISSION" icon="x-circle" variant="ghost" size="sm" style={styles.cancelButton} onPress={() => confirm('cancel')} />
        ) : null}
      </ScrollView>

      {awaitingDecision ? (
        <View style={[styles.decisionBar, { paddingBottom: 18 + insets.bottom }]}>
          <View style={styles.decisionTop}>
            <Text style={styles.decisionLabel}>HUMAN APPROVAL REQUIRED</Text>
            {data.verification.length > 0 ? (
              <Text style={styles.decisionChecks}>{checksPassed}/{data.verification.length} CHECKS PASSED</Text>
            ) : null}
          </View>
          <Text style={styles.decisionHint}>
            Approving opens a pull request from the patch above. Your default branch is never modified.
          </Text>
          <View style={styles.decisionActions}>
            <Button label="REJECT" icon="x" variant="ghost" size="lg" style={styles.decisionReject} onPress={() => confirm('reject')} />
            <Button label="APPROVE PATCH" icon="check" size="lg" style={styles.decisionApprove} onPress={() => confirm('approve')} />
          </View>
        </View>
      ) : null}

      <ConfirmDialog
        visible={dialog === 'approve'}
        icon="git-pull-request"
        title="Approve this patch?"
        body={`Only the ${files.length} file${files.length === 1 ? '' : 's'} shown above will be used. ${data.engineer_name} pushes a new branch and opens a pull request — nothing is merged or deployed.`}
        confirmLabel="APPROVE AND OPEN PR"
        loading={approve.isPending}
        onConfirm={() => approve.mutate()}
        onCancel={() => setDialog(null)}
      />
      <ConfirmDialog
        visible={dialog === 'reject'}
        icon="corner-up-left"
        tone="danger"
        title={`Send this back to ${data.engineer_name}?`}
        body="The patch is discarded and nothing is pushed. Your notes become the brief for the next attempt."
        confirmLabel="REJECT AND SEND"
        prompt={{ label: 'WHAT SHOULD CHANGE?', placeholder: 'This fixes the symptom but the discount lookup is still unguarded…' }}
        loading={reject.isPending}
        onConfirm={(feedback) => reject.mutate(feedback)}
        onCancel={() => setDialog(null)}
      />
      <ConfirmDialog
        visible={dialog === 'cancel'}
        icon="x-circle"
        tone="danger"
        title="Cancel this mission?"
        body={`${data.engineer_name} stops immediately and the workspace is discarded. Any work in progress is lost.`}
        confirmLabel="CANCEL MISSION"
        cancelLabel="KEEP RUNNING"
        loading={cancel.isPending}
        onConfirm={() => cancel.mutate()}
        onCancel={() => setDialog(null)}
      />
    </View>
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
  centered: { flex: 1, backgroundColor: palette.ink, justifyContent: 'center', padding: spacing.lg },
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
  engineerLabel: { ...type.label, color: palette.citronText, fontSize: 7 },
  engineerName: { ...type.bodyStrong, color: palette.paper, fontSize: 14, marginTop: 3 },

  standaloneButton: { marginTop: 22 },

  decisionBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#0C0E12F7',
    borderTopWidth: 1, borderTopColor: palette.citronLine, paddingHorizontal: spacing.lg, paddingTop: spacing.md,
  },
  decisionTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  decisionLabel: { ...type.label, color: palette.citron, flex: 1 },
  decisionChecks: { ...type.label, color: palette.citronText, fontSize: 8 },
  decisionHint: { ...type.caption, color: palette.muted, marginTop: 8 },
  decisionActions: { flexDirection: 'row', gap: 10, marginTop: 14 },
  decisionReject: { flex: 1 },
  decisionApprove: { flex: 1.6 },
  decisionError: { ...type.body, color: palette.red, marginTop: 18 },

  timeline: { marginTop: 22 },
  timelineHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  timelineCount: { ...type.label, color: palette.mutedDeep, fontSize: 8, flex: 1, textAlign: 'right' },
  eyebrow: { ...type.label, color: palette.citron },
  eyebrowRed: { color: palette.red },
  eventRow: { flexDirection: 'row', minHeight: 48, marginTop: 16 },
  eventRail: { width: 18, alignItems: 'center', paddingTop: 4 },
  eventDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: palette.mutedDeep },
  eventDotActive: { backgroundColor: palette.citron },
  eventLine: { width: 1, flex: 1, marginTop: 5, backgroundColor: palette.lineBright },
  eventCopy: { flex: 1, paddingLeft: 11, paddingBottom: 10 },
  eventMessage: { ...type.bodyStrong, color: palette.paper, fontSize: 13, lineHeight: 19 },
  eventTime: { ...type.label, color: palette.mutedDeep, fontSize: 8, marginTop: 5 },
  working: {
    flexDirection: 'row', alignItems: 'center', gap: 9, backgroundColor: palette.amberWash,
    borderRadius: radius.md, padding: 12, marginTop: 16,
  },
  workingText: { ...type.data, color: palette.amber },

  section: { marginTop: spacing.xl },
  sectionInner: { marginTop: 10 },
  sectionTitle: { ...type.heading, color: palette.paper, fontSize: 17, lineHeight: 24 },
  body: { ...type.body, color: palette.muted },
  error: { ...type.body, color: palette.red },

  checkRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 9 },
  checkMark: {
    width: 30, height: 30, borderRadius: radius.sm, backgroundColor: palette.citronWash,
    borderWidth: 1, borderColor: palette.citronLine, alignItems: 'center', justifyContent: 'center',
  },
  checkMarkFailed: { backgroundColor: palette.redWash, borderColor: palette.redLine },
  checkCopy: { marginLeft: 11, flex: 1 },
  checkName: { ...type.bodyStrong, color: palette.paper, fontSize: 13 },
  checkMeta: { ...type.label, color: palette.muted, fontSize: 8, marginTop: 4 },
  log: { ...type.mono, color: palette.muted, fontSize: 10, lineHeight: 15, marginTop: 9 },

  fileBlock: { marginBottom: 8 },
  fileHeader: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingVertical: 9, paddingHorizontal: 8, borderRadius: radius.sm },
  fileHeaderHover: { backgroundColor: palette.panelHover },
  filePath: { ...type.data, color: palette.paper, flex: 1 },
  fileAdd: { ...type.label, color: palette.citron, fontSize: 8 },
  fileDel: { ...type.label, color: palette.red, fontSize: 8 },
  diffScroll: { backgroundColor: palette.inkSunken, borderRadius: radius.md, maxHeight: 300 },
  diffContent: { padding: 12 },
  diffLine: { ...type.mono, color: palette.muted, fontSize: 10, lineHeight: 16 },
  diffAdd: { color: palette.citron },
  diffDel: { color: palette.red },
  diffMeta: { color: palette.mutedDeep },

  prCard: { flexDirection: 'row', alignItems: 'center', marginTop: 22 },
  prCopy: { flex: 1 },
  prLabel: { ...type.label, color: palette.blue, fontSize: 8 },
  prTitle: { ...type.heading, color: palette.paper, fontSize: 16, marginTop: 6 },

  cancelButton: { alignSelf: 'center', marginTop: 24 },
});
