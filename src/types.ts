export type AgentStatus = 'Active' | 'Draft';

export type Agent = {
  id: string;
  name: string;
  purpose: string;
  language: string;
  bilingual: boolean;
  instructions: string;
  greeting: string;
  voice: string;
  context: string;
  status: AgentStatus;
  createdAt: string;
  elevenLabsAgentId?: string;
  elevenLabsVoiceId?: string;
};

export type BookingResult = {
  status: 'confirmed' | 'pending' | 'failed';
  patientName?: string;
  doctorName?: string;
  date?: string;
  time?: string;
  message: string;
  appointmentId?: string;
  sessionId?: string;
};

export type TestSession = {
  sessionId: string;
  mode: 'demo' | 'live';
  signedUrl?: string;
  conversationToken?: string;
  agentId?: string;
};

export type VoiceSessionState = 'unavailable' | 'ready' | 'speaking' | 'listening' | 'idle';

export type VoiceConfig = {
  speechEnabled: boolean;
};

export type ChatMessage = {
  id: string;
  from: 'agent' | 'you';
  text: string;
  timestamp: string;
  isAudioPlaying?: boolean;
};
