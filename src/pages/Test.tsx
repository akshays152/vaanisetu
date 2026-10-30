import {
  ArrowLeft,
  CheckCircle2,
  Mic,
  MicOff,
  Send,
  Square,
  Volume2,
  VolumeX,
  Settings as SettingsIcon,
  UserCheck,
} from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { useEffect, useState, useRef } from 'react';
import { api } from '../services/api';
import { voiceSession } from '../services/voiceSession';
import { elevenLabsService } from '../services/elevenlabs';
import { ELEVENLABS_VOICES } from '../data/clinicReceptionist';
import type { Agent, BookingResult, ChatMessage, VoiceConfig } from '../types';

export function Test() {
  const { id = 'clinic-receptionist' } = useParams();
  const [agent, setAgent] = useState<Agent>();
  const [active, setActive] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [booking, setBooking] = useState<BookingResult | null>(null);
  const [sessionId, setSessionId] = useState<string>();
  const [sessionMode, setSessionMode] = useState<'demo' | 'live'>('demo');
  const [sessionStatus, setSessionStatus] = useState('idle');
  const [sessionError, setSessionError] = useState('');
  const [appointmentDate, setAppointmentDate] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() + 1);
    if (date.getDay() === 0) date.setDate(date.getDate() + 1);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  });
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [selectedSlot, setSelectedSlot] = useState('');
  const [bookingError, setBookingError] = useState('');
  const [bookingSubmitting, setBookingSubmitting] = useState(false);
  const localDate = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

  // Voice AI States
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [speechEnabled, setSpeechEnabled] = useState(true);
  const [voiceConfig, setVoiceConfig] = useState<VoiceConfig>(elevenLabsService.getConfig());
  const [showConfig, setShowConfig] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.getAgent(id).then(setAgent);
  }, [id]);

  useEffect(() => {
    let cancelled = false;
    setSelectedSlot('');
    setBookingError('');
    api.getAvailableSlots(appointmentDate).then((result) => {
      if (!cancelled) {
        setAvailableSlots(result.availableSlots);
        setSelectedSlot(result.availableSlots[0] || '');
      }
    }).catch((error: Error) => {
      if (!cancelled) {
        setAvailableSlots([]);
        setBookingError(error.message);
      }
    });
    return () => { cancelled = true; };
  }, [appointmentDate]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isSpeaking]);

  // Clean up audio on unmount
  useEffect(() => {
    return () => {
      voiceSession.stopAudio();
      voiceSession.stopListening();
      void voiceSession.endLiveSession();
    };
  }, []);

  const startSession = async () => {
    if (active || sessionStatus === 'connecting') return;
    setSessionError('');
    setSessionStatus('connecting');
    try {
      const session = await api.startSession(id);
      setSessionId(session.sessionId);
      voiceSession.resetConversation();
      if (session.mode === 'live') {
        await voiceSession.startLiveSession(session, {
          onStatusChange: (status) => {
            setSessionStatus(status);
            if (status === 'connected') setActive(true);
            if (status === 'disconnected') setActive(false);
          },
          onModeChange: (mode) => {
            setIsSpeaking(mode === 'speaking');
            setIsListening(mode === 'listening');
          },
          onMessage: (message) => setMessages((previous) => [...previous, {
            id: `${message.event_id}-${message.source}`,
            from: message.source === 'ai' ? 'agent' : 'you',
            text: message.message,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          }]),
          onError: (message) => {
            setSessionError(message);
            setSessionStatus('error');
            setActive(false);
          },
        });
        setSessionMode('live');
        setMessages([]);
        return;
      }

      setSessionMode('demo');
      setSessionStatus('connected');
      setActive(true);
      const greeting = agent?.greeting || 'Namaste! Aarogya Clinic mein aapka swagat hai. How can I help you today?';
      setMessages([{ id: crypto.randomUUID(), from: 'agent', text: greeting, timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }]);
      if (speechEnabled) {
        setIsSpeaking(true);
        await voiceSession.speak(greeting, () => setIsSpeaking(false));
      }
    } catch (error) {
      setSessionStatus('error');
      setActive(false);
      setSessionError(error instanceof Error ? error.message : 'Could not start the voice session.');
    }
  };

  const endSession = async () => {
    await voiceSession.endLiveSession();
    voiceSession.stopAudio();
    voiceSession.stopListening();
    setIsListening(false);
    setIsSpeaking(false);
    setActive(false);
    setSessionStatus('disconnected');
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

    if (sessionMode === 'live') {
      try {
        voiceSession.sendLiveMessage(text);
      } catch (error) {
        setSessionError(error instanceof Error ? error.message : 'The live session is unavailable.');
      }
      return;
    }

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
        if (bookingSubmitting || booking) return;
        setBookingSubmitting(true);
        try {
          if (!selectedSlot) throw new Error('Choose an available appointment time first.');
          const saved = await api.bookAppointment({
            patientName: outcome.bookingData.patientName || 'Sachin Sharma',
            doctor: outcome.bookingData.doctorName || 'Dr. Ananya Mehta',
            date: appointmentDate,
            time: selectedSlot,
            sessionId,
          });
          const confirmed = { ...outcome.bookingData, ...saved, date: appointmentDate, time: selectedSlot };
          setBooking(confirmed);
          setBookingError('');
        } catch (error) {
          setBookingError(error instanceof Error ? error.message : 'Could not save the appointment.');
        } finally {
          setBookingSubmitting(false);
        }
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
    if (sessionMode === 'live') return;
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
          <div className="eyebrow">AAROGYA CLINIC · AI RECEPTIONIST</div>
          <h1>How can we help today?</h1>
          <p>
            Speak with our receptionist in Hindi, English, or Hinglish. Ask about clinic services,
            appointments, or available times.
          </p>
        </div>

        <div className="head-right-actions">
          <button
            className="secondary-btn small-btn"
            onClick={() => setShowConfig(!showConfig)}
            title="ElevenLabs Configuration"
          >
            <SettingsIcon size={15} /> Voice Settings
          </button>
          <div className={`connection ${active ? 'connected' : ''}`}>
            <i />
            {active
              ? sessionMode === 'live' ? 'Live ElevenLabs · Connected' : 'Demo session · Browser fallback'
              : sessionStatus === 'connecting' ? 'Connecting…' : 'Ready to connect'}
          </div>
        </div>
      </div>

      {sessionError && <div className="error-banner" role="alert">{sessionError}</div>}

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
              <span className="demo-tag">{sessionMode === 'live' ? 'LIVE VOICE' : 'LOCAL VOICE'}</span>
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
                  Tap the microphone to begin, or type a message below. You can ask about appointments,
                  clinic hours, services, or available times.
                </p>
                <div className="empty-actions">
                  <button className="primary-btn" onClick={startSession}>
                    <Mic size={17} /> Start Voice Session
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
              {sessionMode === 'live' ? 'ElevenLabs session audio' : speechEnabled ? 'Browser speech fallback' : 'Voice audio muted'}
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

          <div className="side-panel">
            <h3>Choose an appointment</h3>
            <label className="field">
              <span>Date</span>
              <input type="date" value={appointmentDate} min={localDate(new Date())} onChange={(event) => setAppointmentDate(event.target.value)} />
            </label>
            <small>Available times</small>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, borderTop: 0 }}>
              {availableSlots.length ? availableSlots.map((slot) => (
                <button key={slot} type="button" className={selectedSlot === slot ? 'primary-btn' : 'secondary-btn'} onClick={() => setSelectedSlot(slot)} style={{ padding: '7px 9px' }}>{slot}</button>
              )) : <span className="muted">No available times for this date.</span>}
            </div>
            {bookingError && <p role="alert" className="booking-error">{bookingError}</p>}
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
              <Link to="/results" state={{ booking }}>
                View full booking receipt <ArrowLeft size={14} style={{ transform: 'rotate(180deg)' }} />
              </Link>
            </div>
          )}

          <div className="help-card">
            <h3>What you can ask</h3>
            <p>Ask about clinic hours, services, doctors, appointment availability, or booking a visit.</p>
            <p className="muted">For urgent symptoms or emergencies, contact qualified clinical staff or local emergency services.</p>
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
                Live ElevenLabs voice requires a backend-authorized session. This browser-only demo uses
                speech synthesis and microphone recognition as a clearly labeled fallback.
              </p>

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

    </div>
  );
}
