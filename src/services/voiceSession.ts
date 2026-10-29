import { Conversation, type Conversation as ConversationInstance, type MessagePayload, type Mode, type Status } from '@elevenlabs/client';
import type { TestSession, VoiceSessionState } from '../types';
import { elevenLabsService } from './elevenlabs';
import { clinicConversationEngine } from './conversationEngine';

export type LiveSessionHandlers = {
  onStatusChange?: (status: Status) => void;
  onModeChange?: (mode: 'speaking' | 'listening') => void;
  onMessage?: (message: MessagePayload) => void;
  onError?: (message: string) => void;
};

export interface VoiceSessionController {
  getState: (session?: TestSession) => VoiceSessionState;
  speak: (text: string, onEnd?: () => void) => Promise<void>;
  stopAudio: () => void;
  startListening: (
    onTranscript: (text: string, isFinal: boolean) => void,
    onError?: (err: string) => void
  ) => boolean;
  stopListening: () => void;
  processMessage: (text: string) => ReturnType<typeof clinicConversationEngine.processMessage>;
  resetConversation: () => void;
  startLiveSession: (session: TestSession, handlers: LiveSessionHandlers) => Promise<void>;
  endLiveSession: () => Promise<void>;
  sendLiveMessage: (text: string) => void;
}

let liveConversation: ConversationInstance | null = null;

export const voiceSession: VoiceSessionController = {
  getState(session?: TestSession): VoiceSessionState {
    if (elevenLabsService.getIsSpeaking()) return 'speaking';
    if (elevenLabsService.getIsListening()) return 'listening';
    if (session?.mode === 'live' && Boolean(session.signedUrl || session.conversationToken)) {
      return 'idle';
    }
    return 'idle';
  },

  async speak(text: string, onEnd?: () => void): Promise<void> {
    await elevenLabsService.speak(text, { onEnd });
  },

  stopAudio(): void {
    elevenLabsService.stopAudio();
  },

  startListening(
    onTranscript: (text: string, isFinal: boolean) => void,
    onError?: (err: string) => void
  ): boolean {
    return elevenLabsService.startListening({
      onResult: onTranscript,
      onError,
    });
  },

  stopListening(): void {
    elevenLabsService.stopListening();
  },

  processMessage(text: string) {
    return clinicConversationEngine.processMessage(text);
  },

  resetConversation(): void {
    clinicConversationEngine.reset();
  },

  async startLiveSession(session: TestSession, handlers: LiveSessionHandlers): Promise<void> {
    if (liveConversation) {
      await liveConversation.endSession();
      liveConversation = null;
    }
    if (!session.signedUrl && !session.conversationToken && !session.agentId) {
      throw new Error('The backend did not return live ElevenLabs session authorization.');
    }
    const callbacks = {
      onConnect: () => handlers.onStatusChange?.('connected'),
      onDisconnect: () => handlers.onStatusChange?.('disconnected'),
      onStatusChange: ({ status }: { status: Status }) => handlers.onStatusChange?.(status),
      onModeChange: ({ mode }: { mode: Mode }) => handlers.onModeChange?.(mode),
      onMessage: (message: MessagePayload) => handlers.onMessage?.(message),
      onError: (message: string) => handlers.onError?.(message),
    };
    if (session.signedUrl) {
      liveConversation = await Conversation.startSession({ ...callbacks, signedUrl: session.signedUrl });
    } else if (session.conversationToken) {
      liveConversation = await Conversation.startSession({ ...callbacks, conversationToken: session.conversationToken });
    } else {
      liveConversation = await Conversation.startSession({ ...callbacks, agentId: session.agentId! });
    }
  },

  async endLiveSession(): Promise<void> {
    if (!liveConversation) return;
    const conversation = liveConversation;
    liveConversation = null;
    await conversation.endSession();
  },

  sendLiveMessage(text: string): void {
    if (!liveConversation) throw new Error('No live ElevenLabs session is active.');
    liveConversation.sendUserMessage(text);
  },
};
