import type { Agent, BookingResult, TestSession } from '../types';
import { demoAgent } from '../data/demo';

export type BookingInput = { patientName: string; date: string; time: string; doctor: string; sessionId?: string };
export type AvailableSlots = { date: string; availableSlots: string[] };
export type HealthStatus = { status: string; service: string; elevenLabs: { configured: boolean; agentConfigured: boolean } };

const base = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
export const demoMode = import.meta.env.VITE_DEMO_MODE !== 'false';

export class ApiError extends Error {
  constructor(message: string, public status?: number) {
    super(message);
    this.name = 'ApiError';
  }
}

const agentStorageKey = 'vaanisetu.demo.agents';
const bookingStorageKey = 'vaanisetu.demo.booking';

export function getClinicDate(daysFromToday = 0): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const clinicDate = new Date(Number(values.year), Number(values.month) - 1, Number(values.day) + daysFromToday, 12);
  return `${clinicDate.getFullYear()}-${String(clinicDate.getMonth() + 1).padStart(2, '0')}-${String(clinicDate.getDate()).padStart(2, '0')}`;
}

function readDemoAgents(): Agent[] {
  try {
    const value = localStorage.getItem(agentStorageKey);
    const parsed: unknown = value ? JSON.parse(value) : null;
    return Array.isArray(parsed) ? parsed as Agent[] : [demoAgent];
  } catch {
    return [demoAgent];
  }
}

function readDemoBookings(): BookingResult[] {
  try {
    const value = localStorage.getItem(bookingStorageKey);
    if (!value) return [];
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed as BookingResult[] : [parsed as BookingResult];
  } catch {
    return [];
  }
}

function readDemoBooking(): BookingResult | null {
  const bookings = readDemoBookings();
  return bookings[bookings.length - 1] || null;
}

