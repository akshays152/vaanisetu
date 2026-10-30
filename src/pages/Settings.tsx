import { CheckCircle2, Volume2 } from 'lucide-react';
import { demoMode } from '../services/api';

export function Settings() {
  return (
    <div className="page settings-page">
      <div className="eyebrow">PREFERENCES</div>
      <h1>Settings</h1>
      <p className="muted">A quick view of the services powering your VaaniSetu experience.</p>
      <div className="settings-grid">
        <section className="settings-card">
          <div className="settings-card-header"><Volume2 className="settings-icon" size={20} /><div><h3>Voice experience</h3><p>Natural, bilingual conversations</p></div></div>
          <div className="connection-info-box"><div className="info-row"><span>Languages</span><strong>Hindi + English</strong></div><div className="info-row"><span>Voice</span><strong>Riya · Warm & clear</strong></div></div>
          <div className="privacy-badge"><CheckCircle2 size={16} /> Voice preferences are saved in this browser.</div>
        </section>
        <section className="settings-card">
          <div className="settings-card-header"><CheckCircle2 className="settings-icon" size={20} /><div><h3>Booking service</h3><p>Appointment availability and confirmation</p></div></div>
          <div className="connection-info-box"><div className="info-row"><span>Experience</span><strong>{demoMode ? 'Sample data' : 'Connected service'}</strong></div><div className="info-row"><span>Booking flow</span><strong>Available</strong></div></div>
          <div className="privacy-badge"><CheckCircle2 size={16} /> {demoMode ? 'Bookings in demo mode use sample data.' : 'Bookings are saved by the VaaniSetu service.'}</div>
        </section>
      </div>
    </div>
  );
}
