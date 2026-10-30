import type { BookingResult } from '../types';

export type ConversationState = {
  stage: 'greeting' | 'inquiring' | 'collecting_name' | 'awaiting_confirmation' | 'booked';
  patientName: string;
  doctorName: string;
  proposedDate: string;
  proposedTime: string;
};

export type AppointmentChoice = { date: string; time: string };

const affirmative = /^(?:(?:yes|yeah|yep|sure|okay|ok)(?:\s+please)?|haan|ha|हाँ|जी हाँ|confirm|please do|go ahead|kar dijiye|कर दीजिए)[.!\s]*$/iu;
const negative = /^(no|nope|cancel|नहीं|नही|cancel it)[.!\s]*$/iu;
const namePattern = /(?:my name is|name is|patient name is|i am|i'm|mera naam|मेरा नाम|नाम है)\s+([\p{L}]+(?:\s+[\p{L}]+){0,2})/iu;

function formatDate(value: string): string {
  const parsed = new Date(`${value}T12:00:00`);
  return Number.isNaN(parsed.getTime())
    ? value
    : parsed.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

export class ClinicConversationEngine {
  private state: ConversationState = this.initialState();

  private initialState(): ConversationState {
    return { stage: 'greeting', patientName: '', doctorName: 'Dr. Ananya Mehta', proposedDate: '', proposedTime: '' };
  }

  public reset(): void {
    this.state = this.initialState();
  }

  public markBookingSaved(): void {
    this.state.stage = 'booked';
  }

  public getState(): ConversationState {
    return { ...this.state };
  }

  public processMessage(input: string, choice?: AppointmentChoice): {
    reply: string;
    action?: 'book_appointment';
    bookingData?: BookingResult;
  } {
    const raw = input.trim();
    const text = raw.toLocaleLowerCase().replace(/[,]/g, ' ').replace(/\s+/g, ' ').trim();

    if (/chest pain|heart attack|saas lene me takleef|breathing problem|emergency|accident|छाती में दर्द|सांस लेने में तकलीफ/iu.test(text)) {
      return { reply: 'If this may be an emergency, please call your local emergency number now or go to the nearest emergency department.' };
    }

    if (this.state.stage === 'booked') {
      return { reply: 'This conversation already has a completed booking. Start a new conversation to make another appointment.' };
    }

    if (this.state.stage === 'greeting' && !this.isAppointmentRequest(text)) {
      this.state.stage = 'inquiring';
      return { reply: 'Namaste! Welcome to Aarogya Clinic. How can I help you today? I can help arrange an appointment.' };
    }

    if (this.state.stage === 'inquiring' && !this.isAppointmentRequest(text)) {
      return { reply: 'I can help arrange an appointment. Which doctor would you like to see?' };
    }

    if (this.isAppointmentRequest(text)) this.detectDoctor(text);

    if (this.state.stage === 'collecting_name') {
      const name = this.extractName(raw) || raw.replace(/^(my name is|name is|patient name is|i am|i'm|mera naam|मेरा नाम)\s*/iu, '').trim();
      if (!name || this.isAppointmentRequest(text)) {
        return { reply: 'Please tell me the patient’s name so I can prepare the appointment.' };
      }
      this.state.patientName = name;
      return this.confirmationPrompt(choice);
    }

    if (this.state.stage === 'awaiting_confirmation') {
      if (negative.test(text)) {
        this.state.stage = 'inquiring';
        return { reply: 'No problem. Choose another available time, then tell me when you’re ready.' };
      }
      if (choice && (choice.date !== this.state.proposedDate || choice.time !== this.state.proposedTime)) {
        return this.confirmationPrompt(choice);
      }
      if (!affirmative.test(text)) {
        const name = this.extractName(raw);
        if (name) this.state.patientName = name;
        return this.confirmationPrompt(choice);
      }
      if (!this.state.patientName) {
        this.state.stage = 'collecting_name';
        return { reply: 'Before I can book, what is the patient’s name?' };
      }
      if (!this.state.proposedDate || !this.state.proposedTime) {
        return { reply: 'Please choose an available date and time from the appointment panel first.' };
      }

      const bookingData: BookingResult = {
        status: 'pending',
        patientName: this.state.patientName,
        doctorName: this.state.doctorName,
        date: this.state.proposedDate,
        time: this.state.proposedTime,
        message: 'Saving your appointment now.',
      };
      return { reply: 'Thank you. I’m saving that appointment now.', action: 'book_appointment', bookingData };
    }

    if (this.isAppointmentRequest(text)) {
      this.state.patientName = this.extractName(raw) || '';
      return this.state.patientName ? this.confirmationPrompt(choice) : this.askForName(choice);
    }

    return { reply: 'I can help arrange an appointment. Which doctor would you like to see?' };
  }

  private askForName(choice?: AppointmentChoice) {
    if (!choice?.date || !choice.time) {
      return { reply: 'Please choose an available appointment date and time, then tell me the patient’s name.' };
    }
    this.state.proposedDate = choice.date;
    this.state.proposedTime = choice.time;
    this.state.stage = 'collecting_name';
    return { reply: `I can check ${this.state.doctorName} for ${formatDate(choice.date)} at ${choice.time}. What is the patient’s name?` };
  }

  private confirmationPrompt(choice?: AppointmentChoice) {
    if (choice?.date && choice.time) {
      this.state.proposedDate = choice.date;
      this.state.proposedTime = choice.time;
    }
    if (!this.state.proposedDate || !this.state.proposedTime) {
      this.state.stage = 'collecting_name';
      return { reply: 'Please choose an available appointment date and time from the panel first.' };
    }
    this.state.stage = 'awaiting_confirmation';
    return { reply: `Please confirm: ${this.state.patientName}, ${this.state.doctorName}, ${formatDate(this.state.proposedDate)} at ${this.state.proposedTime}. Should I book it?` };
  }

  private isAppointmentRequest(text: string): boolean {
    return /appointment|doctor|mehta|sharma|verma|check.?up|book|visit|see someone|अपॉइंटमेंट|डॉक्टर|मुलाकात/iu.test(text);
  }

  private detectDoctor(text: string): void {
    if (/sharma|orthop|haddi|शर्मा/iu.test(text)) this.state.doctorName = 'Dr. Rajesh Sharma (Orthopedics)';
    else if (/verma|pediatric|bacche|बच्चे|वर्मा/iu.test(text)) this.state.doctorName = 'Dr. Priya Verma (Pediatrics)';
    else if (/mehta|general|मेहता/iu.test(text)) this.state.doctorName = 'Dr. Ananya Mehta (General Medicine)';
  }

  private extractName(text: string): string {
    return text.match(namePattern)?.[1]?.trim() || '';
  }
}

export const clinicConversationEngine = new ClinicConversationEngine();
