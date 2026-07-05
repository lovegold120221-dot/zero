# AGENTS.md

## Commands

```
npm run dev       # Frontend on port 3000, binds 0.0.0.0
npm run dev:api   # Backend Express server on port 4200, binds 0.0.0.0
npm run dev:full  # Both frontend and backend
npm run build     # Production build via Vite
npm run lint      # Typecheck only (tsc --noEmit)
npm run start     # Production: run backend via tsx server/index.ts
```

There is no test framework, no CI, and no pre-commit hooks.

## Environment

- `.env` is gitignored; copy `.env.example` as a starting point.
- `GEMINI_API_KEY` is injected as `process.env.GEMINI_API_KEY` (not `VITE_`-prefixed) via `vite.config.ts` `define`. Do not rename this key.
- Firebase config (`VITE_FIREBASE_*`), Google OAuth (`VITE_GOOGLE_CLIENT_ID`), Supabase URL/key are `VITE_`-prefixed env vars. `vite.config.ts` also maps unprefixed equivalents as fallback.
- `DISABLE_HMR=true` disables HMR (AI Studio compatibility). Keep this check in `vite.config.ts`.
- `APP_URL` is injected by AI Studio at runtime for Cloud Run. Do not hardcode a base URL.
- `VITE_SANDBOX_URL` / `VITE_BACKEND_URL` point to the backend (default `http://localhost:4200`; use the ngrok HTTPS URL when tunneling).
- Server-only vars (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `PORT`/`SANDBOX_PORT`, `WA_AUTH_ROOT`, `WA_LOG_LEVEL`, `WA_SYNC_FULL_HISTORY`, `WA_HISTORY_LIMIT`, `WA_HISTORY_RESPONSE_LIMIT`, `CEREBRAS_API_KEY`, `OLLAMA_API_KEY`) are read by `server/index.ts` via `dotenv/config`.
- `OLLAMA_API_KEY` must NOT be `VITE_`-prefixed (server-only credential).

## Path Alias

`@` → `.` (project root). Defined in both `vite.config.ts` and `tsconfig.json`. Example: `import { foo } from '@/src/lib/bar'`.

## Architecture

Single-package Vite + React 19 + TypeScript app + Express backend (`server/`). Firebase handles auth, Supabase handles persistent data (settings, memories, tool outputs), Gemini Live API handles the AI voice pipeline.

**Entry point:** `index.html` → `src/main.tsx` → `src/App.tsx`

**`src/App.tsx`** is the slim orchestrator: auth state, Firebase init, theme state, user routing (EntryFlow → AuthPage or BeatriceAgent).

### Key source files

| File | Purpose |
|---|---|
| `src/App.tsx` | Root orchestrator: auth, theme, user routing |
| `src/components/BeatriceAgent.tsx` | Main AI voice agent: Gemini Live session, audio pipeline, 20+ tool calls, settings, camera, document generation |
| `src/components/AuthPage.tsx` | Auth UI: sign in / register / reset, Google OAuth |
| `src/components/EntryFlow.tsx` | Splash → Onboarding flow |
| `src/components/ProfilePage.tsx` | User settings: persona, language, memory, content filter, theme |
| `src/components/ChatPage.tsx` | Text chat interface with markdown rendering |
| `src/components/VideoPage.tsx` | Camera feed and screen sharing |
| `src/components/WhatsAppPortal.tsx` | WhatsApp pairing wizard and chat browser |
| `src/components/UnifiedTranscript.tsx` | Animated word-by-word transcript |
| `src/firebase.ts` | Firebase init + `handleFirestoreError()` helper |
| `src/lib/audio.ts` | `AudioStreamer` (TTS playback) and `AudioRecorder` (mic capture) |
| `src/lib/supabase.ts` | Supabase client setup + `saveToolResult`/`fetchToolResult` |
| `src/lib/supabaseStorage.ts` | Avatar + knowledge file upload/list/delete to Supabase Storage |
| `src/lib/whatsappClient.ts` | WhatsApp backend API client (pair, send, status, contacts) |
| `src/lib/workspace.ts` | IndexedDB workspace + Drive upload |
| `src/lib/codingAgentClient.ts` | Ollama Cloud coding agent client |
| `src/constants.ts` | Shared `LANGUAGES` array (147 entries) |
| `src/index.css` | Full theme system (dark/light) + `@import "tailwindcss"` |
| `vite.config.ts` | Path alias, Tailwind v4 plugin, env injection |
| `server/index.ts` | Express backend: WhatsApp, Belgian tools, sandbox, Cerebras browser, Ollama proxy, web glance, health |
| `server/whatsapp.ts` | `WhatsAppManager`: Baileys session lifecycle, SSE streaming |
| `server/whatsapp-tools.ts` | Permission-gated WhatsApp tool handlers |
| `server/belgian-tools.ts` | 10 Belgian administrative tools |
| `server/eburon.ts` | `EburonWorker`: server-side HTML doc generation (webpages, dashboards, reports) |
| `server/ollama-cloud.ts` | Ollama Cloud API proxy for coding agent |
| `api/coding-agent.ts` | Vercel serverless function for coding agent |

### Additional directories

- `flutter/` — Full Flutter project (separate codebase, not part of the web build).
- `functions/` — Firebase Cloud Functions (excluded from `tsconfig.json`). Separate `package.json`.
- `docs/` — Architecture diagrams (`.mmd`/`.svg`/`.png`). Useful for understanding system flow.
- `api/` — Vercel serverless functions.

