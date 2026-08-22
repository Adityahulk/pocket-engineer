import { useMutation, useQuery } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { api } from '@/lib/api';
import { palette, radius, spacing, type } from '@/lib/theme';
import { createRealtimeVoice } from '@/lib/voice/realtime';
import type { CallStatus, MissionDraft, TranscriptTurn, VoiceConnection } from '@/lib/voice/types';

const statusCopy: Record<CallStatus, string> = {
  idle: 'Ready to call', connecting: 'Engineer is joining…', listening: 'Listening', thinking: 'Thinking it through…',
  speaking: 'Engineer is speaking', ended: 'Call ended', error: 'Call unavailable',
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

  function mergeTranscript(turn: TranscriptTurn) {
    setTranscript((current) => {
      const index = current.findIndex((item) => item.id === turn.id && item.role === turn.role);
      if (index < 0) return [...current, turn].slice(-12);
      const next = [...current];
      next[index] = { ...turn, text: turn.final ? turn.text : `${next[index].text}${turn.text}` };
      return next.slice(-12);
    });
  }

  const voice = useMemo(() => createRealtimeVoice({
    onStatus: setStatus,
    onTranscript: mergeTranscript,
    onMissionDraft: (missionDraft) => {
      setDraft(missionDraft);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    onError: setError,
  }), []);

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
      return api.createTask(projectId, mission.goal, mission.mode);
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

  return <View style={styles.screen}>
    <View style={styles.glow} />
    <SafeAreaView style={styles.safe}>
      <View style={styles.topBar}><Text style={styles.callLabel}>ENGINEER CALL</Text><Text style={styles.encrypted}>● PRIVATE SESSION</Text></View>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Animated.View style={[styles.avatarHalo, { transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] }) }] }]}>
          <View style={styles.avatar}><Text style={styles.avatarText}>PE</Text></View>
        </Animated.View>
        <Text style={styles.name}>Alex · Senior Engineer</Text>
        <Text style={styles.context}>{project.data?.name ?? 'Your software portfolio'}</Text>
        <View style={styles.statusRow}>{(status === 'connecting' || status === 'thinking') && <ActivityIndicator size="small" color={palette.amber} />}<View style={[styles.statusDot, { backgroundColor: status === 'error' ? palette.red : status === 'speaking' ? palette.amber : palette.mint }]} /><Text style={styles.status}>{statusCopy[status]}</Text></View>

        {transcript.length > 0 && <View style={styles.transcriptCard}>
          <Text style={styles.transcriptLabel}>LIVE TRANSCRIPT</Text>
          {transcript.slice(-5).map((turn) => <View key={`${turn.role}-${turn.id}`} style={styles.turn}>
            <Text style={[styles.turnRole, turn.role === 'engineer' && styles.engineerRole]}>{turn.role === 'engineer' ? 'ALEX' : 'YOU'}</Text>
            <Text style={styles.turnText}>{turn.text}</Text>
          </View>)}
        </View>}

        {!voiceConfig.isLoading && !voiceConfig.data?.enabled && <View style={styles.setupCard}>
          <Text style={styles.setupLabel}>VOICE PROVIDER NOT CONFIGURED</Text>
          <Text style={styles.setupTitle}>The call interface is ready.</Text>
          <Text style={styles.setupText}>Add POCKET_OPENAI_API_KEY to the API for live, interruptible speech. You can still brief the engineer below and review the Mission before it starts.</Text>
          <TextInput value={typedBrief} onChangeText={setTypedBrief} placeholder="Tell your engineer what is happening…" placeholderTextColor="#65758A" multiline style={styles.fallbackInput} />
          <Pressable onPress={createTypedDraft} style={styles.fallbackButton}><Text style={styles.fallbackButtonText}>PREPARE MISSION</Text></Pressable>
        </View>}

        {error && voiceConfig.data?.enabled && <Text style={styles.error}>{error}</Text>}

        {draft && <View style={styles.draftCard}>
          <Text style={styles.draftLabel}>MISSION DRAFT · {draft.priority.toUpperCase()}</Text>
          <Text style={styles.draftTitle}>{draft.goal}</Text>
          <Text style={styles.draftMeta}>{draft.mode.toUpperCase()} · No code changes until you start it</Text>
          <View style={styles.draftActions}><Pressable onPress={() => setDraft(null)} style={styles.secondaryButton}><Text style={styles.secondaryText}>EDIT LATER</Text></Pressable><Pressable onPress={() => startMission.mutate(draft)} style={styles.startButton}>{startMission.isPending ? <ActivityIndicator color={palette.ink} /> : <Text style={styles.startText}>START MISSION ↗</Text>}</Pressable></View>
        </View>}
      </ScrollView>

      <View style={styles.controls}>
        <Pressable onPress={toggleMute} style={[styles.control, muted && styles.controlActive]}><Text style={styles.controlIcon}>{muted ? '×' : '◦'}</Text><Text style={styles.controlText}>{muted ? 'UNMUTE' : 'MUTE'}</Text></Pressable>
        {status === 'speaking' ? <Pressable onPress={() => connection.current?.interrupt()} style={[styles.control, styles.interrupt]}><Text style={styles.controlIcon}>Ⅱ</Text><Text style={styles.controlText}>INTERRUPT</Text></Pressable> : <View style={styles.wave}>{[8, 18, 28, 16, 9].map((height, i) => <View key={i} style={[styles.waveBar, { height }]} />)}</View>}
        <Pressable onPress={endCall} style={[styles.control, styles.end]}><Text style={styles.endIcon}>⌁</Text><Text style={styles.endText}>END</Text></Pressable>
      </View>
    </SafeAreaView>
  </View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#050A12', overflow: 'hidden' }, safe: { flex: 1 }, glow: { position: 'absolute', top: -120, alignSelf: 'center', width: 430, height: 430, borderRadius: 215, backgroundColor: '#123D51', opacity: 0.34 },
  topBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, height: 54 }, callLabel: { ...type.label, color: palette.paper, flex: 1 }, encrypted: { ...type.label, color: palette.mint, fontSize: 8 },
  content: { alignItems: 'center', paddingHorizontal: spacing.lg, paddingBottom: 150, maxWidth: 680, width: '100%', alignSelf: 'center' }, avatarHalo: { marginTop: 28, width: 126, height: 126, borderRadius: 63, backgroundColor: '#153C45', alignItems: 'center', justifyContent: 'center' }, avatar: { width: 96, height: 96, borderRadius: 48, backgroundColor: palette.mint, alignItems: 'center', justifyContent: 'center', borderWidth: 6, borderColor: '#0D1A25' }, avatarText: { color: palette.ink, fontSize: 26, fontWeight: '900', letterSpacing: -1 },
  name: { color: palette.paper, fontSize: 24, fontWeight: '900', letterSpacing: -0.6, marginTop: 22 }, context: { color: palette.muted, fontSize: 13, marginTop: 6 }, statusRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 13 }, statusDot: { width: 7, height: 7, borderRadius: 4 }, status: { color: '#C0CBD6', fontSize: 12, fontWeight: '700' },
  transcriptCard: { width: '100%', backgroundColor: palette.panel, borderColor: palette.line, borderWidth: 1, borderRadius: radius.lg, padding: spacing.md, marginTop: 28 }, transcriptLabel: { ...type.label, color: palette.mint, marginBottom: 6 }, turn: { paddingTop: 11 }, turnRole: { ...type.label, color: palette.blue, fontSize: 8 }, engineerRole: { color: palette.mint }, turnText: { color: palette.paper, fontSize: 14, lineHeight: 20, marginTop: 4 },
  setupCard: { width: '100%', backgroundColor: palette.panel, borderColor: palette.line, borderWidth: 1, borderRadius: radius.lg, padding: spacing.md, marginTop: 28 }, setupLabel: { ...type.label, color: palette.amber }, setupTitle: { color: palette.paper, fontSize: 19, fontWeight: '900', marginTop: 10 }, setupText: { color: palette.muted, fontSize: 13, lineHeight: 20, marginTop: 8 }, fallbackInput: { minHeight: 82, backgroundColor: '#09121E', borderColor: palette.line, borderWidth: 1, borderRadius: radius.md, color: palette.paper, fontSize: 14, lineHeight: 20, padding: 12, marginTop: 15, textAlignVertical: 'top' }, fallbackButton: { backgroundColor: palette.paper, alignItems: 'center', padding: 13, borderRadius: 12, marginTop: 10 }, fallbackButtonText: { color: palette.ink, fontWeight: '900', fontSize: 10, letterSpacing: 1 },
  error: { color: palette.red, textAlign: 'center', marginTop: 20, lineHeight: 20 }, draftCard: { width: '100%', backgroundColor: palette.paper, borderRadius: radius.lg, padding: spacing.md, marginTop: 22 }, draftLabel: { ...type.label, color: palette.mintDark }, draftTitle: { color: palette.ink, fontSize: 18, lineHeight: 24, fontWeight: '900', marginTop: 9 }, draftMeta: { color: '#607080', fontSize: 11, marginTop: 7 }, draftActions: { flexDirection: 'row', gap: 9, marginTop: 17 }, secondaryButton: { flex: 1, alignItems: 'center', justifyContent: 'center', borderColor: '#CCD4D7', borderWidth: 1, borderRadius: 12, minHeight: 46 }, secondaryText: { color: '#607080', fontWeight: '900', fontSize: 9, letterSpacing: 1 }, startButton: { flex: 1.4, backgroundColor: palette.mint, alignItems: 'center', justifyContent: 'center', borderRadius: 12, minHeight: 46 }, startText: { color: palette.ink, fontWeight: '900', fontSize: 9, letterSpacing: 1 },
  controls: { position: 'absolute', bottom: 0, left: 0, right: 0, minHeight: 116, paddingHorizontal: 28, paddingTop: 15, paddingBottom: 26, backgroundColor: '#080F1AEE', borderTopWidth: 1, borderTopColor: palette.line, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' }, control: { width: 66, height: 66, borderRadius: 33, backgroundColor: palette.panelRaised, alignItems: 'center', justifyContent: 'center' }, controlActive: { backgroundColor: palette.amber }, interrupt: { backgroundColor: '#3A2D0B' }, end: { backgroundColor: '#E24B5A' }, controlIcon: { color: palette.paper, fontSize: 18, fontWeight: '900' }, controlText: { color: palette.paper, fontSize: 7, fontWeight: '900', letterSpacing: 0.8, marginTop: 3 }, endIcon: { color: '#FFF', fontSize: 23, fontWeight: '900', transform: [{ rotate: '135deg' }] }, endText: { color: '#FFF', fontSize: 7, fontWeight: '900', letterSpacing: 1, marginTop: 2 }, wave: { width: 66, height: 66, borderRadius: 33, backgroundColor: '#0D2025', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 3 }, waveBar: { width: 3, borderRadius: 2, backgroundColor: palette.mint },
});
