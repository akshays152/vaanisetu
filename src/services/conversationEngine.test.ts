import { beforeEach, describe, expect, it } from 'vitest';
import { ClinicConversationEngine } from './conversationEngine';

describe('clinic appointment conversation', () => {
  let engine: ClinicConversationEngine;
  const choice = { date: '2026-11-12', time: '2:30 PM' };

  beforeEach(() => {
    engine = new ClinicConversationEngine();
  });

  it('asks for a real patient name and confirms the selected slot before saving', () => {
    const request = engine.processMessage('I need an appointment with Dr. Mehta', choice);
    expect(request.reply).toContain('patient’s name');

    const name = engine.processMessage('My name is Asha Rao', choice);
    expect(name.reply).toContain('Asha Rao');
    expect(name.reply).toContain('2:30 PM');
    expect(name.action).toBeUndefined();

    const confirmed = engine.processMessage('Yes, please', choice);
    expect(confirmed.action).toBe('book_appointment');
    expect(confirmed.bookingData).toMatchObject({ patientName: 'Asha Rao', date: choice.date, time: choice.time, status: 'pending' });
  });

  it('allows retry after save failure and only locks after the caller marks the booking saved', () => {
    engine.processMessage('Book an appointment with Dr. Mehta', choice);
    engine.processMessage('Test Patient', choice);
    expect(engine.processMessage('yes', choice).action).toBe('book_appointment');
    expect(engine.processMessage('yes', choice).action).toBe('book_appointment');
    engine.markBookingSaved();
    expect(engine.processMessage('yes', choice).action).toBeUndefined();
    expect(engine.processMessage('yes', choice).reply).toContain('already has a completed booking');
  });

  it('does not create bookings for emergencies or cancellations', () => {
    expect(engine.processMessage('I have chest pain', choice).action).toBeUndefined();
    engine.processMessage('Book an appointment', choice);
    engine.processMessage('Asha Rao', choice);
    expect(engine.processMessage('cancel', choice).reply).toContain('No problem');
  });
});
