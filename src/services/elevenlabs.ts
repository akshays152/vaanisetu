import type { VoiceConfig } from '../types';

const STORAGE_KEY = 'vaanisetu.elevenlabs.config';

const DEFAULT_CONFIG: VoiceConfig = {
  speechEnabled: true,
};

export class ElevenLabsService {
  private config: VoiceConfig;
  private currentAudio: HTMLAudioElement | null = null;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private recognition: any = null;
  private isListening = false;
  private isSpeaking = false;

  constructor() {
    this.config = this.loadConfig();
  }

  public loadConfig(): VoiceConfig {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        return { ...DEFAULT_CONFIG, ...JSON.parse(saved) };
      }
    } catch {
      // fallback to default
    }
    return { ...DEFAULT_CONFIG };
  }

  public saveConfig(updates: Partial<VoiceConfig>): VoiceConfig {
    this.config = { ...this.config, ...updates };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.config));
    } catch {
      // ignore storage error
    }
    return this.config;
  }

  public getConfig(): VoiceConfig {
    return { ...this.config };
  }

  public getIsSpeaking(): boolean {
    return this.isSpeaking;
  }

  public getIsListening(): boolean {
    return this.isListening;
  }

  /**
   * Speak using the browser fallback. ElevenLabs credentials are server-side;
   * live provider audio must be delivered through a backend-authorized session.
   */
  public async speak(
    text: string,
    options?: {
      voiceName?: string;
      onStart?: () => void;
      onEnd?: () => void;
      onError?: (err: Error) => void;
    }
  ): Promise<void> {
    if (!this.config.speechEnabled) {
      options?.onEnd?.();
      return;
    }

    this.stopAudio();
    this.isSpeaking = true;
    options?.onStart?.();

    // Browser SpeechSynthesis is intentionally a clearly labeled demo fallback.
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      
      // Match Hindi or Indian English voice if available in user's OS
      const voices = window.speechSynthesis.getVoices();
      const preferredVoice = options?.voiceName ? voices.find((voice) => voice.name === options.voiceName) : undefined;
      const hindiOrIndianVoice = voices.find(
        (v) => v.lang.includes('hi') || v.lang.includes('IN') || v.name.includes('India')
      );
      utterance.voice = preferredVoice || hindiOrIndianVoice || voices[0] || null;
      utterance.lang = utterance.voice?.lang || 'en-IN';
      utterance.rate = 0.98;
      utterance.pitch = 1.05;

      utterance.onend = () => {
        this.isSpeaking = false;
        options?.onEnd?.();
      };
      utterance.onerror = () => {
        this.isSpeaking = false;
        options?.onEnd?.();
      };

      window.speechSynthesis.speak(utterance);
    } else {
      this.isSpeaking = false;
      options?.onEnd?.();
    }
  }

  public stopAudio(): void {
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio.currentTime = 0;
      this.currentAudio = null;
    }
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    this.isSpeaking = false;
  }

  /**
   * Start microphone listening using Web Speech API (SpeechRecognition)
   */
  public startListening(callbacks: {
    onResult: (text: string, isFinal: boolean) => void;
    onError?: (err: string) => void;
    onEnd?: () => void;
  }): boolean {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      callbacks.onError?.('Speech recognition is not supported in this browser. Please use Chrome/Edge or the text composer.');
      return false;
    }

    try {
      this.stopListening();
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = 'hi-IN'; // Recognizes both Hindi and Indian English

      recognition.onstart = () => {
        this.isListening = true;
      };

      recognition.onresult = (event: any) => {
        let interimText = '';
        let finalText = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalText += event.results[i][0].transcript;
          } else {
            interimText += event.results[i][0].transcript;
          }
        }

        if (finalText) {
          callbacks.onResult(finalText, true);
        } else if (interimText) {
          callbacks.onResult(interimText, false);
        }
      };

      recognition.onerror = (event: any) => {
        this.isListening = false;
        callbacks.onError?.(event.error || 'Microphone error');
      };

      recognition.onend = () => {
        this.isListening = false;
        callbacks.onEnd?.();
      };

      this.recognition = recognition;
      recognition.start();
      return true;
    } catch (err: any) {
      callbacks.onError?.(err.message || 'Could not start microphone');
      return false;
    }
  }

  public stopListening(): void {
    if (this.recognition) {
      try {
        this.recognition.abort();
      } catch {
        // ignore
      }
      this.recognition = null;
    }
    this.isListening = false;
  }

  private setupAudioAnalyser(audio: HTMLAudioElement): void {
    try {
      if (!this.audioContext) {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        this.audioContext = new AudioContextClass();
      }
      if (this.audioContext.state === 'suspended') {
        this.audioContext.resume();
      }
      const source = this.audioContext.createMediaElementSource(audio);
      const analyser = this.audioContext.createAnalyser();
      analyser.fftSize = 64;
      source.connect(analyser);
      analyser.connect(this.audioContext.destination);
      this.analyser = analyser;
    } catch {
      // AudioContext might already be bound or blocked by browser policy
    }
  }
}

export const elevenLabsService = new ElevenLabsService();
