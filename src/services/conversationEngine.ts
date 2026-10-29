import type { BookingResult } from '../types';

export type ConversationState = {
  stage: 'greeting' | 'inquiring' | 'offering_slot' | 'awaiting_confirmation' | 'booked';
  patientName: string;
  doctorName: string;
  proposedDate: string;
  proposedTime: string;
  reason: string;
};

export class ClinicConversationEngine {
  private state: ConversationState;

  constructor() {
    this.state = this.getInitialState();
  }

  public reset(): void {
    this.state = this.getInitialState();
  }

  public getState(): ConversationState {
    return { ...this.state };
  }

  private getInitialState(): ConversationState {
    return {
      stage: 'greeting',
      patientName: 'Sachin Sharma',
      doctorName: 'Dr. Ananya Mehta (General Medicine)',
      proposedDate: 'Tuesday, 12 November 2026',
      proposedTime: '10:30 AM',
      reason: 'General consultation',
    };
  }

  /**
   * Process incoming Hindi or English user message and generate a natural bilingual response
   */
  public processMessage(input: string): {
    reply: string;
    action?: 'book_appointment';
    bookingData?: BookingResult;
  } {
    const raw = input.toLowerCase().trim();

    // Emergency triage detection
    if (
      raw.includes('chest pain') ||
      raw.includes('heart attack') ||
      raw.includes('saas lene me takleef') ||
      raw.includes('khoon') ||
      raw.includes('emergency') ||
      raw.includes('accident')
    ) {
      return {
        reply:
          'Dhyan dein! Agar yeh emergency hai, toh kripya turant 108 helpline par call karein ya paas ke trauma hospital jayein.',
      };
    }

    // 1. Initial Greeting / Inquiry
    if (
      this.state.stage === 'greeting' ||
      raw.includes('hello') ||
      raw.includes('namaste') ||
      raw.includes('pranam') ||
      raw.includes('hi')
    ) {
      if (
        raw.includes('appointment') ||
        raw.includes('doctor') ||
        raw.includes('milna') ||
        raw.includes('checkup') ||
        raw.includes('book')
      ) {
        this.state.stage = 'offering_slot';
        this.detectDoctor(raw);
        this.detectName(raw);
        return {
          reply: `Ji bilkul! ${this.state.doctorName} Tuesday ko available hain. Kya Tuesday morning 10:30 AM ka slot aapke liye theek rahega?`,
        };
      }

      this.state.stage = 'inquiring';
      return {
        reply:
          'Namaste! Aarogya Clinic mein aapka swagat hai. Main aapki kya sahayata kar sakti hoon? Kya aap Dr. Mehta ya Dr. Sharma se appointment lena chahte hain?',
      };
    }

    // 2. Doctor / Reason inquiry or request
    if (
      raw.includes('appointment') ||
      raw.includes('doctor') ||
      raw.includes('mehta') ||
      raw.includes('sharma') ||
      raw.includes('verma') ||
      raw.includes('bimar') ||
      raw.includes('checkup')
    ) {
      this.detectDoctor(raw);
      this.detectName(raw);
      this.state.stage = 'offering_slot';
      return {
        reply: `Ji zaroor. ${this.state.doctorName} ke paas Tuesday ko opening hai. Kya Tuesday morning 10:30 AM slot book kar doon?`,
      };
    }

    // 3. Slot agreement or Name submission
    if (
      this.state.stage === 'offering_slot' ||
      (this.state.stage !== 'awaiting_confirmation' && raw.includes('10:30')) ||
      (this.state.stage !== 'awaiting_confirmation' && (raw.includes('tuesday') ||
      raw.includes('morning') ||
      raw.includes('chalega') ||
      raw.includes('theek hai') ||
      raw.includes('ha') ||
      raw.includes('yes')))
    ) {
      this.detectName(raw);
      this.state.stage = 'awaiting_confirmation';
      const nameGreeting = this.state.patientName ? `${this.state.patientName} ji` : 'Aapke';
      return {
        reply: `Shukriya! ${nameGreeting} ke naam se Dr. Mehta ke sath Tuesday 10:30 AM ka appointment lock kar diya jaye? Please confirm karein.`,
      };
    }

    // 4. Final Confirmation
    if (
      this.state.stage === 'awaiting_confirmation' ||
      raw.includes('confirm') ||
      raw.includes('kardo') ||
      raw.includes('haan') ||
      raw.includes('yes') ||
      raw.includes('kar dijiye') ||
      raw.includes('sure') ||
      raw.includes('okay')
    ) {
      this.state.stage = 'booked';
      const bookingData: BookingResult = {
        status: 'confirmed',
        patientName: this.state.patientName || 'Sachin Sharma',
        doctorName: this.state.doctorName,
        date: this.state.proposedDate,
        time: this.state.proposedTime,
        message: `Appointment confirmed with ${this.state.doctorName} on ${this.state.proposedDate} at ${this.state.proposedTime}. Aarogya Clinic, Green Park.`,
        appointmentId: `AAR-${Math.floor(1000 + Math.random() * 9000)}`,
      };

      return {
        reply: `Badhiya! Aapka appointment ${this.state.proposedDate} ko 10:30 AM Dr. Mehta ke sath confirm ho gaya hai. SMS confirmation bhej diya gaya hai!`,
        action: 'book_appointment',
        bookingData,
      };
    }

    // Default polite bilingual fallback
    return {
      reply:
        'Main samajh gayi. Kya aap Aarogya Clinic mein Dr. Mehta ke sath appointment book karna chahte hain, ya timings janna chahte hain?',
    };
  }

  private detectDoctor(text: string): void {
    if (text.includes('sharma') || text.includes('ortho') || text.includes('haddi')) {
      this.state.doctorName = 'Dr. Rajesh Sharma (Orthopedics)';
    } else if (text.includes('verma') || text.includes('bacche') || text.includes('pediatric')) {
      this.state.doctorName = 'Dr. Priya Verma (Pediatrics)';
    } else {
      this.state.doctorName = 'Dr. Ananya Mehta (General Medicine)';
    }
  }

  private detectName(text: string): void {
    const nameMatch = text.match(/(?:naam|name is|i am|mera naam|patient)\s+([a-zA-Z]+(?:\s+[a-zA-Z]+)?)/i);
    if (nameMatch && nameMatch[1]) {
      this.state.patientName = nameMatch[1].trim();
    }
  }
}

export const clinicConversationEngine = new ClinicConversationEngine();
