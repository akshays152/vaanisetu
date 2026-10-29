import { useEffect, useState } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Home, RotateCcw } from 'lucide-react';
import { api, demoMode } from '../services/api';
import { demoBooking } from '../data/demo';
import type { BookingResult } from '../types';

export function Results() {
  const location = useLocation();
  const passedBooking = (location.state as { booking?: BookingResult } | null)?.booking;
  const [booking, setBooking] = useState<BookingResult | null>(passedBooking || null);
  useEffect(() => {
    if (!passedBooking) api.getBooking().then(setBooking).catch(() => setBooking({ status: 'failed', message: 'The booking result is unavailable. Please return to the test lab and try again.' }));
  }, [passedBooking]);
  const result = booking || (demoMode ? demoBooking : { status: 'pending' as const, message: 'Loading booking result…' });
  const confirmed = result.status === 'confirmed';
  return <div className="page result-page"><Link to="/dashboard" className="back"><ArrowLeft size={16}/> Back to dashboard</Link><div className="result-wrap"><div className="success-icon"><CheckCircle2 size={33}/></div><div className="eyebrow">{confirmed ? 'BOOKING RECEIPT' : 'LATEST BOOKING'}</div><h1>{confirmed ? 'Appointment confirmed.' : 'No appointment yet.'}</h1><p className="result-copy">{result.message}</p>{confirmed && <div className="appointment"><div><small>PATIENT / CUSTOMER</small><strong>{result.patientName}</strong></div><div><small>DATE</small><strong>{result.date}</strong></div><div><small>TIME</small><strong>{result.time}</strong></div><div><small>STATUS</small><strong className="confirmed">● Confirmed</strong></div></div>}<div className="result-actions"><Link className="primary-btn" to="/dashboard"><Home size={16}/> Dashboard</Link><Link className="secondary-btn" to="/test/clinic-receptionist"><RotateCcw size={16}/> Test again</Link></div>{demoMode && <small className="synthetic">Synthetic demonstration data · No real patient information collected</small>}</div></div>;
}
