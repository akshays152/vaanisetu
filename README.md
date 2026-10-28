# VaaniSetu Frontend

VaaniSetu is a polished React/Vite frontend for the “Voice AI for Everyone” hackathon experience. It demonstrates the complete path: configure an agent → test the conversation → view an appointment outcome.

## Features

- Responsive landing page with VaaniSetu branding and ElevenLabs positioning.
- Dashboard with agent cards, status, language, voice, and actions.
- Functional agent builder with validation-friendly required fields, bilingual mode, voice selection, character limits, live preview, and edit support.
- Test lab with explicit `TEXT DEMO` and `Demo mode` labels; no fake microphone or live voice claims.
- Synthetic appointment confirmation result.
- Centralized API service boundary ready for the backend team.

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

## Demo mode

Demo mode is isolated in `src/data/demo.ts` and selected in `src/services/api.ts`. The UI visibly shows “Demo mode”, and the test lab says “TEXT DEMO” / “Text fallback mode”. It uses synthetic clinic data and a deterministic appointment confirmation.

## Proposed backend contract

These are integration interfaces, not assumptions that routes already exist:

- `GET /agents`
- `GET /agents/:id`
- `POST /agents`
- `PUT /agents/:id`
- `POST /agents/:id/sessions` — should return a signed ElevenLabs conversation token/URL or session configuration.
- A session input endpoint, if needed by the agreed integration.
- `GET /appointments/latest` or a session-results endpoint returning `{ status, patientName?, date?, time?, message }`.

Member 1 should confirm the ElevenLabs agent ID/configuration, language behavior, and signed-session startup method. The current frontend intentionally stops at the integration boundary and does not invent SDK methods or credentials.

## Git handoff

The project is designed to live in a repository named `vaanisetu-frontend`. Keep `.env` private; `.env.example` is committed. A team member with GitHub access can create/push the repository with:

```bash
gh auth login
gh repo create vaanisetu-frontend --private --source . --remote origin
git push -u origin main
```

## Limitations / next steps

- Live ElevenLabs voice sessions require the backend-supplied token/session contract.
- Backend error/loading handling can be expanded when response shapes are confirmed.
- A backend-connected test should replace the deterministic text response once Member 1/3 provide the session and booking endpoints.
