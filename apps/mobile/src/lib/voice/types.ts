export type CallStatus = 'idle' | 'connecting' | 'listening' | 'thinking' | 'speaking' | 'ended' | 'error';

export type TranscriptTurn = {
  id: string;
  role: 'user' | 'engineer';
  text: string;
  final: boolean;
};

export type MissionDraft = {
  goal: string;
  mode: 'fix' | 'modify';
  priority: 'normal' | 'high' | 'urgent';
};

export type VoiceCallbacks = {
  onStatus: (status: CallStatus) => void;
  onTranscript: (turn: TranscriptTurn) => void;
  onMissionDraft: (draft: MissionDraft) => void;
  onError: (message: string) => void;
};

export type VoiceConnection = {
  start: (secret: string) => Promise<void>;
  setMuted: (muted: boolean) => void;
  interrupt: () => void;
  sendText: (text: string) => void;
  end: () => void;
};

