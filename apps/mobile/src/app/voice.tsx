import { useMutation, useQuery } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Animated, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Badge, LiveDot } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Touchable } from '@/components/ui/touchable';
import { api } from '@/lib/api';
import { glow, palette, radius, spacing, type } from '@/lib/theme';
import { createRealtimeVoice } from '@/lib/voice/realtime';
import type { CallStatus, MissionDraft, TranscriptTurn, VoiceConnection } from '@/lib/voice/types';

const statusCopy: Record<CallStatus, string> = {
  idle: 'Ready to call', connecting: 'Engineer is joining…', listening: 'Listening', thinking: 'Thinking it through…',
  speaking: 'Engineer is speaking', ended: 'Call ended', error: 'Call unavailable',
};

const statusColor: Record<CallStatus, string> = {
  idle: palette.muted, connecting: palette.amber, listening: palette.mint, thinking: palette.amber,
  speaking: palette.blue, ended: palette.muted, error: palette.red,
};

export default function VoiceCallScreen() {
  const { projectId, missionId } = useLocalSearchParams<{ projectId?: string; missionId?: string }>();
  const [status, setStatus] = useState<CallStatus>('idle');
  const [muted, setMuted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<TranscriptTurn[]>([]);
  const [draft, setDraft] = useState<MissionDraft | null>(null);
  const [typedBrief, setTypedBrief] = useState('');
  const connection = useRef<VoiceConnection | null>(null);
  const [pulse] = useState(() => new Animated.Value(0));
  const project = useQuery({ queryKey: ['project', projectId], queryFn: () => api.project(projectId!), enabled: Boolean(projectId) });
  const voiceConfig = useQuery({ queryKey: ['voice-config'], queryFn: api.voiceConfig });
  const engineerName = voiceConfig.data?.engineer_name ?? 'Alex';
  const engineerTitle = voiceConfig.data?.engineer_title ?? 'Senior Engineer';
  const live = status === 'listening' || status === 'speaking' || status === 'thinking';

  function mergeTranscript(turn: TranscriptTurn) {
    setTranscript((current) => {
      const index = current.findIndex((item) => item.id === turn.id && item.role === turn.role);
      if (index < 0) return [...current, turn].slice(-12);
      const next = [...current];
      next[index] = { ...turn, text: turn.final ? turn.text : `${next[index].text}${turn.text}` };
      return next.slice(-12);
    });
  }

  const voice = useMemo(() => {
    const instance = createRealtimeVoice({
      onStatus: setStatus,
      onTranscript: mergeTranscript,
      onMissionDraft: (missionDraft) => {
        setDraft(missionDraft);
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      },
      onMissionStarted: (mission) => {
        instance.end();
        router.replace({ pathname: '/task/[id]', params: { id: mission.id } });
      },
      onError: setError,
    }, { projectId, missionId });
    return instance;
  }, [missionId, projectId]);

  useEffect(() => {
    connection.current = voice;
    return () => voice.end();
  }, [voice]);

  useEffect(() => {
    const animation = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 0, duration: 900, useNativeDriver: true }),
    ]));
    if (status === 'listening' || status === 'speaking' || status === 'thinking') animation.start();
    return () => animation.stop();
  }, [pulse, status]);

  useEffect(() => {
    if (!voiceConfig.data?.enabled || status !== 'idle') return;
    let active = true;
    api.voiceClientSecret(projectId, missionId)
      .then((secret) => { if (active) return voice.start(secret.value); })
      .catch((reason: unknown) => {
        if (!active) return;
        setStatus('error'); setError(reason instanceof Error ? reason.message : 'Could not start the call.');
      });
    return () => { active = false; };
  }, [missionId, projectId, status, voice, voiceConfig.data?.enabled]);

  const startMission = useMutation({
    mutationFn: (mission: MissionDraft) => {
      if (!projectId) throw new Error('Choose software before starting a mission.');
      return api.createTask(projectId, mission.goal, mission.mode, mission.autonomy ?? 'assisted');
    },
    onSuccess: (mission) => {
      connection.current?.end();
      router.replace({ pathname: '/task/[id]', params: { id: mission.id } });
    },
  });

  function endCall() {
    connection.current?.end();
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.back();
  }

  function toggleMute() {
    const next = !muted; setMuted(next); connection.current?.setMuted(next);
    void Haptics.selectionAsync();
  }

  function createTypedDraft() {
    const goal = typedBrief.trim();
    if (goal.length < 3) return;
    setDraft({ goal, mode: 'fix', priority: 'normal' }); setTypedBrief('');
  }

  function sendTypedBrief() {
    const text = typedBrief.trim();
    if (text.length < 2) return;
    if (voiceConfig.data?.enabled && status !== 'idle' && status !== 'error' && status !== 'ended') {
      connection.current?.sendText(text);
    } else {
      createTypedDraft();
      return;
    }
    setTypedBrief('');
  }

  return <View style={styles.screen}>
    {/* Layered discs fake a radial spotlight behind the engineer avatar. */}
    <View style={[styles.glow, styles.glowOuter]} />
    <View style={[styles.glow, styles.glowMid]} />
    <View style={[styles.glow, styles.glowInner]} />
    <SafeAreaView style={styles.safe}>
      <View style={styles.topBar}>
        <Text style={styles.callLabel}>ENGINEER CALL</Text>
        <Badge label="PRIVATE SESSION" tone="mint" />
      </View>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Animated.View
          style={[
            styles.avatarHalo,
            { transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.07] }) }] },
            live && styles.avatarHaloLive,
          ]}>
          <View style={styles.avatarRing}>
            <View style={styles.avatar}><Text style={styles.avatarText}>PE</Text></View>
          </View>
        </Animated.View>

        <Text style={styles.name}>{engineerName}</Text>
        <Text style={styles.role}>{engineerTitle.toUpperCase()}</Text>
        <Text style={styles.context}>{project.data?.name ?? 'Your software portfolio'}</Text>

        <View style={styles.statusRow}>
          {status === 'connecting' || status === 'thinking' ? <ActivityIndicator size="small" color={palette.amber} /> : null}
          <LiveDot color={statusColor[status]} pulse={live} size={7} />
          <Text style={styles.status}>{statusCopy[status]}</Text>
        </View>

        {transcript.length > 0 ? (
          <Card style={styles.transcriptCard}>
            <Text style={styles.transcriptLabel}>LIVE TRANSCRIPT</Text>
            {transcript.slice(-5).map((turn) => (
              <View key={`${turn.role}-${turn.id}`} style={styles.turn}>
                <Text style={[styles.turnRole, turn.role === 'engineer' && styles.engineerRole]}>
                  {turn.role === 'engineer' ? engineerName.toUpperCase() : 'YOU'}
                </Text>
                <Text style={styles.turnText}>{turn.text}</Text>
              </View>
            ))}
          </Card>
        ) : null}

        {status === 'listening' || status === 'thinking' || !voiceConfig.data?.enabled ? (
          <View style={styles.talkRow}>
            <TextInput
              value={typedBrief}
              onChangeText={setTypedBrief}
              placeholder={`Tell ${engineerName} what to do…`}
              placeholderTextColor={palette.mutedDeep}
              style={styles.liveInput}
              accessibilityLabel="Type your brief"
              returnKeyType="send"
              onSubmitEditing={sendTypedBrief}
            />
            <Button label="SEND" variant="light" onPress={sendTypedBrief} />
          </View>
        ) : null}

        {error && voiceConfig.data?.enabled ? <Text style={styles.error}>{error}</Text> : null}

        {draft ? (
          <Card tone="paper" style={styles.draftCard}>
            <Text style={styles.draftLabel}>MISSION DRAFT · {draft.priority.toUpperCase()}</Text>
            <Text style={styles.draftTitle}>{draft.goal}</Text>
            <Text style={styles.draftMeta}>
              {draft.mode.toUpperCase()} · {(draft.autonomy ?? 'assisted').toUpperCase()} · Starts as soon as you confirm
              or when {engineerName} already started it
            </Text>
            <View style={styles.draftActions}>
              <Button label="EDIT LATER" variant="ghost" style={styles.draftSecondary} onPress={() => setDraft(null)} />
              <Button
                label="START MISSION"
                trailing="↗"
                style={styles.draftPrimary}
                loading={startMission.isPending}
                onPress={() => startMission.mutate(draft)}
              />
            </View>
          </Card>
        ) : null}
      </ScrollView>

      <View style={styles.controls}>
        <Touchable
          onPress={toggleMute}
          accessibilityLabel={muted ? 'Unmute microphone' : 'Mute microphone'}
          accessibilityState={{ selected: muted }}
          style={[styles.control, muted && styles.controlActive]}
          hoverStyle={styles.controlHover}>
          <Text style={[styles.controlIcon, muted && styles.controlIconActive]}>{muted ? '×' : '◦'}</Text>
          <Text style={[styles.controlText, muted && styles.controlIconActive]}>{muted ? 'UNMUTE' : 'MUTE'}</Text>
        </Touchable>

        {status === 'speaking' ? (
          <Touchable
            onPress={() => connection.current?.interrupt()}
            accessibilityLabel="Interrupt the engineer"
            style={[styles.control, styles.interrupt]}
            hoverStyle={styles.controlHover}>
            <Text style={styles.controlIcon}>Ⅱ</Text>
            <Text style={styles.controlText}>INTERRUPT</Text>
          </Touchable>
        ) : (
          <View style={styles.wave}>
            {[8, 18, 28, 16, 9].map((height, index) => (
              <Animated.View
                key={index}
                style={[
                  styles.waveBar,
                  { height },
                  live && { transform: [{ scaleY: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1.25] }) }] },
                ]}
              />
            ))}
          </View>
        )}

        <Touchable onPress={endCall} accessibilityLabel="End call" style={[styles.control, styles.end]} hoverStyle={styles.endHover}>
          <Text style={styles.endIcon}>⌁</Text>
          <Text style={styles.endText}>END</Text>
        </Touchable>
      </View>
    </SafeAreaView>
  </View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.inkSunken, overflow: 'hidden' },
  safe: { flex: 1 },
  glow: { position: 'absolute', alignSelf: 'center', backgroundColor: '#123D51', opacity: 0.1 },
  glowOuter: { top: -250, width: 640, height: 640, borderRadius: 320 },
  glowMid: { top: -155, width: 450, height: 450, borderRadius: 225 },
  glowInner: { top: -70, width: 285, height: 285, borderRadius: 143 },

  topBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, height: 56 },
  callLabel: { ...type.label, color: palette.paper, flex: 1 },

  content: { alignItems: 'center', paddingHorizontal: spacing.lg, paddingBottom: 160, maxWidth: 680, width: '100%', alignSelf: 'center' },
  avatarHalo: { marginTop: 26, width: 132, height: 132, borderRadius: 66, backgroundColor: '#0F2C34', alignItems: 'center', justifyContent: 'center' },
  avatarHaloLive: { backgroundColor: '#15414A' },
  avatarRing: { width: 112, height: 112, borderRadius: 56, borderWidth: 1, borderColor: palette.mintLine, alignItems: 'center', justifyContent: 'center' },
  avatar: {
    width: 94, height: 94, borderRadius: 47, backgroundColor: palette.mint,
    alignItems: 'center', justifyContent: 'center', ...glow('#0C6B52'),
  },
  avatarText: { color: palette.ink, fontSize: 26, fontWeight: '900', letterSpacing: -1 },

  name: { ...type.title, color: palette.paper, fontSize: 25, marginTop: 22 },
  role: { ...type.label, color: palette.mintText, fontSize: 8, marginTop: 7 },
  context: { ...type.caption, color: palette.muted, marginTop: 10 },
  statusRow: {
    flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 16, borderWidth: 1,
    borderColor: palette.line, borderRadius: radius.pill, paddingHorizontal: 13, paddingVertical: 8,
  },
  status: { ...type.caption, color: palette.paper, fontWeight: '700' },

  transcriptCard: { width: '100%', marginTop: 28 },
  transcriptLabel: { ...type.label, color: palette.mint, marginBottom: 4 },
  turn: { paddingTop: 13 },
  turnRole: { ...type.label, color: palette.blue, fontSize: 8 },
  engineerRole: { color: palette.mint },
  turnText: { ...type.body, color: palette.paper, marginTop: 5 },

  talkRow: { width: '100%', flexDirection: 'row', gap: 8, marginTop: 20 },
  liveInput: {
    flex: 1, minHeight: 46, backgroundColor: palette.panel, borderColor: palette.line, borderWidth: 1,
    borderRadius: radius.md, color: palette.paper, fontSize: 14, paddingHorizontal: 13,
  },
  error: { ...type.body, color: palette.red, textAlign: 'center', marginTop: 20 },

  draftCard: { width: '100%', marginTop: 24 },
  draftLabel: { ...type.label, color: palette.mintDark },
  draftTitle: { ...type.heading, color: palette.ink, fontSize: 18, lineHeight: 25, marginTop: 10 },
  draftMeta: { ...type.caption, color: '#607080', fontSize: 11, marginTop: 8 },
  draftActions: { flexDirection: 'row', gap: 9, marginTop: 18 },
  draftSecondary: { flex: 1 },
  draftPrimary: { flex: 1.4 },

  controls: {
    position: 'absolute', bottom: 0, left: 0, right: 0, minHeight: 118, paddingHorizontal: 28,
    paddingTop: 16, paddingBottom: 26, backgroundColor: '#050A12EE', borderTopWidth: 1,
    borderTopColor: palette.line, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around',
  },
  control: { width: 66, height: 66, borderRadius: 33, backgroundColor: palette.panelRaised, alignItems: 'center', justifyContent: 'center' },
  controlHover: { backgroundColor: palette.panelHover },
  controlActive: { backgroundColor: palette.amber },
  interrupt: { backgroundColor: palette.amberWash, borderWidth: 1, borderColor: palette.amberLine },
  controlIcon: { color: palette.paper, fontSize: 18, fontWeight: '900' },
  controlIconActive: { color: palette.ink },
  controlText: { color: palette.paper, fontSize: 7, fontWeight: '900', letterSpacing: 0.8, marginTop: 3 },
  end: { backgroundColor: '#E24B5A' },
  endHover: { backgroundColor: '#F05C6B' },
  endIcon: { color: '#FFF', fontSize: 23, fontWeight: '900', transform: [{ rotate: '135deg' }] },
  endText: { color: '#FFF', fontSize: 7, fontWeight: '900', letterSpacing: 1, marginTop: 2 },
  wave: { width: 66, height: 66, borderRadius: 33, backgroundColor: palette.mintWash, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 3 },
  waveBar: { width: 3, borderRadius: 2, backgroundColor: palette.mint },
});
