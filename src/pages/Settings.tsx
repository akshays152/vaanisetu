import { CheckCircle2, RefreshCw, Server, Volume2, XCircle } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { api, demoMode, type HealthStatus } from '../services/api';

export function Settings() {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setHealth(await api.getHealth());
    } catch (cause) {
      setHealth(null);
      setError(cause instanceof Error ? cause.message : 'Could not reach the backend.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);
  const backendReady = Boolean(health?.status === 'ok');
  const liveReady = Boolean(health?.elevenLabs.configured);

  return <div className="page settings-page">
    <div className="eyebrow">SYSTEM STATUS</div>
    <h1>Settings</h1>
    <p className="muted">Check the services this app can currently reach.</p>
    <button className="secondary-btn" onClick={() => void refresh()} disabled={loading}><RefreshCw size={15} /> {loading ? 'Checking…' : 'Refresh status'}</button>
    {error && <div className="error-banner" role="alert">{error}</div>}
    <div className="settings-grid">
      <section className="settings-card">
        <div className="settings-card-header"><Server className="settings-icon" size={20} /><div><h3>VaaniSetu backend</h3><p>Agents, appointment slots, and saved bookings</p></div></div>
        <div className="connection-info-box">
          <div className="info-row"><span>Connection</span><strong>{loading ? 'Checking…' : backendReady ? 'Online' : 'Unavailable'}</strong></div>
          <div className="info-row"><span>App data</span><strong>{demoMode ? 'Browser demo data' : 'Backend database'}</strong></div>
        </div>
        <div className="privacy-badge">{backendReady ? <CheckCircle2 size={16} /> : <XCircle size={16} />}{backendReady ? 'Backend health check succeeded.' : 'Start the backend and refresh to check again.'}</div>
      </section>
      <section className="settings-card">
        <div className="settings-card-header"><Volume2 className="settings-icon" size={20} /><div><h3>Voice provider</h3><p>Live ElevenLabs session availability</p></div></div>
        <div className="connection-info-box">
          <div className="info-row"><span>Live voice</span><strong>{loading ? 'Checking…' : liveReady ? 'Configured' : 'Not configured'}</strong></div>
          <div className="info-row"><span>Browser fallback</span><strong>Depends on this device</strong></div>
        </div>
        <div className="privacy-badge">{liveReady ? <CheckCircle2 size={16} /> : <XCircle size={16} />}{liveReady ? 'The server reports live voice is configured.' : 'Text chat remains available; live voice needs server credentials.'}</div>
      </section>
    </div>
  </div>;
}
