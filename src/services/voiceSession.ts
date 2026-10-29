import type { TestSession, VoiceSessionState } from '../types';
import { elevenLabsService } from './elevenlabs';
import { clinicConversationEngine } from './conversationEngine';

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
}

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
};
