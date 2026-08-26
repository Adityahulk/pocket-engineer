import type { VoiceCallbacks } from './types';
import { api } from '../api';

type Channel = { send: (payload: string) => void; readyState?: string };

const TOOLS = new Set(['get_status', 'start_mission', 'ship_mission', 'reject_mission']);

export function handleRealtimeEvent(raw: string, callbacks: VoiceCallbacks, channel: Channel, context: { projectId?: string; missionId?: string }) {
  let event: Record<string, unknown>;
  try {
    event = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return;
  }
  const type = String(event.type ?? '');
  if (type === 'session.created' || type === 'input_audio_buffer.speech_stopped') callbacks.onStatus('thinking');
  if (type === 'input_audio_buffer.speech_started') callbacks.onStatus('listening');
  if (type === 'response.created') callbacks.onStatus('thinking');
  if (type === 'response.output_audio.delta' || type === 'response.audio.delta') callbacks.onStatus('speaking');
  if (type === 'response.done' || type === 'response.audio.done') callbacks.onStatus('listening');

  if (type === 'conversation.item.input_audio_transcription.completed') {
    const text = String(event.transcript ?? '').trim();
    if (text) callbacks.onTranscript({ id: String(event.item_id ?? Date.now()), role: 'user', text, final: true });
  }
  if (type === 'response.output_audio_transcript.delta' || type === 'response.audio_transcript.delta') {
    const text = String(event.delta ?? '');
    if (text) callbacks.onTranscript({ id: String(event.item_id ?? event.response_id ?? 'engineer-live'), role: 'engineer', text, final: false });
  }
  if (type === 'response.output_audio_transcript.done' || type === 'response.audio_transcript.done') {
    const text = String(event.transcript ?? '').trim();
    if (text) callbacks.onTranscript({ id: String(event.item_id ?? event.response_id ?? Date.now()), role: 'engineer', text, final: true });
  }
  if (type === 'response.function_call_arguments.done' && TOOLS.has(String(event.name))) {
    void fulfillTool(String(event.name), String(event.arguments ?? '{}'), String(event.call_id ?? ''), callbacks, channel, context);
  }
  if (type === 'error') {
    const error = event.error as { message?: string } | undefined;
    callbacks.onError(error?.message ?? 'The realtime voice session reported an error.');
  }
}

async function fulfillTool(
  name: string,
  rawArgs: string,
  callId: string,
  callbacks: VoiceCallbacks,
  channel: Channel,
  context: { projectId?: string; missionId?: string },
) {
  try {
    const args = JSON.parse(rawArgs || '{}') as Record<string, unknown>;
    if (name === 'start_mission' && args.goal && (args.mode === 'fix' || args.mode === 'modify')) {
      callbacks.onMissionDraft({
        goal: String(args.goal),
        mode: args.mode,
        priority: args.priority === 'high' || args.priority === 'urgent' ? args.priority : 'normal',
        autonomy: args.autonomy === 'autopilot' ? 'autopilot' : 'assisted',
      });
    }
    const result = await api.voiceTool(name, args, context.projectId, context.missionId);
    if (result.mission && name === 'start_mission') callbacks.onMissionStarted?.(result.mission);
    if (result.mission && (name === 'ship_mission' || name === 'reject_mission')) callbacks.onMissionUpdated?.(result.mission);
    sendToolOutput(channel, callId, result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Tool failed';
    callbacks.onError(message);
    sendToolOutput(channel, callId, { error: message });
  }
}

function sendToolOutput(channel: Channel, callId: string, output: unknown) {
  if (channel.readyState && channel.readyState !== 'open') return;
  channel.send(JSON.stringify({
    type: 'conversation.item.create',
    item: { type: 'function_call_output', call_id: callId, output: JSON.stringify(output) },
  }));
  channel.send(JSON.stringify({ type: 'response.create' }));
}

export function textMessage(text: string) {
  return JSON.stringify({
    type: 'conversation.item.create',
    item: { type: 'message', role: 'user', content: [{ type: 'input_text', text }] },
  });
}
