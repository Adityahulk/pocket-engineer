import type { MissionDraft, VoiceCallbacks } from './types';

type Channel = { send: (payload: string) => void; readyState?: string };

export function handleRealtimeEvent(raw: string, callbacks: VoiceCallbacks, channel: Channel) {
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
  if (type === 'response.function_call_arguments.done' && event.name === 'draft_mission') {
    try {
      const parsed = JSON.parse(String(event.arguments ?? '{}')) as Partial<MissionDraft>;
      if (!parsed.goal || (parsed.mode !== 'fix' && parsed.mode !== 'modify')) return;
      const draft: MissionDraft = {
        goal: parsed.goal,
        mode: parsed.mode,
        priority: parsed.priority === 'high' || parsed.priority === 'urgent' ? parsed.priority : 'normal',
      };
      callbacks.onMissionDraft(draft);
      if (!channel.readyState || channel.readyState === 'open') {
        channel.send(JSON.stringify({
          type: 'conversation.item.create',
          item: {
            type: 'function_call_output',
            call_id: event.call_id,
            output: JSON.stringify({ status: 'drafted_for_visible_confirmation', mission: draft }),
          },
        }));
        channel.send(JSON.stringify({ type: 'response.create' }));
      }
    } catch {
      callbacks.onError('The engineer could not prepare a valid mission draft.');
    }
  }
  if (type === 'error') {
    const error = event.error as { message?: string } | undefined;
    callbacks.onError(error?.message ?? 'The realtime voice session reported an error.');
  }
}

export function textMessage(text: string) {
  return JSON.stringify({
    type: 'conversation.item.create',
    item: { type: 'message', role: 'user', content: [{ type: 'input_text', text }] },
  });
}