function requestError(body: unknown, status: number): string {
  if (body && typeof body === 'object') {
    const value = body as { message?: unknown; detail?: unknown };
    if (typeof value.message === 'string') return value.message;
    if (typeof value.detail === 'string') return value.detail;
    if (Array.isArray(value.detail) && value.detail[0] && typeof value.detail[0].msg === 'string') return value.detail[0].msg;
  }
  return `Request failed (${status})`;
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${base}${path}`, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...(options?.headers || {}) },
    });
  } catch {
    throw new ApiError('The backend is unavailable. Check VITE_API_BASE_URL or turn demo mode on.');
  }

  let body: unknown;
  try { body = await response.json(); } catch { body = null; }
  if (!response.ok) throw new ApiError(requestError(body, response.status), response.status);
  return body as T;
}

function saveDemoAgents(agents: Agent[]): void {
  try { localStorage.setItem(agentStorageKey, JSON.stringify(agents)); }
  catch { throw new ApiError('This browser could not save agent data. Check browser storage settings.'); }
}

function saveDemoBookings(bookings: BookingResult[]): void {
  try { localStorage.setItem(bookingStorageKey, JSON.stringify(bookings)); }
  catch { throw new ApiError('This browser could not save the booking. Check browser storage settings.'); }
}

export const api = {
  getHealth: (): Promise<HealthStatus> => request<HealthStatus>('/health'),

  listAgents: (): Promise<Agent[]> => demoMode ? Promise.resolve(readDemoAgents()) : request<Agent[]>('/agents'),

  getAgent: async (id: string): Promise<Agent> => {
    if (!demoMode) return request<Agent>(`/agents/${encodeURIComponent(id)}`);
    const agent = readDemoAgents().find((item) => item.id === id);
    if (!agent) throw new ApiError('Agent not found.', 404);
    return agent;
  },

  createAgent: async (payload: Partial<Agent>): Promise<Agent> => {
    if (!demoMode) return request<Agent>('/agents', { method: 'POST', body: JSON.stringify(payload) });
    const agent: Agent = { ...demoAgent, ...payload, id: crypto.randomUUID(), status: 'Active', createdAt: 'Just now' };
    saveDemoAgents([...readDemoAgents(), agent]);
    return agent;
  },

  updateAgent: async (id: string, payload: Partial<Agent>): Promise<Agent> => {
    if (!demoMode) return request<Agent>(`/agents/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(payload) });
    const agents = readDemoAgents();
    if (!agents.some((agent) => agent.id === id)) throw new ApiError('Agent not found.', 404);
    const updated: Agent = { ...agents.find((agent) => agent.id === id)!, ...payload, id };
    saveDemoAgents(agents.map((agent) => agent.id === id ? updated : agent));
    return updated;
  },

  startSession: (id: string): Promise<TestSession> => demoMode
    ? Promise.resolve({ sessionId: `demo-${id}`, mode: 'demo' })
    : request<TestSession>(`/agents/${encodeURIComponent(id)}/sessions`, { method: 'POST' }),

  getBooking: (): Promise<BookingResult | null> => demoMode
    ? Promise.resolve(readDemoBooking())
    : request<BookingResult>('/appointments/latest').then((booking) => booking.status === 'pending' && !booking.date ? null : booking),

  getAvailableSlots: async (date: string): Promise<AvailableSlots> => {
    if (!demoMode) return request<AvailableSlots>(`/appointments/slots?date=${encodeURIComponent(date)}`);
    const bookings = readDemoBookings();
    const availableSlots = ['10:00 AM', '10:30 AM', '11:00 AM', '11:30 AM', '2:00 PM', '2:30 PM'];
    const [year, month, day] = date.split('-').map(Number);
    const parsedDate = new Date(year, month - 1, day, 12);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(parsedDate.getTime()) || parsedDate.getFullYear() !== year || parsedDate.getMonth() !== month - 1 || parsedDate.getDate() !== day || parsedDate.getDay() === 0) return { date, availableSlots: [] };
    const today = getClinicDate();
    if (date < today) return { date, availableSlots: [] };
    const isToday = date === today;
    const booked = new Set(bookings.filter((booking) => booking.status === 'confirmed' && booking.date === date).map((booking) => booking.time));
    const timeParts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date());
    const timeValues = Object.fromEntries(timeParts.map((part) => [part.type, part.value]));
    const nowMinutes = Number(timeValues.hour) * 60 + Number(timeValues.minute);
    return { date, availableSlots: availableSlots.filter((slot) => {
      const [clock, period] = slot.split(' ');
      const [hourValue, minuteValue] = clock.split(':').map(Number);
      const hour = hourValue % 12 + (period === 'PM' ? 12 : 0);
      const minutes = hour * 60 + minuteValue;
      return !booked.has(slot) && (!isToday || minutes > nowMinutes);
    }) };
  },

  bookAppointment: async (payload: BookingInput): Promise<BookingResult> => {
    if (!demoMode) {
      const result = await request<BookingResult & { id?: string; doctor?: string }>('/appointments', {
        method: 'POST',
        body: JSON.stringify({ patientName: payload.patientName, date: payload.date, time: payload.time, doctor: payload.doctor, sessionId: payload.sessionId }),
      });
      return { ...result, doctorName: result.doctorName || result.doctor, appointmentId: result.id };
    }
    const existingBookings = readDemoBookings();
    if (existingBookings.some((booking) => booking.status === 'confirmed' && booking.date === payload.date && booking.time === payload.time)) {
      throw new ApiError('That appointment slot is already booked. Choose another time.', 409);
    }
    const available = await api.getAvailableSlots(payload.date);
    if (!available.availableSlots.includes(payload.time)) throw new ApiError('That appointment time is unavailable. Choose another time.', 400);
    const booking: BookingResult = { ...payload, status: 'confirmed', doctorName: payload.doctor, message: 'Appointment booked and saved.' };
    saveDemoBookings([...existingBookings, booking]);
    return booking;
  },
};
