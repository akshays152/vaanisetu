import {
  ArrowLeft,
  CheckCircle2,
  Mic,
  MicOff,
  RotateCcw,
  Send,
  Square,
  Volume2,
  VolumeX,
  Settings as SettingsIcon,
  Sparkles,
  FileText,
  Play,
  Pause,
  Radio,
  ExternalLink,
  Info,
  Clock,
  UserCheck,
} from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { useEffect, useState, useRef } from 'react';
import { api } from '../services/api';
import { voiceSession } from '../services/voiceSession';
import { elevenLabsService } from '../services/elevenlabs';
import { BACKUP_DEMO_SCRIPT, ELEVENLABS_VOICES } from '../data/clinicReceptionist';
import type { Agent, BookingResult, ChatMessage, VoiceConfig } from '../types';

export function Test() {
  const { id = 'clinic-receptionist' } = useParams();
  const [agent, setAgent] = useState<Agent>();
  const [active, setActive] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [booking, setBooking] = useState<BookingResult | null>(null);

  // Voice AI States
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [speechEnabled, setSpeechEnabled] = useState(true);
  const [voiceConfig, setVoiceConfig] = useState<VoiceConfig>(elevenLabsService.getConfig());
  const [showConfig, setShowConfig] = useState(false);
  const [showScriptModal, setShowScriptModal] = useState(false);
  const [showPromptModal, setShowPromptModal] = useState(false);

  // Backup Script Player
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(false);
  const [autoPlayTimer, setAutoPlayTimer] = useState<ReturnType<typeof setTimeout> | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.getAgent(id).then(setAgent);
  }, [id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isSpeaking]);

  // Clean up audio on unmount
  useEffect(() => {
    return () => {
      voiceSession.stopAudio();
      voiceSession.stopListening();
      if (autoPlayTimer) clearTimeout(autoPlayTimer);
    };
  }, [autoPlayTimer]);

  const startSession = async () => {
    await api.startSession(id);
    voiceSession.resetConversation();
    setActive(true);
    setCurrentStepIndex(0);

    const greeting =
      agent?.greeting ||
      'Namaste! Aarogya Clinic mein aapka swagat hai. Main aapki kya sahayata kar sakti hoon? How can I help you today?';

    const greetingMsg: ChatMessage = {
      id: crypto.randomUUID(),
      from: 'agent',
      text: greeting,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages([greetingMsg]);

    if (speechEnabled) {
      setIsSpeaking(true);
      await voiceSession.speak(greeting, () => setIsSpeaking(false));
    }
  };

  const endSession = () => {
    voiceSession.stopAudio();
    voiceSession.stopListening();
    if (autoPlayTimer) clearTimeout(autoPlayTimer);
    setIsAutoPlaying(false);
    setIsListening(false);
    setIsSpeaking(false);
    setActive(false);
  };

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || input).trim();
    if (!text) return;
    setInput('');

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      from: 'you',
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);

    // Process through Receptionist Conversational Engine
    const outcome = voiceSession.processMessage(text);

    const agentMsg: ChatMessage = {
      id: crypto.randomUUID(),
      from: 'agent',
      text: outcome.reply,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setTimeout(async () => {
      setMessages((prev) => [...prev, agentMsg]);

      // If action is book_appointment, trigger backend persistence
      if (outcome.action === 'book_appointment' && outcome.bookingData) {
        const saved = await api.getBooking();
        setBooking({ ...saved, ...outcome.bookingData });
      }

      // Voice Audio Response via ElevenLabs
      if (speechEnabled) {
        setIsSpeaking(true);
        await voiceSession.speak(outcome.reply, () => setIsSpeaking(false));
      }
    }, 400);
  };

  // Toggle Live Microphone Listening
  const toggleListening = () => {
    if (isListening) {
      voiceSession.stopListening();
      setIsListening(false);
    } else {
      if (!active) {
        startSession();
      }
      setIsListening(true);
      voiceSession.stopAudio();
      setIsSpeaking(false);

      const ok = voiceSession.startListening(
        (transcript, isFinal) => {
          if (isFinal) {
            setIsListening(false);
            handleSendMessage(transcript);
          } else {
            setInput(transcript);
          }
        },
        (err) => {
          setIsListening(false);
          console.warn('Speech recognition notice:', err);
        }
      );

      if (!ok) {
        setIsListening(false);
      }
    }
  };

  // Run a specific step from the Backup Demo Script
  const executeScriptStep = async (stepIndex: number) => {
    if (!active) {
      await startSession();
    }
    const step = BACKUP_DEMO_SCRIPT[stepIndex];
    if (!step) return;

    setCurrentStepIndex(stepIndex + 1);

    if (step.intent === 'greeting') {
      // Just re-speak greeting if needed
      if (speechEnabled) {
        setIsSpeaking(true);
        await voiceSession.speak(step.agentResponse, () => setIsSpeaking(false));
      }
      return;
    }

    handleSendMessage(step.userPrompt);
  };

  // Auto-Play complete verified demo sequence
  const startAutoPlay = async () => {
    if (isAutoPlaying) {
      if (autoPlayTimer) clearTimeout(autoPlayTimer);
      setIsAutoPlaying(false);
      return;
    }

    setIsAutoPlaying(true);
    if (!active) {
      await startSession();
    }

    let current = 1;
    const playNext = () => {
      if (current >= BACKUP_DEMO_SCRIPT.length) {
        setIsAutoPlaying(false);
        return;
      }
      executeScriptStep(current);
      current++;
      const timer = setTimeout(playNext, 4500);
      setAutoPlayTimer(timer);
    };

    const firstTimer = setTimeout(playNext, 2000);
    setAutoPlayTimer(firstTimer);
  };

  const handleSaveVoiceConfig = (updates: Partial<VoiceConfig>) => {
    const updated = elevenLabsService.saveConfig(updates);
    setVoiceConfig(updated);
    setSpeechEnabled(updated.speechEnabled);
  };

  const testVoiceSample = async () => {
    setIsSpeaking(true);
    await elevenLabsService.speak(
      'Namaste! Aarogya Clinic mein aapka swagat hai. Main aapki kya sahayata kar sakti hoon?',
      {
        voiceId: voiceConfig.voiceId,
        onEnd: () => setIsSpeaking(false),
      }
    );
  };

  return (
    <div className="page test-page">
      <Link to="/dashboard" className="back">
        <ArrowLeft size={16} /> Back to agents
      </Link>

      <div className="test-head">
        <div>
          <div className="eyebrow">
            <Radio size={13} className="pulse-icon" /> MEMBER 1 · ELEVENLABS VOICE AI & TEST LAB
          </div>
          <h1>Have a conversation.</h1>
          <p>
            Talk live to <strong>{agent?.name || 'Aarogya Clinic Receptionist'}</strong> in Hindi &
            English, or test with the backup demo script.
          </p>
        </div>

        <div className="head-right-actions">
          <button
            className="secondary-btn small-btn"
            onClick={() => setShowPromptModal(true)}
            title="Inspect Agent Instructions & Knowledge Base"
          >
            <FileText size={15} /> Agent Instructions
          </button>
          <button
            className="secondary-btn small-btn"
            onClick={() => setShowConfig(!showConfig)}
            title="ElevenLabs Configuration"
          >
            <SettingsIcon size={15} /> Voice Settings
          </button>
          <div className={`connection ${active ? 'connected' : ''}`}>
            <i />
            {active ? 'Session active · ElevenLabs Ready' : 'Ready to connect'}
          </div>
        </div>
      </div>

      {/* Backup Demo Script Quick-Bar */}
      <div className="demo-script-banner">
        <div className="banner-info">
          <span className="badge-member">MEMBER 1 VERIFIED SCRIPT</span>
          <strong>Fail-Safe Backup Demo Script</strong>
          <span className="banner-sub">
            Guaranteed 100% flawless presentation flow for judges & team.
          </span>
        </div>
        <div className="banner-controls">
          <button
            className={`autoplay-btn ${isAutoPlaying ? 'playing' : ''}`}
            onClick={startAutoPlay}
          >
            {isAutoPlaying ? <Pause size={14} /> : <Play size={14} />}
            {isAutoPlaying ? 'Pause Auto-Play' : 'Auto-Run Complete Demo'}
          </button>
          <button
            className="text-link-btn"
            onClick={() => setShowScriptModal(true)}
          >
            View Script Cheatsheet <ExternalLink size={12} />
          </button>
        </div>
      </div>

      {/* Step Pills for 1-Click Interactive Demo */}
      <div className="script-steps-pills">
        {BACKUP_DEMO_SCRIPT.map((step, idx) => (
          <button
            key={step.id}
            className={`script-step-pill ${currentStepIndex === idx + 1 ? 'current' : ''}`}
            onClick={() => executeScriptStep(idx)}
            title={`${step.userPrompt} -> ${step.agentResponse}`}
          >
            <span className="pill-num">0{step.id}</span>
            <span className="pill-title">{step.title}</span>
          </button>
        ))}
      </div>

      <div className="test-layout">
        {/* Main Conversation Stream */}
        <section className="conversation">
          <div className="conversation-head">
            <div className="agent-title-cluster">
              <span className="avatar small">{agent?.name.slice(0, 1) || 'A'}</span>
              <div>
                <b>{agent?.name || 'Aarogya Clinic Receptionist'}</b>
                <span className="voice-tag">
                  <Volume2 size={11} /> {voiceConfig.voiceId === '21m00Tcm4TlvDq8ikWAM' ? 'Riya (Hindi/English)' : 'ElevenLabs Voice'}
                </span>
              </div>
            </div>

            <div className="session-status-badges">
              {isSpeaking && (
                <span className="speaking-badge">
                  <span className="mini-wave">
                    <i /><i /><i /><i />
                  </span>
                  Speaking
                </span>
              )}
              {isListening && (
                <span className="listening-badge">
                  <Mic size={12} /> Listening to your voice...
                </span>
              )}
              <span className="demo-tag">
                {voiceConfig.apiKey ? 'ELEVENLABS LIVE' : 'VOICE SYNTHESIS ACTIVE'}
              </span>
            </div>
          </div>

          <div className="messages">
            {!active ? (
              <div className="empty-chat">
                <div className="mic-circle" onClick={startSession} style={{ cursor: 'pointer' }}>
                  <Mic size={28} />
                </div>
                <h3>Start bilingual voice conversation</h3>
                <p>
                  Experience the receptionist speaking in natural Hindi & English. You can speak into
                  your microphone, use the keyboard, or click the 1-click backup script buttons.
                </p>
                <div className="empty-actions">
                  <button className="primary-btn" onClick={startSession}>
                    <Mic size={17} /> Start Voice Session
                  </button>
                  <button className="secondary-btn" onClick={startAutoPlay}>
                    <Play size={15} /> Run Backup Demo
                  </button>
                </div>
              </div>
            ) : (
              <>
                {messages.map((m) => (
                  <div className={`message ${m.from}`} key={m.id}>
                    <span>{m.from === 'agent' ? 'A' : 'You'}</span>
                    <div className="message-content">
                      <p>{m.text}</p>
                      <small className="msg-time">{m.timestamp}</small>
                    </div>
                  </div>
                ))}

                {isSpeaking && (
                  <div className="message agent speaking-indicator">
                    <span>A</span>
                    <div className="message-content">
                      <div className="audio-bars">
                        {Array.from({ length: 12 }, (_, i) => (
                          <span
                            key={i}
                            className="audio-bar"
                            style={{ animationDelay: `${(i % 4) * 0.15}s` }}
                          />
                        ))}
                      </div>
                      <small>Playing voice response...</small>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />

                {/* Quick Interactive Prompt Suggestions */}
                <div className="suggestions">
                  <button onClick={() => handleSendMessage('Mujhe Dr. Mehta se appointment chahiye')}>
                    🗣️ "Dr. Mehta se appointment chahiye"
                  </button>
                  <button onClick={() => handleSendMessage('Tuesday 10:30 AM chalega, please confirm')}>
                    ✅ "Tuesday 10:30 AM chalega"
                  </button>
                  <button onClick={() => handleSendMessage('Aarogya Clinic ke timings aur fee kya hai?')}>
                    🕒 "Timings aur fees kya hai?"
                  </button>
                </div>
              </>
            )}
          </div>

          {active && (
            <div className="composer">
              <button
                type="button"
                className={`mic-toggle-btn ${isListening ? 'active' : ''}`}
                onClick={toggleListening}
                title={isListening ? 'Stop listening' : 'Talk with microphone'}
              >
                {isListening ? <MicOff size={18} /> : <Mic size={18} />}
              </button>

              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                placeholder={
                  isListening
                    ? 'Listening... speak now in Hindi or English...'
                    : 'Type a message or click the microphone to speak...'
                }
              />

              <button
                type="button"
                className="voice-mute-btn"
                onClick={() => setSpeechEnabled(!speechEnabled)}
                title={speechEnabled ? 'Mute voice audio' : 'Unmute voice audio'}
              >
                {speechEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
              </button>

              <button type="button" onClick={() => handleSendMessage()}>
                <Send size={17} />
              </button>
            </div>
          )}

          <div className="conversation-foot">
            {active ? (
              <button className="stop-btn" onClick={endSession}>
                <Square size={13} fill="currentColor" /> End session
              </button>
            ) : (
              <span>
                <MicOff size={14} /> Ready to start
              </span>
            )}

            <span>
              <Volume2 size={14} />{' '}
              {speechEnabled ? 'ElevenLabs Voice Output: Active' : 'Voice Audio: Muted'}
            </span>
          </div>
        </section>

        {/* Sidebar Information & Outcomes */}
        <aside className="session-side">
          <div className="side-panel">
            <h3>Voice Agent Details</h3>
            <div>
              <small>AGENT NAME</small>
              <strong>{agent?.name || 'Aarogya Clinic Receptionist'}</strong>
            </div>
            <div>
              <small>LANGUAGE CADENCE</small>
              <strong>Hindi + English (Bilingual Hinglish)</strong>
            </div>
            <div>
              <small>ELEVENLABS VOICE</small>
              <strong>{voiceConfig.voiceId === '21m00Tcm4TlvDq8ikWAM' ? 'Riya — Warm & clear' : 'Custom Voice'}</strong>
            </div>
            <div>
              <small>MODEL</small>
              <strong>eleven_multilingual_v2</strong>
            </div>
          </div>

          {/* Real Confirmed Booking Outcome Card */}
          {booking && (
            <div className="result-card">
              <CheckCircle2 size={22} />
              <small>VERIFIED BOOKING OUTCOME</small>
              <h3>{booking.date}</h3>
              <p>
                {booking.time} · {booking.patientName || 'Sachin Sharma'}
              </p>
              <div className="result-doctor-badge">
                <UserCheck size={13} /> {booking.doctorName || 'Dr. Ananya Mehta'}
              </div>
              <Link to="/results">
                View full booking receipt <ArrowLeft size={14} style={{ transform: 'rotate(180deg)' }} />
              </Link>
            </div>
          )}

          <div className="help-card">
            <h3>Member 1 Checklist</h3>
            <ul className="member-checklist">
              <li>
                <CheckCircle2 size={14} className="check-ok" /> ElevenLabs Voice AI Layer
              </li>
              <li>
                <CheckCircle2 size={14} className="check-ok" /> Clinic Receptionist Prompt
              </li>
              <li>
                <CheckCircle2 size={14} className="check-ok" /> Bilingual Hindi-English Audio
              </li>
              <li>
                <CheckCircle2 size={14} className="check-ok" /> Backup Demo Script Ready
              </li>
            </ul>
            <button
              className="text-link-btn"
              onClick={() => setShowScriptModal(true)}
              style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '5px' }}
            >
              Open Backup Script <ExternalLink size={12} />
            </button>
          </div>
        </aside>
      </div>

      {/* ElevenLabs Configuration Drawer / Modal */}
      {showConfig && (
        <div className="modal-backdrop" onClick={() => setShowConfig(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div>
                <span className="eyebrow">ELEVENLABS VOICE SETTINGS</span>
                <h2>Configure Voice AI</h2>
              </div>
              <button className="icon-close-btn" onClick={() => setShowConfig(false)}>
                ✕
              </button>
            </div>

            <div className="modal-body">
              <p className="modal-sub">
                Connect your ElevenLabs API Key for real-time multilingual cloud synthesis, or use the
                high-fidelity built-in speech engine.
              </p>

              <label className="field-group">
                <span>ElevenLabs API Key (Optional)</span>
                <input
                  type="password"
                  placeholder="xi-api-key (e.g. 5f8a...)"
                  value={voiceConfig.apiKey}
                  onChange={(e) => handleSaveVoiceConfig({ apiKey: e.target.value })}
                />
                <small>Stored locally in your browser. Never exposed publicly.</small>
              </label>

              <label className="field-group">
                <span>Selected Voice</span>
                <select
                  value={voiceConfig.voiceId}
                  onChange={(e) => handleSaveVoiceConfig({ voiceId: e.target.value })}
                >
                  {ELEVENLABS_VOICES.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name} ({v.accent})
                    </option>
                  ))}
                </select>
              </label>

              <label className="field-group">
                <span>Model</span>
                <input value="eleven_multilingual_v2" disabled />
                <small>Optimized for accurate Hindi and English phonemes & pronunciation.</small>
              </label>

              <div className="modal-actions-row">
                <button
                  type="button"
                  className="secondary-btn"
                  onClick={testVoiceSample}
                  disabled={isSpeaking}
                >
                  <Volume2 size={16} /> Test Voice Sample
                </button>
                <button
                  type="button"
                  className="primary-btn"
                  onClick={() => setShowConfig(false)}
                >
                  Save & Return
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Backup Demo Script Cheatsheet Modal */}
      {showScriptModal && (
        <div className="modal-backdrop" onClick={() => setShowScriptModal(false)}>
          <div className="modal-card wide" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div>
                <span className="eyebrow">MEMBER 1 · DEMO CHEATSHEET</span>
                <h2>Backup Demo Script Walkthrough</h2>
              </div>
              <button className="icon-close-btn" onClick={() => setShowScriptModal(false)}>
                ✕
              </button>
            </div>

            <div className="modal-body">
              <p className="modal-sub">
                This exact sequence demonstrates the end-to-end journey: greeting in Hindi/English →
                patient inquiry → slot proposal → confirmation & real booking.
              </p>

              <div className="script-table">
                {BACKUP_DEMO_SCRIPT.map((step) => (
                  <div className="script-row" key={step.id}>
                    <div className="script-step-tag">Step {step.id}</div>
                    <div className="script-turn">
                      <div className="script-user">
                        <strong>Caller (You):</strong>
                        <p>{step.userPrompt}</p>
                        <small>{step.userPromptHindi}</small>
                      </div>
                      <div className="script-agent">
                        <strong>Agent (Riya):</strong>
                        <p>{step.agentResponse}</p>
                        <small>{step.agentResponseHindi}</small>
                      </div>
                    </div>
                    <button
                      className="primary-btn small-btn"
                      onClick={() => {
                        setShowScriptModal(false);
                        executeScriptStep(step.id - 1);
                      }}
                    >
                      <Play size={13} /> Run Step
                    </button>
                  </div>
                ))}
              </div>

              <div className="modal-actions-row">
                <button
                  type="button"
                  className="primary-btn"
                  onClick={() => {
                    setShowScriptModal(false);
                    startAutoPlay();
                  }}
                >
                  <Play size={15} /> Auto-Run Entire Demo Now
                </button>
                <button
                  type="button"
                  className="secondary-btn"
                  onClick={() => setShowScriptModal(false)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Agent Instructions & Prompt Modal */}
      {showPromptModal && (
        <div className="modal-backdrop" onClick={() => setShowPromptModal(false)}>
          <div className="modal-card wide" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div>
                <span className="eyebrow">AGENT CONFIGURATION</span>
                <h2>Clinic Receptionist System Instructions</h2>
              </div>
              <button className="icon-close-btn" onClick={() => setShowPromptModal(false)}>
                ✕
              </button>
            </div>

            <div className="modal-body">
              <div className="prompt-viewer">
                <pre>{agent?.instructions || 'Loading system instructions...'}</pre>
              </div>
              <div className="modal-actions-row">
                <button
                  type="button"
                  className="primary-btn"
                  onClick={() => setShowPromptModal(false)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
