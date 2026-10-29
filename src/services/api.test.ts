import { beforeEach, describe, expect, it } from 'vitest';

const storage = new Map<string, string>();
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
  },
});

const { api, demoMode } = await import('./api');

describe('demo API boundary', () => {
  beforeEach(() => storage.clear());

  it('persists created agents in demo mode', async () => {
    expect(demoMode).toBe(true);
    const created = await api.createAgent({ name: 'Test agent' });
    const agents = await api.listAgents();
    expect(agents.some((agent) => agent.id === created.id && agent.name === 'Test agent')).toBe(true);
  });

  it('returns an explicitly confirmed synthetic booking only in demo mode', async () => {
    const result = await api.bookAppointment({
      patientName: 'Demo Patient',
      date: '2026-11-03',
      time: '10:30 AM',
      doctor: 'Dr. Ananya Mehta',
    });
    expect(result.status).toBe('confirmed');
    expect(result.message).toContain('booked');
  });
});