## Firebase + Firestore

- Config is hardcoded in `src/firebase.ts`.
- Firestore blueprint: `firebase-blueprint.json` defines `User` and `Message` schemas.
- **Messages are immutable** — `allow update, delete: if false` in `firestore.rules`. Never attempt to edit or delete messages.
- Every Firestore operation must use `handleFirestoreError()` from `src/firebase.ts` (includes auth context).
- Security invariants from `security_spec.md` must be preserved: user data isolation, timestamp validation (`== request.time`), role constrained to `user`/`model`, field validation by whitelist, length limits (`personaName` ≤ 50, `customPrompt` ≤ 2000, `message.text` ≤ 5000, document ID ≤ 128 chars matching `^[a-zA-Z0-9_\-]+$`).

## Gemini Live API

- SDK: `@google/genai` (`^1.29.0`), model: `gemini-2.5-flash-native-audio-preview-12-2025`.
- Real-time bidirectional audio via WebSocket. Audio output is PCM16 mono 24kHz, streamed via `AudioStreamer` (decode → queue → schedule → play).
- 20+ tools declared. Execution is a single switch statement inside the `onmessage` closure.
- The voice personality prompt (`VOICE_PERSONALITY_PROMPT`) is a ~460-line constant in `src/components/BeatriceAgent.tsx`. Do not alter it casually — it defines the entire agent persona.
- Permissions (10 boolean toggles, all default `true`) are injected into the system instruction at session start. Changes require session reconnect.
- Document generation uses a separate non-voice Gemini session (`gemini-2.5-flash`, non-streaming).
- Web search uses Gemini's built-in `googleSearch` grounding (no separate `web_glance` tool).

## WhatsApp Integration (Backend)

- **Provider**: Baileys only (`@whiskeysockets/baileys`). No Go WhatsApp or alternative providers.
- **Base URL**: local Docker/server default `http://localhost:4200`; expose with `ngrok http 4200` when a public URL is needed.
- **Endpoints**:
  - **Health**: `GET /api/health`
  - **QR Code**: `GET /api/whatsapp/qr/{userId}` (returns raw PNG)
  - **Tool Execution**: `POST /api/whatsapp/tool`
  - **SSE Stream**: `GET /api/whatsapp/stream/:userId` (real-time message events)
  - **Webhook Config**: `POST /api/whatsapp/admin/config` (set `webhookUrl`)
- **Delegated send rule**: outbound WhatsApp tools require `permissions.requireUserApproval=true`, `permissions.approvedByUser=true`, and `permissions.mode="delegated_send"`. Beatrice must preview the message and wait for `SEND`/`Approved` before sending.
- **History mimicry**: `WA_SYNC_FULL_HISTORY=true` makes Baileys request desktop-style full history. Persist up to `WA_HISTORY_LIMIT` messages (default 50000) and allow `getMessageHistory` responses up to `WA_HISTORY_RESPONSE_LIMIT` (default 2000) so Beatrice can mimic the user's `fromMe:true` WhatsApp style.

## Supabase (Primary Data Store)

- Used for persistent data: `user_settings`, `memories`, `tool_outputs`, `messages`.
- **`tool_outputs` table is the single source of truth** for tool results. The UI (`DocumentViewer`) fetches only by ID from Supabase. Never render tool output directly in the client.
- `add_to_memory` and `search_memory` store/retrieve facts in the `memories` table. 10 most recent memories are loaded into the system prompt at session start.
- Database migrations: `supabase-migration-settings.sql` and `supabase-migration-memories.sql`.

## Memory System

- `add_to_memory` — saves user facts/preferences to Supabase `memories` table with optional tags.
- `search_memory` — full-text search on stored memories.
- 10 most recent memories pre-loaded into system prompt at session start.
- Memoirs stored per-user with RLS.

## Sandbox & Cerebras Sub-Agents

- `run_sandbox_task` — delegates complex tasks to Gemini API via backend (`POST /api/sandbox/run`). Results displayed in Eburon PC sandbox viewer (`DocumentViewer`).
- `cerebras_browser_task` — automated web browsing via Cerebras + Browser-Use. Python wrapper at `scripts/cerebras_browser.py`. Setup: `bash scripts/setup-cerebras.sh`. Requires `CEREBRAS_API_KEY` in `.env`.

## UI / Styling

- Tailwind CSS v4 via `@tailwindcss/vite` plugin — uses `@import "tailwindcss"` syntax, no `tailwind.config.*`.
- Full dark + light theme system defined in `src/index.css` with CSS custom properties (`var(--bg-base)`, `var(--text-primary)`, `var(--accent)`, etc.) and 70+ override rules for `.theme-light`.
- Dark theme default: `#050505` background, warm peach (`#d0a78b`) accent.
- Animation library: `motion` (formerly framer-motion), imported as `motion/react`.
- Icons: `lucide-react`.
- Markdown rendering: `react-markdown`.
- **Reference UI**: `public/reference-ui.html` is the design source of truth for UI changes (orb animation, blob drift keyframes, peach glow, transcription area, bottom nav).

## Tool Implementation Rules

- **Client-side**: Google Services tools (Gmail, Calendar, Drive, Tasks, Contacts) run in the browser using the user's OAuth token.
- **Server-side**: WhatsApp and Belgian tools are proxied through the Express backend for session isolation.
- **Supabase**: All generated content (invoices, documents, webpages) must be saved to `tool_outputs` and rendered by `DocumentViewer` via Supabase fetch, not direct client-side injection.
