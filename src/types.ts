export type AgentStatus = 'Active' | 'Draft';
export type Agent = { id:string; name:string; purpose:string; language:string; bilingual:boolean; instructions:string; greeting:string; voice:string; context:string; status:AgentStatus; createdAt:string };
export type BookingResult = { status:'confirmed'|'pending'|'failed'; patientName?:string; date?:string; time?:string; message:string };
