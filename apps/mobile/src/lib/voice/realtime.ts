import { mediaDevices, RTCPeerConnection, RTCSessionDescription } from 'react-native-webrtc';

import { handleRealtimeEvent, textMessage } from './protocol';
import type { VoiceCallbacks, VoiceConnection } from './types';

export function createRealtimeVoice(callbacks: VoiceCallbacks): VoiceConnection {
  let peer: RTCPeerConnection | null = null;
  let channel: ReturnType<RTCPeerConnection['createDataChannel']> | null = null;
  let stream: Awaited<ReturnType<typeof mediaDevices.getUserMedia>> | null = null;

  return {
    async start(secret: string) {
      callbacks.onStatus('connecting');
      try {
        peer = new RTCPeerConnection({});
        stream = await mediaDevices.getUserMedia({ audio: true, video: false });
        stream.getTracks().forEach((track) => peer?.addTrack(track, stream!));
        channel = peer.createDataChannel('oai-events');
        channel.onopen = () => {
          callbacks.onStatus('listening');
          channel?.send(JSON.stringify({ type: 'response.create', response: { instructions: 'Greet the user briefly and ask how you can help with their software.' } }));
        };
        channel.onmessage = (event: { data?: unknown }) => handleRealtimeEvent(String(event.data), callbacks, channel!);
        const offer = await peer.createOffer({});
        await peer.setLocalDescription(offer);
        const response = await fetch('https://api.openai.com/v1/realtime/calls', {
          method: 'POST',
          headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/sdp' },
          body: offer.sdp,
        });
        if (!response.ok) throw new Error(`Voice connection failed (${response.status})`);
        await peer.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp: await response.text() }));
      } catch (error) {
        callbacks.onStatus('error'); callbacks.onError(error instanceof Error ? error.message : 'Unable to start the engineer call.');
        stream?.getTracks().forEach((track) => track.stop()); peer?.close();
      }
    },
    setMuted(muted) { stream?.getAudioTracks().forEach((track) => { track.enabled = !muted; }); },
    interrupt() {
      if (channel?.readyState === 'open') channel.send(JSON.stringify({ type: 'response.cancel' }));
      callbacks.onStatus('listening');
    },
    sendText(text) {
      if (channel?.readyState !== 'open') return;
      channel.send(textMessage(text)); channel.send(JSON.stringify({ type: 'response.create' }));
    },
    end() {
      stream?.getTracks().forEach((track) => track.stop()); channel?.close(); peer?.close(); callbacks.onStatus('ended');
    },
  };
}
