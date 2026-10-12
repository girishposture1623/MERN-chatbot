# ChatBot - MERN AI Chat Assistant

A full-stack AI chat application with a React interface, an Express API, MongoDB conversation storage, and streaming responses from configured AI providers.

## Table of contents
- [Overview](#overview)
- [Features](#features)
- [Technology stack](#technology-stack)
- [Project structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Installation and setup](#installation-and-setup)
- [Environment variables](#environment-variables)
- [AI provider configuration](#ai-provider-configuration)
- [API reference](#api-reference)
- [Development and production](#development-and-production)
- [Troubleshooting](#troubleshooting)
- [Security notes](#security-notes)
- [License](#license)

## Overview

The React 19 frontend, served by Vite during development, calls an Express 5 backend. The backend stores conversations and paired user/assistant messages in MongoDB through Mongoose. It can generate replies with OpenRouter, Groq, and Gemini, returning streamed replies to the browser. Routes are mounted under `/api`; the frontend API base URL comes from `VITE_API_URL`.

## Features

- AI chat with streamed replies and Markdown rendering.
- MongoDB-backed conversation history, reopening, search, rename, and delete.
- Regenerate a saved assistant reply and stop the browser-side generation request.
- Light/dark themes, collapsible and resizable sidebar, and mobile navigation drawer.
- Sequential provider fallback before a provider emits any text.

## Technology stack

| Area | Technologies |
| --- | --- |
| Frontend | React 19, React DOM, Vite 8, React Markdown, remark-breaks, Fetch API |
| Backend | Node.js (ES modules), Express 5, CORS, dotenv |
| Database | MongoDB, Mongoose 9 |
| AI | OpenRouter and Groq via OpenAI SDK; Gemini via Google GenAI SDK |
| Tooling | npm, Nodemon, ESLint |

## Project structure

```text
.
|-- backend/
|   |-- config/
|   |   `-- db.js                    # MongoDB connection
|   |-- controllers/
|   |   `-- chat.controllers.js
|   |-- models/                      # Conversation and Chat schemas
|   |-- Routes/
|   |   `-- chat.route.js            # HTTP routes
|   |-- services/                    # AI generation and conversation persistence
|   |-- .gitignore
|   |-- package.json
|   `-- server.js                    # Express startup and CORS
`-- frontend/
    |-- public/                      # Public SVG assets
    |-- src/
    |   |-- api/                     # API client and request functions
    |   |-- assets/                  # Images and icons
    |   |-- components/              # Chat, common, and sidebar UI
    |   |-- pages/                   # Chat page
    |   |-- styles/                  # Chat styles and themes
    |   |-- utils/                   # Chat state helpers
    |   |-- App.jsx
    |   `-- main.jsx
    |-- .env.development
    |-- .env.production              # Contains a production URL placeholder
    |-- index.html
    `-- package.json
```

Both folders have their own npm package manifest and lockfile; install dependencies in each folder.

## Prerequisites

- Node.js and npm (with a Node release supported by the installed Vite version).
- MongoDB available at the URI currently hard-coded in `backend/config/db.js`.
- At least one API key from OpenRouter, Groq, or Gemini.
- Git to clone the repository.

## Installation and setup

1. Clone using the actual repository URL supplied by the project owner:
   ```sh
   git clone <REPOSITORY_URL>
   cd <REPOSITORY_DIRECTORY>
   ```
2. Install backend dependencies and create `backend/.env` using the template below:
   ```sh
   cd backend
   npm install
   ```
3. In a second terminal install and start the frontend:
   ```sh
   cd frontend
   npm install
   npm run dev
   ```
   The development API URL is already set in `frontend/.env.development` to `http://localhost:5000/api`. Vite displays its local URL (typically port 5173).
4. Start the backend in the first terminal:
   ```sh
   npm run dev
   ```
   It defaults to port 5000. Use `npm start` instead of `npm run dev` to start without Nodemon.

MongoDB must be running at `mongodb://127.0.0.1:27017/chatbot`. The URI is hard-coded; no database URL environment variable is implemented.

## Environment variables

### Backend (`backend/.env`)

Use only the provider key(s) you have. Values below are safe placeholders:

```env
PORT=5000
FRONTEND_URL=http://localhost:5173
OPENROUTER_API_KEY=your_openrouter_key
OPENROUTER_MODEL=openrouter/free
GROQ_API_KEY=your_groq_key
GROQ_MODEL=llama-3.3-70b-versatile
GEMINI_API_KEY=your_gemini_key
GEMINI_MODEL=gemini-2.5-flash
```

| Variable | Required/default |
| --- | --- |
| `PORT` | Optional; defaults to `5000`. |
| `FRONTEND_URL` | Optional CORS origin; defaults to `http://localhost:5173`. |
| `OPENROUTER_API_KEY` | Optional individually; enables OpenRouter. At least one provider key is needed. |
| `OPENROUTER_MODEL` | Optional; defaults to `openrouter/free`. |
| `GROQ_API_KEY` | Optional individually; enables Groq. |
| `GROQ_MODEL` | Optional; defaults to `llama-3.3-70b-versatile`. |
| `GEMINI_API_KEY` | Optional individually; enables Gemini. |
| `GEMINI_MODEL` | Optional; defaults to `gemini-2.5-flash`. |

MongoDB URI is not an environment variable in the current code; it is hard-coded in `backend/config/db.js`.

### Frontend (Vite)

`frontend/.env.development` sets:

```env
VITE_API_URL=http://localhost:5000/api
```

`frontend/.env.production` currently uses `https://YOUR-PRODUCTION-BACKEND-URL/api`. Replace this placeholder with the deployed API base URL before building for production. Vite-exposed variables are public; do not put secrets or provider keys in them.

## AI provider configuration

Providers are attempted in this order: OpenRouter, Groq, Gemini. A provider is enabled when its key is set. Missing-key providers are skipped. A failed or empty response can fall through to the next provider only before any text has been streamed. A failure after text starts ends the response; the service cannot switch providers mid-stream.

OpenRouter and Groq use streaming chat completions through the OpenAI SDK. Gemini uses Google GenAI streaming and receives the same system instruction as a provider setting. That instruction is added per request and is not stored in chat history. See the environment table for model defaults.

## API reference

All endpoints are prefixed with `/api`; JSON request bodies use `Content-Type: application/json`. IDs are MongoDB ObjectIds.

| Method/path | Purpose and request |
| --- | --- |
| `GET /api/conversations?q=<text>` | List newest-updated conversations; optional search matches titles and stored messages. |
| `POST /api/conversations` | Create a `New chat`; send `{}`. Returns the conversation. |
| `GET /api/conversations/:id` | Return `{ conversation, chats }`, chats in chronological order. |
| `PATCH /api/conversations/:id` | Rename; body `{ "title": "Project notes" }`, 1-100 characters. |
| `DELETE /api/conversations/:id` | Delete conversation and associated chats; returns `{ "success": true }`. |
| `POST /api/conversations/:id/messages` | Non-streaming send; body `{ "message": "Hello" }`; returns `{ chat, conversation }`. |
| `POST /api/conversations/:id/messages/stream` | Stream and persist reply; body `{ "message": "Hello" }`; response is plain UTF-8 text. |
| `POST /api/conversations/:id/messages/regenerate` | Regenerate a saved reply; body `{ "chatId": "<CHAT_OBJECT_ID>" }`; response is plain text stream. |

For example, rename using the full prefixed path:

```sh
curl -X PATCH http://localhost:5000/api/conversations/<CONVERSATION_ID> \
  -H "Content-Type: application/json" \
  -d '{"title":"Project notes"}'
```

Invalid IDs and missing records return client errors. AI failures before streaming begins return a gateway error. After output starts, the server can only end the stream on failure.

## Development and production

| Directory | Command | Purpose |
| --- | --- | --- |
| `frontend/` | `npm run dev` | Vite development server |
| `frontend/` | `npm run build` | Production bundle in `dist/` |
| `frontend/` | `npm run preview` | Preview built frontend |
| `frontend/` | `npm run lint` | Run ESLint |
| `backend/` | `npm run dev` | API with Nodemon |
| `backend/` | `npm start` | API with Node.js |

No deployment URL or deployment configuration is present. Set the actual production API URL in `frontend/.env.production`, set backend `FRONTEND_URL` to the frontend origin, provide server-side provider keys, and configure database connectivity. Production MongoDB requires updating the currently hard-coded local URI.

## Troubleshooting

- **No provider or AI failure:** Set a valid provider key, check account quota, and confirm the configured model is available.
- **Missing credentials:** Check spelling in `backend/.env` and restart the backend; dotenv loads at startup.
- **MongoDB unavailable:** Start MongoDB and check `127.0.0.1:27017`. The database name is `chatbot`. Connection failures are logged but the current connector does not rethrow the error, so inspect backend logs if requests later fail.
- **CORS error:** Set `FRONTEND_URL` to the exact frontend origin, including scheme and port, then restart backend.
- **Frontend cannot reach backend:** Ensure `VITE_API_URL` includes `/api` and points to the right host and port; restart Vite after edits.
- **Provider fails mid-stream:** Check provider status, key, quota, and model. The app only falls back before text has been emitted.
- **Wrong production API host:** Replace the `YOUR-PRODUCTION-BACKEND-URL` placeholder before building.

## Security notes

- Do not commit `backend/.env`; backend ignore rules exclude environment files.
- Never put provider secrets in `VITE_*` variables; browser users can inspect them.
- Rotate exposed credentials and limit their permissions where possible.
- Restrict CORS to the intended frontend origin.
- The database connection is currently a local hard-coded URI. Production should use a secured database connection configured outside committed source.

## License

There is no root `LICENSE` file. The backend `package.json` contains `ISC` license metadata, but there is no repository license file establishing a license for the complete project. Confirm licensing with the project owner before redistribution.

