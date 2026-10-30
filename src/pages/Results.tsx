import { useEffect, useState } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Home, RotateCcw } from 'lucide-react';
import { api, demoMode } from '../services/api';
import type { BookingResult } from '../types';

export function Results() {
  const location = useLocation();
  const passedBooking = (location.state as { booking?: BookingResult } | null)?.booking;
  const [booking, setBooking] = useState<BookingResult | null>(passedBooking || null);
  const [loading, setLoading] = useState(!passedBooking);
  const [error, setError] = useState('');

  const loadBooking = () => {
    setLoading(true);
    setError('');
    api.getBooking()
      .then(setBooking)
      .catch(() => setError('We couldn’t load the latest booking. Please try again.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!passedBooking) loadBooking();
  }, [passedBooking]);

  if (loading) return <div className="page result-page"><div className="empty-state">Loading your booking…</div></div>;

  if (error) return (
    <div className="page result-page">
      <Link to="/dashboard" className="back"><ArrowLeft size={16} /> Back to dashboard</Link>
      <div className="result-wrap">
        <div className="eyebrow">BOOKING</div>
        <h1>We couldn’t load the receipt.</h1>
        <p className="result-copy">{error}</p>
        <div className="result-actions">
          <button className="primary-btn" onClick={loadBooking}>Try again</button>
          <Link className="secondary-btn" to="/dashboard"><Home size={16} /> Dashboard</Link>
        </div>
      </div>
    </div>
  );

  if (!booking) return (
    <div className="page result-page">
      <Link to="/dashboard" className="back"><ArrowLeft size={16} /> Back to dashboard</Link>
      <div className="result-wrap">
        <div className="success-icon"><CheckCircle2 size={33} /></div>
        <div className="eyebrow">BOOKING</div>
        <h1>No appointment yet.</h1>
        <p className="result-copy">Start a conversation with your receptionist to make an appointment.</p>
        <div className="result-actions">
          <Link className="primary-btn" to="/test/clinic-receptionist"><RotateCcw size={16} /> Start a conversation</Link>
          <Link className="secondary-btn" to="/dashboard"><Home size={16} /> Dashboard</Link>
        </div>
      </div>
    </div>
  );

  const confirmed = booking.status === 'confirmed';
  return (
    <div className="page result-page">
      <Link to="/dashboard" className="back"><ArrowLeft size={16} /> Back to dashboard</Link>
      <div className="result-wrap">
        <div className="success-icon"><CheckCircle2 size={33} /></div>
        <div className="eyebrow">{confirmed ? 'BOOKING RECEIPT' : 'BOOKING UPDATE'}</div>
        <h1>{confirmed ? 'Appointment confirmed.' : 'Appointment update'}</h1>
        <p className="result-copy">{booking.message}</p>
        <div className="appointment">
          <div><small>PATIENT / CUSTOMER</small><strong>{booking.patientName || '—'}</strong></div>
          <div><small>DATE</small><strong>{booking.date || '—'}</strong></div>
          <div><small>TIME</small><strong>{booking.time || '—'}</strong></div>
          <div><small>STATUS</small><strong className={confirmed ? 'confirmed' : ''}>{booking.status}</strong></div>
        </div>
        <div className="result-actions">
          <Link className="primary-btn" to="/dashboard"><Home size={16} /> Dashboard</Link>
          <Link className="secondary-btn" to="/test/clinic-receptionist"><RotateCcw size={16} /> Test again</Link>
        </div>
        <small className="synthetic">{demoMode ? 'Sample booking for demonstration.' : 'Appointment details are shown here for confirmation.'}</small>
      </div>
    </div>
  );
}
