# VaaniSetu

VaaniSetu is a bilingual voice-agent builder and appointment demo. It includes an agent dashboard, an agent editor, a conversation test screen, appointment slots and receipts, and a FastAPI service backed by SQLite.

## Requirements

- Node.js 18 or newer
- Python 3.10 or newer
- Windows, macOS, or Linux with a current browser

## Run locally on Windows

In the repository root, install the frontend dependencies and create the frontend environment file:

```powershell
npm ci
Copy-Item .env.example .env
```

Start the backend in one terminal:

```powershell
py -3 -m venv backend/.venv
.\backend\.venv\Scripts\Activate.ps1
python -m pip install -r backend/requirements.txt
python -m uvicorn app:app --reload --app-dir backend --port 8000
```

Start the frontend in a second terminal:

```powershell
npm run dev -- --host 127.0.0.1 --port 4000
```

Open `http://127.0.0.1:4000`. The API health check and interactive docs are at `http://127.0.0.1:8000/health` and `/docs`.

## Run locally on macOS or Linux

In the repository root, install frontend dependencies and create the environment file:

```bash
npm ci
cp .env.example .env
```

Start the backend in one terminal:

```bash
python3 -m venv backend/.venv
source backend/.venv/bin/activate
python -m pip install -r backend/requirements.txt
python -m uvicorn app:app --reload --app-dir backend --port 8000
```

Start the frontend in another terminal:

```bash
npm run dev -- --host 127.0.0.1 --port 4000
```

Then open `http://127.0.0.1:4000`.

The sample `.env` selects demo mode. Set `VITE_DEMO_MODE=false` to use the backend database for agents, slots, and bookings. Vite reads frontend environment values when it starts, so restart the frontend after changing `.env`.

## Voice

Text conversation and appointment booking work without an ElevenLabs account. Browser speech output uses a voice installed on the device when available. Microphone recognition depends on browser support and microphone permission; text input remains available as a fallback.

For live ElevenLabs sessions, set `ELEVENLABS_API_KEY` and `ELEVENLABS_AGENT_ID` in `backend/.env`. The agent must already be configured in ElevenLabs. Secrets belong only in the backend environment, never in a `VITE_` variable. If live voice is not configured, the test screen clearly switches to browser/text mode.

## Data and tests

- Demo agents and bookings persist in that browser’s local storage.
- Backend agents, sessions, and bookings persist in `backend/vaanisetu.db` (ignored by Git).
- The sample booking schedule is defined in `backend/app.py`; Sunday is closed and past same-day slots are hidden.
- Appointment booking checks availability again when saving and rejects duplicate slots.

Run the checks from the repository root:

```powershell
npm run lint
$env:VITE_DEMO_MODE='true'; npm test -- --pool=forks
npm run build
.\backend\.venv\Scripts\python.exe -m pytest backend\tests -q
```

## Scope and deployment

The local setup is for development and demonstration on one computer. It has no user accounts, authorization, production database, or deployment configuration. Do not use it for real patient data or production bookings until those are added and reviewed. To make it available to other computers, deploy the frontend and API, configure HTTPS, CORS, persistent storage, access controls, and provider credentials for that environment.
