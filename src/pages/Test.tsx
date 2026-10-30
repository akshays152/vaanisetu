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
  Radio,
  UserCheck,
} from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { useEffect, useState, useRef } from 'react';
import { ApiError, api, getClinicDate } from '../services/api';
import { voiceSession } from '../services/voiceSession';
import { elevenLabsService } from '../services/elevenlabs';
import type { Agent, BookingResult, ChatMessage, TestSession } from '../types';

function nextOpenClinicDate(): string {
  let offset = 1;
  while (true) {
    const value = getClinicDate(offset);
    const [year, month, day] = value.split('-').map(Number);
    if (new Date(year, month - 1, day, 12).getDay() !== 0) return value;
    offset += 1;
  }
}

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
  const [sessionNotice, setSessionNotice] = useState('');
  const [appointmentDate, setAppointmentDate] = useState(nextOpenClinicDate);
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(true);
  const [slotsRetry, setSlotsRetry] = useState(0);
  const [selectedSlot, setSelectedSlot] = useState('');
  const [bookingError, setBookingError] = useState('');
  const [bookingSubmitting, setBookingSubmitting] = useState(false);

  // Voice AI States
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [speechEnabled, setSpeechEnabled] = useState(() => elevenLabsService.getConfig().speechEnabled);
  const [systemVoices, setSystemVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [systemVoiceName, setSystemVoiceName] = useState(() => {
    try { return localStorage.getItem('vaanisetu.browser.voice') || ''; } catch { return ''; }
  });
  const [showConfig, setShowConfig] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const bookingInFlight = useRef(false);

  useEffect(() => {
    if (!('speechSynthesis' in window)) return;
    const updateVoices = () => setSystemVoices(window.speechSynthesis.getVoices());
    updateVoices();
    window.speechSynthesis.addEventListener('voiceschanged', updateVoices);
    return () => window.speechSynthesis.removeEventListener('voiceschanged', updateVoices);
  }, []);

  useEffect(() => {
    api.getAgent(id).then(setAgent);
  }, [id]);

  useEffect(() => {
    let cancelled = false;
    setSelectedSlot('');
    setAvailableSlots([]);
    setBookingError('');
    setSlotsLoading(true);
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
    }).finally(() => { if (!cancelled) setSlotsLoading(false); });
    return () => { cancelled = true; };
  }, [appointmentDate, slotsRetry]);

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
    setSessionNotice('');
    setSessionStatus('connecting');
    try {
      let session: TestSession;
      try {
        session = await api.startSession(id);
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) throw error;
        session = { sessionId: `browser-${crypto.randomUUID()}`, mode: 'demo' as const };
        setSessionNotice('Live voice is unavailable. Text and browser speech fallback are active; appointment saving still requires the backend.');
      }
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
        await voiceSession.speak(greeting, () => setIsSpeaking(false), systemVoiceName);
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
    const outcome = voiceSession.processMessage(text, selectedSlot ? { date: appointmentDate, time: selectedSlot } : undefined);

    const agentMsg: ChatMessage = {
      id: crypto.randomUUID(),
      from: 'agent',
      text: outcome.reply,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    await new Promise((resolve) => window.setTimeout(resolve, 250));

    if (outcome.action === 'book_appointment' && outcome.bookingData) {
      if (bookingInFlight.current || booking) return;
      bookingInFlight.current = true;
      setBookingSubmitting(true);
      setBookingError('');
      setMessages((previous) => [...previous, {
        ...agentMsg,
        text: 'Saving your appointment…',
      }]);
      try {
        const patientName = outcome.bookingData.patientName?.trim();
        if (!patientName) throw new Error('The patient name is missing. Please restart the conversation and provide it.');
        const saved = await api.bookAppointment({
          patientName,
          doctor: outcome.bookingData.doctorName || 'Dr. Ananya Mehta',
          date: outcome.bookingData.date || appointmentDate,
          time: outcome.bookingData.time || selectedSlot,
          sessionId,
        });
        const confirmed = { ...outcome.bookingData, ...saved };
        setBooking(confirmed);
        setBookingError('');
        voiceSession.markBookingSaved();
        setMessages((previous) => [...previous, {
          id: crypto.randomUUID(),
          from: 'agent',
          text: saved.status === 'confirmed' ? saved.message : `The appointment was not confirmed: ${saved.message}`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        }]);
        if (speechEnabled) {
          setIsSpeaking(true);
          await voiceSession.speak(saved.message, () => setIsSpeaking(false), systemVoiceName);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Could not save the appointment.';
        setBookingError(message);
        setMessages((previous) => [...previous, {
          id: crypto.randomUUID(),
          from: 'agent',
          text: `I couldn’t save the appointment. ${message} Please try confirming again.`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        }]);
      } finally {
        bookingInFlight.current = false;
        setBookingSubmitting(false);
      }
      return;
    }

    setMessages((previous) => [...previous, agentMsg]);
    if (speechEnabled) {
      setIsSpeaking(true);
      await voiceSession.speak(outcome.reply, () => setIsSpeaking(false), systemVoiceName);
    }
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
          setSessionError(err);
        }
      );

      if (!ok) {
        setIsListening(false);
      }
    }
  };

  const testVoiceSample = async () => {
    setIsSpeaking(true);
    await elevenLabsService.speak(
      'Namaste! Aarogya Clinic mein aapka swagat hai. How can I help you today?',
      {
        voiceName: systemVoiceName,
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
            <Radio size={13} className="pulse-icon" /> VOICE ASSISTANT
          </div>
          <h1>Have a conversation.</h1>
          <p>
            Speak naturally with <strong>{agent?.name || 'Aarogya Clinic Receptionist'}</strong> in Hindi and English.
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
              ? sessionMode === 'live' ? 'Live ElevenLabs · Connected' : speechEnabled && 'speechSynthesis' in window ? 'Demo session · Browser speech' : 'Demo session · Text only'
              : sessionStatus === 'connecting' ? 'Connecting…' : 'Ready to connect'}
          </div>
        </div>
      </div>

      {sessionError && <div className="error-banner" role="alert">{sessionError}</div>}
      {sessionNotice && <div className="info-banner" role="status">{sessionNotice}</div>}

      <div className="test-layout">
        {/* Main Conversation Stream */}
        <section className="conversation">
          <div className="conversation-head">
            <div className="agent-title-cluster">
              <span className="avatar small">{agent?.name.slice(0, 1) || 'A'}</span>
              <div>
                <b>{agent?.name || 'Aarogya Clinic Receptionist'}</b>
                <span className="voice-tag"><Volume2 size={11} /> {sessionMode === 'live' ? 'ElevenLabs live voice' : systemVoiceName || 'System voice (browser)'}</span>
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
                {sessionMode === 'live' ? 'ELEVENLABS LIVE' : speechEnabled && 'speechSynthesis' in window ? 'BROWSER SPEECH FALLBACK' : 'TEXT DEMO'}
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
                  Talk with the receptionist using your microphone or by typing a message. You can switch between Hindi and English.
                </p>
                <div className="empty-actions">
                  <button className="primary-btn" onClick={startSession}>
                    <Mic size={17} /> Start conversation
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
                  <button onClick={() => handleSendMessage('My name is Demo Patient')}>
                    👤 "My name is Demo Patient"
                  </button>
                  <button onClick={() => handleSendMessage('Yes, please')}>
                    ✅ "Yes, please"
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
                onClick={() => {
                  const updated = elevenLabsService.saveConfig({ speechEnabled: !speechEnabled });
                  setSpeechEnabled(updated.speechEnabled);
                }}
                title={speechEnabled ? 'Mute voice audio' : 'Unmute voice audio'}
              >
                {speechEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
              </button>

              <button type="button" disabled={bookingSubmitting || Boolean(booking)} onClick={() => handleSendMessage()}>
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
              {sessionMode === 'live' ? 'ElevenLabs session audio' : speechEnabled && 'speechSynthesis' in window ? 'Browser speech fallback' : 'Text only'}
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
              <strong>{sessionMode === 'live' ? 'ElevenLabs live voice' : systemVoiceName || 'System default voice'}</strong>
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
              <input type="date" value={appointmentDate} min={getClinicDate()} onChange={(event) => setAppointmentDate(event.target.value)} />
            </label>
            <small>Available times</small>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, borderTop: 0 }}>
              {slotsLoading ? <span className="muted">Checking available times…</span> : availableSlots.length ? availableSlots.map((slot) => (
              <button key={slot} type="button" disabled={bookingSubmitting || Boolean(booking)} className={selectedSlot === slot ? 'primary-btn' : 'secondary-btn'} onClick={() => setSelectedSlot(slot)} style={{ padding: '7px 9px' }}>{slot}</button>
              )) : <span className="muted">No available times for this date.</span>}
            </div>
            {bookingError && <p role="alert" className="booking-error">{bookingError}</p>}
            {!slotsLoading && !availableSlots.length && <button type="button" className="secondary-btn small-btn" onClick={() => setSlotsRetry((attempt) => attempt + 1)}>Retry availability</button>}
          </div>

          {/* Real Confirmed Booking Outcome Card */}
          {booking && (
            <div className="result-card">
              <CheckCircle2 size={22} />
              <small>VERIFIED BOOKING OUTCOME</small>
              <h3>{booking.date}</h3>
              <p>
                {booking.time} · {booking.patientName || 'Patient'}
              </p>
              <div className="result-doctor-badge">
                <UserCheck size={13} /> {booking.doctorName || 'Clinic doctor'}
              </div>
              <Link to="/results" state={{ booking }}>
                View full booking receipt <ArrowLeft size={14} style={{ transform: 'rotate(180deg)' }} />
              </Link>
            </div>
          )}

        </aside>
      </div>

      {/* ElevenLabs Configuration Drawer / Modal */}
      {showConfig && (
        <div className="modal-backdrop" onClick={() => setShowConfig(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div>
                <span className="eyebrow">VOICE OUTPUT</span>
                <h2>Browser voice settings</h2>
              </div>
              <button className="icon-close-btn" onClick={() => setShowConfig(false)}>
                ✕
              </button>
            </div>

            <div className="modal-body">
              <p className="modal-sub">Choose a voice installed on this device for browser speech. Live ElevenLabs sessions use the voice configured on the server agent.</p>

              <label className="field-group">
                <span>Installed system voice</span>
                <select
                  value={systemVoiceName}
                  onChange={(event) => {
                    setSystemVoiceName(event.target.value);
                    try {
                      if (event.target.value) localStorage.setItem('vaanisetu.browser.voice', event.target.value);
                      else localStorage.removeItem('vaanisetu.browser.voice');
                    } catch { /* Keep the choice for this page if storage is unavailable. */ }
                  }}
                >
                  <option value="">Automatic (Hindi / Indian English when available)</option>
                  {systemVoices.map((voice) => <option key={`${voice.name}-${voice.lang}`} value={voice.name}>{voice.name} ({voice.lang})</option>)}
                </select>
                {!systemVoices.length && <small>This browser has not exposed installed speech voices. The text conversation remains available.</small>}
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
