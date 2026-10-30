# VaaniSetu – Voice AI for Everyone

**VaaniSetu** is a no-code Voice AI Agent Builder platform designed to make conversational AI accessible to everyone. It aims to allow users to create, customize, test, and deploy AI-powered voice agents without requiring extensive technical knowledge.

Built around the concept of simplifying human–AI interaction, VaaniSetu combines voice technology, agent configuration, multilingual conversations, and backend integration into a unified platform.

## Key Features

- **No-Code AI Agent Builder:** Create and configure voice agents through a simple and user-friendly interface.
- **Customizable Agents:** Define agent names, purposes, instructions, languages, voices, and conversational behavior.
- **Multilingual Communication:** Support for Hindi, English, and Hinglish conversations.
- **Voice AI Integration:** Integration with ElevenLabs for AI-powered conversational voice experiences.
- **Interactive Testing Environment:** Test agent conversations and evaluate their responses before deployment.
- **Conversation Management:** Manage agent configurations and maintain session information.
- **Backend Integration:** Connect frontend interactions with backend services through REST APIs.
- **Responsive Interface:** Clean and intuitive design that provides a smooth experience across devices.

## How VaaniSetu Works

The platform is designed around five major stages:

### 1. Write – Create Your AI Agent
Users can configure an AI voice agent by defining its identity, purpose, instructions, language, and voice preferences.

### 2. Test – Experience the Conversation
Users can interact with their configured agents and test conversational behavior through the testing environment.

### 3. Refine – Improve Agent Behaviour
Agent configurations and instructions can be adjusted to improve response quality and align the agent with the intended use case.

### 4. Deploy – Make Your Agent Available
The platform is designed to support publishing voice agents through accessible deployment options, such as web-based integrations and shareable experiences.

### 5. Observe – Monitor Interactions
The platform aims to provide visibility into agent sessions and conversation outcomes, helping users understand and improve agent performance.

## Technology Stack

**Frontend**
- React.js
- TypeScript
- Vite
- React Router
- Lucide React
- CSS

**Backend**
- Python
- FastAPI
- SQLite
- REST APIs

**Voice AI**
- ElevenLabs Conversational AI
- ElevenLabs JavaScript Client
- Web Speech API
- Browser Speech Synthesis for demonstration fallback

## Project Architecture

VaaniSetu follows a modular frontend-backend architecture.

- **Frontend:** Provides the user interface for agent creation, configuration, testing, and interaction.
- **Backend:** Handles API requests, agent configuration management, session records, and appointment-related operations.
- **Voice AI Layer:** Connects the application with ElevenLabs to support conversational voice sessions.
- **Database:** SQLite stores agent information, session records, and appointment data.

## Getting Started

### Prerequisites

- Node.js 18+
- Python 3.10+
- npm
- ElevenLabs account and API credentials for live voice integration

### Frontend Setup

Clone the repository:

```bash
git clone <repository-url>
cd vaanisetu
