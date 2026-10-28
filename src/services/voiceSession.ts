import type { TestSession } from '../types';
export type VoiceSessionState = 'unavailable' | 'ready';
// Official ElevenLabs client entry point: Conversation.startSession({ signedUrl })
// or Conversation.startSession({ conversationToken }). This adapter stays inert
// until the backend contract is confirmed; no browser API key is used here.
export const voiceSession = { getState(session?:TestSession):VoiceSessionState{return session?.mode==='live'&&Boolean(session.signedUrl||session.conversationToken)?'ready':'unavailable'}, requirements:'Backend must return signedUrl or conversationToken; the ElevenLabs API key remains server-side.' };
