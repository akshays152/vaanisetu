# VaaniSetu Frontend

VaaniSetu is a polished React/Vite frontend for the “Voice AI for Everyone” hackathon experience. It demonstrates the complete path: configure an agent → test the conversation → view an appointment outcome.

## Features

- Responsive landing page with VaaniSetu branding and ElevenLabs positioning.
- Dashboard with agent cards, status, language, voice, and actions.
- Functional agent builder with validation-friendly required fields, bilingual mode, voice selection, character limits, live preview, and edit support.
- Test lab with explicit `TEXT DEMO` and `Demo mode` labels; no fake microphone or live voice claims.
- Synthetic appointment confirmation result.
- Centralized API service boundary ready for the backend team.

## Member 1 — Voice AI & ElevenLabs Integration

Member 1 handles the Voice AI, ElevenLabs integration, receptionist persona, and backup conversation testing:

- **ElevenLabs Voice AI Service (`src/services/elevenlabs.ts`, `src/services/voiceSession.ts`)**:
  - Implements ElevenLabs Multilingual speech synthesis using model `eleven_multilingual_v2`.
  - Supports speech recognition (STT) via Web Speech API (`hi-IN` and `en-IN`) for live microphone conversations.
  - Curated Indian voices: `Riya` (Warm & clear Hindi/English receptionist, ID: `21m00Tcm4TlvDq8ikWAM`), `Arjun` (Calm & assured, ID: `pNInz6obpgDQGcFmaJgB`), and `Aditi` (Friendly & bright, ID: `EXAVITQu4vr4xnSDxMaL`).
  - High-fidelity native speech fallback when an API key is not yet set, guaranteeing the voice always speaks during demos.

- **Clinic Receptionist Agent Setup & Instructions (`src/data/clinicReceptionist.ts`)**:
  - Complete system instructions for **"Aarogya Clinic Receptionist"** (आरोग्य क्लिनिक रिसेप्शनिस्ट).
  - Clinic context: Aarogya Clinic, Green Park, New Delhi; open Mon-Sat 9AM-7PM; consultation fee ₹500.
  - Doctor schedule: Dr. Ananya Mehta (General Medicine), Dr. Rajesh Sharma (Orthopedics), Dr. Priya Verma (Pediatrics).
  - Medical safety policy: Immediate emergency escalation (Call 108) if severe chest pain or acute trauma is reported.
  - Voice-optimized constraints: Keeps responses concise (1–2 sentences) for crisp audio turn-taking.

- **Bilingual Hindi-English Conversation Engine (`src/services/conversationEngine.ts`)**:
  - Understands natural Hindi, English, and Hinglish queries (*"Mujhe Dr. Mehta se appointment chahiye"*, *"Tuesday 10:30 AM slot chalega"*, *"Aapka appointment confirm kar diya gaya hai"*).
  - Handles slot offering, extracts patient name, and triggers the appointment booking action.

- **Backup Demo Script & Testing (`src/pages/Test.tsx`)**:
  - Step-by-step interactive backup demo script with 1-click step buttons (Step 01 Greeting to Step 04 Confirmation).
  - **Auto-Play Complete Demo** button: plays the verified conversation end-to-end with voice synthesis for a fail-safe hackathon presentation.
  - Script Cheatsheet and System Instructions modals for easy reference.

## Stack and setup

React, TypeScript, Vite, React Router, Lucide React, and plain CSS. Node.js 18+ is recommended.

```bash
npm install
Copy-Item .env.example .env
npm run dev
```

For a production build:

```bash
npm run build
npm run preview
```

## Environment variables

`VITE_API_BASE_URL` defaults to `http://localhost:8000`.
`VITE_DEMO_MODE` defaults to `true`. Set it to `false` only after the backend contract is available. Never put an ElevenLabs API key, signed-session secret, or other server-side secret in a `VITE_` variable.

Optional ElevenLabs variables for Member 1:
- `VITE_ELEVENLABS_API_KEY`: ElevenLabs API key for direct cloud synthesis (optional, has fallback).
- `VITE_ELEVENLABS_AGENT_ID`: Agent ID for conversational agent sessions.
- `VITE_ELEVENLABS_VOICE_ID`: Voice ID (defaults to `21m00Tcm4TlvDq8ikWAM` - Riya).

## Demo mode

Demo mode is isolated in `src/data/demo.ts` and selected in `src/services/api.ts`. The UI visibly shows “Demo mode”, and the test lab says “TEXT DEMO” / “Text fallback mode”. It uses synthetic clinic data and a deterministic appointment confirmation. Created and edited demo agents persist in browser local storage under `vaanisetu.demo.agents`.

## FastAPI backend

The backend lives in `backend/app.py` and stores agents, sessions, and appointments in `backend/vaanisetu.db` (ignored by Git).

### Start the backend (Windows PowerShell)

Open a terminal in the repository root and run:

```powershell
py -3 -m venv backend/.venv
.\backend\.venv\Scripts\Activate.ps1
python -m pip install -r backend/requirements.txt
python -m uvicorn app:app --reload --app-dir backend
```

Keep that terminal open. The API runs at `http://localhost:8000`; interactive API docs are at `http://localhost:8000/docs`. In a second terminal, run the frontend with `npm run dev`. Set `VITE_DEMO_MODE=false` in `.env` to use the API instead of browser demo data.

### Routes

- `GET /health` — health check.
- `GET /agents` and `GET /agents/{id}` — list or read agents.
- `POST /agents` and `PUT /agents/{id}` — create or update an agent.
- `POST /agents/{id}/sessions` — create a demo session and return its `sessionId`.
- `GET /appointments/slots?date=YYYY-MM-DD` — list unbooked clinic times for a date (clinic closed Sundays).
- `POST /appointments` — save a confirmed appointment. JSON fields: `patientName`, `date`, `time`, optional `doctor`, and optional `sessionId`. Returns the saved appointment, or `409` if the selected slot was already booked.
- `GET /appointments/latest` — return the most recently saved appointment.

The appointment test flow is available in the Test page: choose a date and available time, complete the conversation confirmation, then open the booking receipt. The backend rejects past dates and unavailable times.

Member 1's ElevenLabs voice and conversation work remains in `src/services/elevenlabs.ts` and `src/services/voiceSession.ts`. The current session endpoint creates local demo session records; live ElevenLabs signed-session credentials are not implemented here.

## Git handoff

The shared repository is `vaanisetu`. Keep `.env` private; `.env.example` is committed. Changes should be made on a feature branch and pushed normally; never force-push shared history.

```bash
gh auth login
git checkout -b feat/your-change
git push -u origin feat/your-change
```

## Limitations / next steps

- Live ElevenLabs voice sessions require the backend-supplied token/session contract. Official docs specify `Conversation.startSession({ signedUrl })` or `{ conversationToken }` for private agents; the API key must remain server-side.
- `src/services/voiceSession.ts` connects the frontend to the ElevenLabs voice and conversational engine.
- The FastAPI appointment and agent endpoints are available. Live ElevenLabs session tokens still need a server-side integration before the mic flow can use a hosted conversational agent.
