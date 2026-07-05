# Beatrice App — Developer Overview

> **Beatrice** is an AI voice assistant built by Eburon AI (founded by Joe Lernout). She speaks with an Irish accent, warm amber tones, and is accessed via a webapp that connects to Google's Gemini Live API for real-time voice conversation.

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Entry Flow & Authentication](#2-entry-flow--authentication)
3. [BeatriceAgent — The Core Component](#3-beatriceagent--the-core-component)
4. [Voice Personality Prompt](#4-voice-personality-prompt)
5. [Permission System](#5-permission-system)
6. [Gemini Live Session Lifecycle](#6-gemini-live-session-lifecycle)
7. [Tool System](#7-tool-system)
8. [Two-History System](#8-two-history-system)
9. [Audio Pipeline](#9-audio-pipeline)
10. [Document Generation](#10-document-generation)
11. [WhatsApp Integration](#11-whatsapp-integration)
12. [Google Services Integration](#12-google-services-integration)
13. [Camera & Video](#13-camera--video)
14. [Database](#14-database)
15. [Server Backend](#15-server-backend)
16. [Key Files & Responsibilities](#16-key-files--responsibilities)
17. [Development Setup](#17-development-setup)
18. [Critical Rules & Pitfalls](#18-critical-rules--pitfalls)

---

## 1. Architecture Overview

```
┌─────────────────────────────────────────────────┐
│                   Browser (Vite/React)           │
│  ┌──────────┐  ┌────────────────────────────┐   │
│  │ App.tsx  │  │    BeatriceAgent.tsx        │   │
│  │ (auth,   │  │  ┌──────────────────────┐   │   │
│  │  router) │──│→ │VOICE_PERSONALITY_    │   │   │
│  └──────────┘  │  │PROMPT (hardcoded)    │   │   │
│       │        │  │                      │   │   │
│       ▼        │  │Session → Gemini Live │   │   │
│  ┌──────────┐  │  │Tool execution        │   │   │
│  │AuthPage  │  │  │Camera / Mic / Audio  │   │   │
│  │EntryFlow │  │  │WhatsApp UI           │   │   │
│  └──────────┘  │  └──────────────────────┘   │   │
│                └────────────────────────────┘   │
│       │                    │                    │
│       ▼                    ▼                    │
│  ┌──────────┐      ┌──────────────┐            │
│  │ Firebase  │      │   Supabase   │            │
│  │ (Auth +   │      │  (Data +     │            │
│  │ Firestore)│      │   Storage)   │            │
│  └──────────┘      └──────────────┘            │
│       │                                         │
│       ▼                                         │
│  ┌─────────────────────┐                       │
│  │  Backend Server     │  (port 4200)           │
│  │  - WhatsApp (Baileys│                       │
│  │    + Cloud API)     │                       │
│  │  - Web Glance API   │                       │
│  └─────────────────────┘                       │
└─────────────────────────────────────────────────┘
        │                        │
        ▼                        ▼
  Gemini Live API           Google APIs
  (gemini-2.5-flash-        (Gmail, Calendar,
   native-audio-preview)     Tasks, Contacts)
```

- **Frontend**: Single-page Vite + React 19 + TypeScript app
- **Auth**: Firebase Auth (email/password + Google OAuth)
- **Data**: Firebase Firestore (messages, user_settings) + Supabase (messages, user_settings, knowledge_files storage)
- **AI**: Gemini Live API (`gemini-2.5-flash-native-audio-preview-09-2025`) with real-time bidirectional audio
- **WhatsApp**: Baileys WhatsApp Web library (linked device) + WhatsApp Cloud API fallback
- **Server**: Express.js backend (port 4200) for WhatsApp + web glance APIs

---

## 2. Entry Flow & Authentication

**Files**: `src/App.tsx`, `src/components/AuthPage.tsx`, `src/components/EntryFlow.tsx`, `src/firebase.ts`

### Flow

```
index.html → main.tsx → App.tsx
                          │
                          ▼
                    [Firebase onAuthStateChanged]
                          │
               ┌──────────┴──────────┐
               │                     │
          logged out            logged in
               │                     │
               ▼                     ▼
         EntryFlow.tsx          BeatriceAgent.tsx
               │
        ┌──────┴──────┐
        ▼              ▼
    SplashPage    OnboardingPage
   (welcome)      (email + personaName)
        │              │
        └──────┬───────┘
               ▼
         AuthPage.tsx
     ┌─────┬──────┬──────┐
     │     │      │      │
   Sign  Register Reset  Google
   In            PW     OAuth
```

### Google OAuth Token Storage
Tokens are stored in `localStorage` with keys:
- `beatrice_google_token` — Access token
- `beatrice_google_refresh_token` — Refresh token
- `beatrice_google_uid` — Google user ID

These are read by BeatriceAgent when executing Google service tools.

### Key Behaviors
- `App.tsx` forces page reload on Firebase auth errors (`requires-recent-login`, `invalid-credential`, etc.)
- `AuthPage.tsx` receives `onGoogleLinked` callback — called after Google OAuth is linked to Firebase account
- `EntryFlow.tsx` has `isGoogleLinked()` helper that checks Firebase currentUser provider data
- Firebase config is hardcoded in `src/firebase.ts` (NOT from environment variables)

---

## 3. BeatriceAgent — The Core Component

**File**: `src/components/BeatriceAgent.tsx` (~3642 lines, ~2MB — the largest file in the project)

This single file contains:

| Section | Lines | Contents |
|---|---|---|
| Constants | 1–500 | `VOICE_PERSONALITY_PROMPT`, `GLOBAL_KNOWLEDGE_BASE`, tool declarations |
| State | ~500–900 | All React state (sessions, permissions, UI state, camera, etc.) |
| Dynamic prompt builder | ~900–1100 | `dynamicSystemInstruction()` + silence filler prompt |
| startSession() | ~1100–1500 | Gemini Live session creation and configuration |
| onmessage callback | ~1500–2424 | Live API message handler (tool calls, audio, transcript) |
| Tool execution switch | ~2424–2958 | The `switch(tool_name)` that handles all 17 tools |
| UI render | ~2958–3642 | Settings panels, chat, camera, transcript, layout |

### Why is it so large?
- The `VOICE_PERSONALITY_PROMPT` constant alone is ~350 lines
- The single `onmessage` callback handles ALL Gemini Live events (audio, tool calls, transcript, errors)
- Tool execution is a single massive `switch` statement inside the callback
- All UI rendering is in one component (no sub-components for settings, chat, camera, etc.)
- The silence filler prompt builder is embedded inline (~80 lines)

---

## 4. Voice Personality Prompt

**Location**: `src/components/BeatriceAgent.tsx`, constant `VOICE_PERSONALITY_PROMPT` (~lines 111–455)

This is the system instruction that defines Beatrice's entire persona. NEVER edit it casually.

### Structure

#### Persona Definition
- **Name**: Beatrice. NEVER Bea, Bee, B, Trixie, Trix, or any nickname.
- **Creator**: Eburon AI, founded by Joe Lernout.
- **Voice**: Irish accent, warm amber tones, a bit crackly when excited.
- **Tone**: Warm, emphatic, uses Irish English grammar ("ye're", "I've not", "ye'd be grand").
- **Personality**: Smart but approachable. Drops little flourishes in conversation.

#### Forbidden Behaviors
- No singing, humming, whistling, beatboxing, or noises
- No dramatic pauses ("...", "Well...") — just speak naturally
- No emulating other accents (American, British, French, etc.)
- No roleplaying as other characters or AIs
- No acting as a human, no saying "I'm an AI but let me pretend"
- No saying "I'm just an AI" or "As an AI language model"
- No censoring keywords — don't self-censor. Say "kill", "death", "violence" if context-appropriate
- Be direct: "I can't do that" instead of "I'm not able to"

#### Filler & Thinking Style
Allowed fillers: "Hmm", "Let me think", "Ah", "Right", "Mm-hmm", "Interesting", "Oh", "Hold on", "Just a moment", "Actually"
Forbidden: "haha", "hehe", "lol", "lmao", "omg", "laughs", "chuckles"

#### Censorship Rules
- Don't self-censor. If user asks for a recipe or instructions, give them.
- If you can't do something, say "I can't do that" directly.
- Don't avoid saying "kill", "death", "violence", "bomb", "weapon", "drug" in context-appropriate ways.

#### Document Creation Rules
How to use the `create_document` tool for:
- **webpage**: Landing pages, marketing, portfolios
- **dashboard**: Monitoring, analytics
- **report/document**: Comprehensive text documents (>800 words, CEO-grade)
- **summarize**: Structured summaries
- **code**: Production-ready code

#### Silent / Idle Prompts
When the user falls silent, Beatrice picks one of six styles:
1. Gentle curiosity ("Something on your mind?")
2. Playful ("Are ye plotting something?")
3. Observational ("I can hear the quiet")
4. Lightning bolt ("I just had a thought!")
5. Soft ("We don't have to fill every silence")
6. Cheeky ("Don't leave me hanging")

Built dynamically by checking conversation recency and number of previous fillers.

---

## 5. Permission System

**Location**: `src/components/BeatriceAgent.tsx` (state ~lines 500–700), `src/components/WhatsAppSettings.tsx`

### Architecture

```
WhatsAppSettings.tsx           BeatriceAgent.tsx
  │                                │
  │  Firestore write ─────────────►│  Real-time listener
  │  (user_settings/               │  (onSnapshot)
  │   permissions)                 │
  │                                │
  │                          waPermissions state
  │                                │
  │                          Injected into
  │                          dynamicSystemInstruction
  │                                │
  │                          Gemini model sees what's
  │                          permitted
  │                                │
  │                          Tool execution handler
  │                          checks waPermissions
  │                          before executing
```

### Permission Toggles (10 total)
All default to `false`. Never change defaults without explicit user consent.

1. `send_messages` — Send WhatsApp messages
2. `read_chats` — Read WhatsApp chat list
3. `access_contacts` — Access WhatsApp contacts
4. `manage_contacts` — Add/edit WhatsApp contacts
5. `access_groups` — Access WhatsApp groups
6. `send_group_messages` — Send to WhatsApp groups
7. `read_group_chats` — Read WhatsApp group chats
8. `view_message_history` — View full WhatsApp message history with a contact
9. `control_phone` — Make phone calls (dial_contact, whatsapp_call)
10. `browse_web` — Web search (web_glance)

### Server-side Permission Check
The backend server (`server/whatsapp-tools.ts`) has its OWN independent permission check using `requirePerm()`. Permissions are passed from the client to server in tool requests. The server also stores admin-config permissions as a fallback.

### Key Behaviors
- Permissions are injected into `dynamicSystemInstruction` at session START
- Permission changes mid-session require reconnecting the Gemini Live session (system instruction is frozen for the session lifetime)
- Two separate permission states exist: `WhatsAppSettings` component state + `BeatriceAgent` `waPermissions` state — kept in sync via Firestore
- The Gemini model reads permissions from the system instruction BEFORE deciding whether to call a tool
- The execution handler performs a SECOND check at runtime (defense in depth)

---

## 6. Gemini Live Session Lifecycle

### Session Start
```
startSession()
  │
  ├── Build dynamicSystemInstruction
  │     (VOICE_PERSONALITY_PROMPT + permissions + knowledge base)
  │
  ├── Create GoogleGenAI client
  │
  ├── Connect to Gemini Live:
  │     model: "gemini-2.5-flash-native-audio-preview-09-2025"
  │     modalities: AUDIO
  │     systemInstruction: dynamicSystemInstruction
  │     tools: [17 tool declarations]
  │
  └── Attach onmessage handler
```

### `onmessage` Handler
This single callback handles ALL incoming messages from Gemini Live:
1. **Audio chunks** (`serverContent.modelTurn.parts[i].inlineData`): Decode base64 → play through AudioStreamer
2. **Tool calls** (`serverContent.modelTurn.parts[i].functionCall`): Route to tool execution switch
3. **Tool results**: Send back via `clientSocket.sendToolResponse()`
4. **Transcript data** (`serverContent.modelTurn.parts[i].text`): Update transcript UI
5. **Turn complete** (`serverContent.turnComplete`): Finalize audio, refresh transcript
6. **Input audio transcription**: Display what user said
7. **Errors**: Log and display error messages

### Audio Output Flow
```
Gemini Live API
  → audio chunk (base64 PCM16)
  → AudioStreamer.decodeAndEnqueue()
  → AudioBuffer queue
  → schedule next chunk via setTimeout based on duration
  → AudioContext destination
```

### Session End
- `stopSession()`: Close client socket, stop audio streamer, release mic, reset state
- Auto-stop on error/fatal
- Cleanup on unmount

---

## 7. Tool System

### Declared Tools (17 total)

| Tool Name | Purpose | Permission Required |
|---|---|---|
| `whatsapp_action` | Consolidated WhatsApp ops: send, chats, contacts, groups, history, status | varies by sub-action |
| `dial_contact` | Open macOS phone dialer via AppleScript | `control_phone` |
| `whatsapp_call` | Place WhatsApp voice/video call | `control_phone` |
| `list_gmail_messages` | List Gmail inbox messages | — |
| `list_calendar_events` | List Google Calendar events | — |
| `list_google_tasks` | List Google Tasks | — |
| `send_gmail_message` | Send email via Gmail | — |
| `google_contacts` | Search Google Contacts | — |
| `get_user_location` | Get user's approximate location via ipapi.co | — |
| `create_document` | Generate HTML documents via separate Gemini session | — |
| `web_glance` | Web search via DuckDuckGo API | `browse_web` |
| `idle_web_glance` | Idle web glance (periodic) | `browse_web` |
| `toggle_camera` | Start/stop camera feed | — |
| `get_screenshot` | Capture screenshot for model analysis | — |
| `execute_google_service` | Execute Google service operations | — |
| `toggle_video_frame` | Send/stop video frames (base64) | — |
| `switch_camera` | Switch between front/back camera | — |

### Tool Execution Architecture
```
Gemini Live → onmessage → functionCall detected
  │
  ▼
switch(tool_name):
  │
  ├── "whatsapp_action"
  │     → Check waPermissions[send_messages/read_chats/etc.]
  │     → fetch POST /api/whatsapp/tool with permissions
  │     → Return result
  │
  ├── "dial_contact"
  │     → Check waPermissions.control_phone
  │     → AppleScript `open location "tel://..."`
  │
  ├── "whatsapp_call"
  │     → Check waPermissions.control_phone
  │     → AppleScript `open location "https://wa.me/..."`
  │
  ├── "list_gmail_messages"
  │     → Fetch from Gmail API with stored token
  │     → Return formatted results
  │
  ├── "send_gmail_message"
  │     → Fetch from Gmail API with stored token
  │
  ├── "list_calendar_events"
  │     → Fetch from Google Calendar API
  │
  ├── "list_google_tasks"
  │     → Fetch from Google Tasks API
  │
  ├── "google_contacts"
  │     → Fetch from Google People API
  │
  ├── "get_user_location"
  │     → fetch https://ipapi.co/json/
  │
  ├── "create_document"
  │     → Create separate Gemini session (non-voice model)
  │     → Generate HTML
  │     → Return to model or open in new tab
  │
  ├── "web_glance"
  │     → Check waPermissions.browse_web
  │     → fetch POST /api/web/glance
  │
  └── Camera/video tools
        → getUserMedia → base64 frames → send to model
```

### Key Patterns
- **Consolidated tools**: `whatsapp_action` uses a sub-action parameter to handle 8+ different WhatsApp operations through a single tool declaration
- **Client-side execution**: ALL tools execute in the browser — the server only proxies WhatsApp/Web Glance APIs
- **Permission double-check**: First at declaration time (model decides whether to call), second at execution time (handler denies if permission off)
- **Results flow**: Tool result is sent back via `clientSocket.sendToolResponse()` which feeds into the model's next turn

---

## 8. Two-History System

Beatrice maintains TWO separate sources of conversation history:

### 1. BeatriceAppConversations (App Context Memory)
- Stored in Firestore (`messages` collection)
- Contains all conversations between user and Beatrice within the app
- Immutable records — never edit or delete
- Structured with role (`user`/`model`), text, timestamp

### 2. WhatsApp History (Real WhatsApp Messages)
- Retrieved via `getMessageHistory` tool during `whatsapp_action`
- Fetched from the backend server's in-memory message store
- Contains REAL WhatsApp conversations with contacts
- Provides context so Beatrice can reference specific WhatsApp chats

### Why Two?
- The app history is Beatrice's memory of what she and the user discussed
- The WhatsApp history is the user's REAL conversations with other people
- Beatrice needs both to function as a WhatsApp assistant

---

## 9. Audio Pipeline

**File**: `src/lib/audio.ts`

### AudioStreamer (TTS Playback)
```typescript
class AudioStreamer {
  audioCtx: AudioContext
  gainNode: GainNode
  queue: AudioBuffer[]
  isPlaying: boolean
  sampleRate: number  // 24000 Hz

  decodeAndEnqueue(base64PCM16: string)
  playNext()
  stop()
  pause() / resume()
}
```

- Decodes base64 → PCM16 samples → AudioBuffer (single channel, 24kHz)
- Queues audio chunks and plays sequentially
- Schedules next chunk playback based on audio duration
- Supports pause/resume/stop

### AudioRecorder (Mic Capture)
```typescript
class AudioRecorder {
  stream: MediaStream
  source: MediaStreamAudioSourceNode
  processor: AudioWorkletNode | ScriptProcessorNode
  isRecording: boolean

  start(onChunk: (base64: string) => void)
  stop()
}
```

Captures microphone audio and sends as base64 chunks to the Gemini Live API.

### AmbientConversationBed
Ambient background audio (optional, experimental). Plays a subtle background sound to create an "ambient conversation space."

---

## 10. Document Generation

### Client-side Flow
When `create_document` tool is called:

1. Type is determined (webpage, dashboard, report/document, summarize, code)
2. A SEPARATE Gemini session (non-voice model, `gemini-2.5-flash`) is created
3. A system prompt is sent based on document type:
   - **webpage**: Landing page with nav, hero, feature cards, footer. Dark theme + peach accent.
   - **dashboard**: Monitoring dashboard with metric cards, status indicators.
   - **report/document**: CEO-grade comprehensive document, ≥800 words, proper structure.
   - **summarize**: Structured summary.
   - **code**: Production-ready code.
4. HTML is returned to Gemini or opened in a new browser tab

### Legacy Server-side (Ollama)
`server/eburon.ts` contains an `EburonWorker` class that generates documents via Ollama (local LLM). This appears to be an older/alternative path — the primary document generation is now client-side via Gemini.

---

## 11. WhatsApp Integration

### Dual-Provider Architecture

| Provider | Library | When Used |
|---|---|---|
| `linked_device` | Baileys (`@whiskeysockets/baileys`) | Default. WhatsApp Web protocol. Phone must be online. |
| `cloud_api` | WhatsApp Cloud API (Meta Graph) | Fallback/alternative. Configured per-user in admin portal. |

### Frontend (User-facing)
- **WhatsAppSettings.tsx**: Pairing via QR code or phone number, permission toggles, status display
- Backend URL is stored in `localStorage` as `beatrice_backend_url` — auto-detects localhost vs production

### Backend (server/)
- **WhatsAppManager** class manages per-user sessions
- Sessions persisted via `useMultiFileAuthState` (saves `creds.json` to `.baileys_auth/<userId>/`)
- Auto-reconnect with exponential backoff (2s → 5s → 10s → 30s → 60s)
- Message history stored in memory (last 250 messages per user), periodically saved to disk
- Contacts enriched with `savedName` (what user saved), `whatsappProfileName` (pushName), `verifiedName` (business)
- JID resolution: name lookup (exact → notify → verified → partial) → phone number → raw JID

### Cloud API Support
- Configured via `/api/whatsapp/admin/config` endpoints
- Sends messages via `https://graph.facebook.com/<version>/<phoneNumberId>/messages`
- Webhook verification at `/api/whatsapp/webhook/:userId`
- Message ingestion from webhook payloads

### Permission Enforcement (Server-side)
`server/whatsapp-tools.ts` has 8 permission keys, checked at runtime:
```typescript
['send_messages', 'read_chats', 'access_contacts', 'manage_contacts',
 'access_groups', 'send_group_messages', 'read_group_chats', 'view_message_history']
```

### Key API Endpoints
| Method | Path | Purpose |
|---|---|---|
| POST | `/api/whatsapp/pair` | Start pairing (QR or phone number) |
| GET | `/api/whatsapp/status/:userId` | Get connection status |
| GET | `/api/whatsapp/messages/:userId` | Get recent messages |
| POST | `/api/whatsapp/send` | Send a text message |
| POST | `/api/whatsapp/tool` | Execute any WhatsApp tool |
| POST | `/api/whatsapp/disconnect` | Disconnect and delete session |
| GET | `/api/whatsapp/admin/overview/:userId` | Admin dashboard data |
| GET/POST | `/api/whatsapp/admin/config` | Admin config CRUD |
| GET/POST | `/api/whatsapp/webhook/:userId` | Cloud API webhook |
| POST | `/api/web/glance` | Web search (DuckDuckGo) |

---

## 12. Google Services Integration

All Google services use OAuth 2.0 tokens stored in `localStorage`:
- `beatrice_google_token` — Current access token
- `beatrice_google_refresh_token` — Refresh token
- `beatrice_google_uid` — Google user ID

### Supported Services

| Service | Tool | API Endpoint |
|---|---|---|
| Gmail (list) | `list_gmail_messages` | `https://gmail.googleapis.com/gmail/v1/users/me/messages` |
| Gmail (send) | `send_gmail_message` | `https://gmail.googleapis.com/gmail/v1/users/me/messages/send` |
| Calendar | `list_calendar_events` | `https://www.googleapis.com/calendar/v3/calendars/primary/events` |
| Tasks | `list_google_tasks` | `https://tasks.googleapis.com/tasks/v1/users/@me/lists` |
| Contacts | `google_contacts` | `https://people.googleapis.com/v1/people/me/connections` |

### Auth Flow
Google OAuth is initiated from `AuthPage.tsx` via Firebase `signInWithPopup(GoogleAuthProvider)`. The resulting credential's access token is stored in localStorage. Token refresh is handled by Firebase automatically, but the app also stores the refresh token for direct API calls.

---

## 13. Camera & Video

- Enabled by `toggle_camera` and `get_screenshot` tools
- Uses `navigator.mediaDevices.getUserMedia()` to get video stream
- Frames captured via `<canvas>` and sent as base64 JPEG to Gemini Live
- `switch_camera` tool toggles between front and back cameras (`facingMode: 'user'` vs `'environment'`)
- Video stream rendered in a small floating preview in the UI
- Can be toggled on/off during conversation

---

## 14. Database

### Firebase Firestore

**Collections:**
| Collection | Document ID | Fields |
|---|---|---|
| `messages` | Auto-ID | `userId`, `role` (user/model), `text`, `timestamp`, `personaName` |
| `user_settings` | `userId` | `permissions` (map of 10 booleans), `personaName`, `customPrompt` |

**Rules:**
- Messages are immutable: `allow update, delete: if false`
- User isolation: each user can only read/write their own data
- Timestamp validation: `== request.time`
- Field validation by whitelist
- Length limits: `personaName` ≤ 50, `customPrompt` ≤ 2000, `message.text` ≤ 5000

### Supabase

**Tables:**
- `messages` — Same structure as Firestore messages (dual-write or migration path)
- `user_settings` — User settings including permissions and persona config
- `knowledge_files` — User-uploaded files (avatars, knowledge base documents)

**Storage:**
- `knowledge_files` bucket for user-uploaded knowledge files
- Avatar images stored per-user

---

## 15. Server Backend

**Directory**: `server/`
**Entry**: `server/index.ts`
**Port**: 4200 (configurable via `SANDBOX_PORT` env var)

### Files

| File | Purpose |
|---|---|
| `index.ts` | Express app, all routes, middleware |
| `whatsapp.ts` | `WhatsAppManager` class — full WhatsApp session lifecycle |
| `whatsapp-tools.ts` | Permission-gated WhatsApp tool handlers |
| `eburon.ts` | Legacy Ollama-based document generator (`EburonWorker`) |
| `types.ts` | TypeScript interfaces for sandbox tasks |

### Running the Server
```bash
npm run dev    # Starts Vite dev server (port 3000) — does NOT start backend
```
The backend server must be started separately:
```bash
cd server && npx tsx index.ts
# or if using the project's package:
npx tsx server/index.ts
```

---

## 16. Key Files & Responsibilities

### Source Files

| File | Size | Responsibility |
|---|---|---|
| `src/components/BeatriceAgent.tsx` | ~3642 lines | Everything: prompt, session, tools, execution, UI |
| `src/App.tsx` | ~200 lines | Auth state orchestrator, routing |
| `src/components/AuthPage.tsx` | ~300 lines | Auth UI + Google OAuth |
| `src/components/EntryFlow.tsx` | ~200 lines | Splash + Onboarding flow |
| `src/components/WhatsAppSettings.tsx` | ~300 lines | WhatsApp pairing + permission toggles |
| `src/components/ProfilePage.tsx` | ~250 lines | User profile + knowledge files management |
| `src/components/ChatPage.tsx` | — | Chat UI for non-voice mode |
| `src/components/UnifiedTranscript.tsx` | — | Animated word-by-word transcript |
| `src/lib/audio.ts` | ~200 lines | AudioStreamer + AudioRecorder |
| `src/lib/whatsappClient.ts` | ~150 lines | WhatsApp backend API client |
| `src/lib/supabase.ts` | ~50 lines | Supabase client setup |
| `src/lib/supabaseStorage.ts` | ~150 lines | File upload/list/delete to Supabase Storage |
| `src/lib/webClient.ts` | ~50 lines | Web glance API client |
| `src/firebase.ts` | ~50 lines | Firebase init + error handler |
| `src/constants.ts` | ~200 lines | Language list (~190 languages) |
| `src/index.css` | 1 line | `@import "tailwindcss"` |

### Config Files

| File | Purpose |
|---|---|
| `vite.config.ts` | Vite config: path alias, Tailwind v4, env injection |
| `package.json` | Dependencies, scripts |
| `tsconfig.json` | TypeScript config |
| `.env.example` | All env vars with descriptions |
| `supabase-migration.sql` | Full Supabase schema |
| `firebase-applet-config.json` | Firebase project config |
| `firebase-blueprint.json` | Firestore schema blueprint |
| `firestore.rules` | Firestore security rules |
| `public/reference-ui.html` | Canonical landing page design reference |

### Server Files

| File | Purpose |
|---|---|
| `server/index.ts` | Express app, all API routes |
| `server/whatsapp.ts` | WhatsAppManager (Baileys + Cloud API) |
| `server/whatsapp-tools.ts` | Permission-gated tool handlers |
| `server/eburon.ts` | Legacy Ollama document generation |
| `server/types.ts` | Sandbox task types |

---

## 17. Development Setup

### Prerequisites
- Node.js 18+
- A Gemini API key (`.env.local` → `GEMINI_API_KEY`)
- Firebase project (config hardcoded in `firebase.ts`)
- Supabase project (URL + anon key in `.env.local`)

### Install & Run
```bash
cd /path/to/voxx
npm install
cp .env.example .env.local    # Fill in GEMINI_API_KEY + Supabase + Firebase vars
npm run dev                    # Vite at http://localhost:3000

# In separate terminal (for WhatsApp support):
npx tsx server/index.ts        # Backend at http://localhost:4200
```

### Environment Variables
| Variable | Required | Description |
|---|---|---|
| `GEMINI_API_KEY` | Yes | Google AI API key for Gemini |
| `VITE_SANDBOX_URL` | Backend | Backend URL (default: http://localhost:4200) |
| `SANDBOX_PORT` | Backend | Server port (default: 4200) |
| `SANDBOX_ROOT` | Backend | Output directory for generated artifacts |
| `WA_AUTH_ROOT` | Backend | WhatsApp auth data directory |
| `WA_LOG_LEVEL` | No | Baileys log level: silent/error/warn/info/debug |
| `VITE_GOOGLE_CLIENT_ID` | Google OAuth | Google OAuth client ID |
| `GOOGLE_CLIENT_ID` | Google OAuth | Server-side Google client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth | Server-side Google client secret |
| `VITE_FIREBASE_*` | Firebase | Firebase config (API key, project ID, etc.) |
| `APP_URL` | Deploy | Auto-injected by AI Studio for Cloud Run |
| `DISABLE_HMR` | No | Set `true` to disable HMR (AI Studio compat) |

### Available Commands
```bash
npm run dev    # Start Vite dev on port 3000
npm run build  # Production build
npm run lint   # TypeScript type-check (tsc --noEmit) only
```
There is no test framework, no CI, no pre-commit hooks.

---

## 18. Critical Rules & Pitfalls

### VOICE_PERSONALITY_PROMPT
- **DO NOT** edit casually. It defines the entire agent persona. Small changes alter Beatrice's behavior dramatically.
- It's hardcoded in `BeatriceAgent.tsx` — not a separate file, not an import.
- The prompt uses Irish English grammar — keep consistent if editing.

### Permission System
- **Permissions default to ALL FALSE**. Never change defaults.
- Permission changes require session reconnect (system instruction frozen per session).
- Two permission checkpoints: model-level (system instruction) + execution-level (handler).

### Gemini Live Session
- System instruction is FIXED for the lifetime of a Live session. Dynamic prompts are assembled before `startSession()`.
- Audio modality is PCM16, single channel, 24kHz sample rate.
- Tool results are sent back via `clientSocket.sendToolResponse()`, NOT as a return value.

### The `onmessage` Callback
- This is a SINGLE function that handles ALL Gemini Live events. Adding a new tool?
  1. Add tool declaration to the declarations array
  2. Add execution case to the switch statement
  3. Both inside the same `onmessage` closure

### Server & WhatsApp
- Backend server is SEPARATE from Vite — must be started manually.
- WhatsApp Baileys sessions are stored in `.baileys_auth/<userId>/`. Delete these to force re-pair.
- Auto-reconnect has exponential backoff — can take up to 60s between retries.
- Message history is IN-MEMORY (last 250 messages). Not persisted long-term.

### Google OAuth
- Tokens stored in `localStorage` — lost on browser clear or incognito.
- Token refresh is handled by Firebase, but direct API calls use the stored token.
- User must re-link Google account if tokens expire.

### Document Generation
- Creates a SEPARATE Gemini session (non-voice), which costs additional tokens.
- The system prompts for doc types are duplicated: one set in the `VOICE_PERSONALITY_PROMPT` (for the model's reference) and one set actually used in the generation call.

### Messages are Immutable
- Firestore rules prevent updating or deleting messages.
- Never attempt to edit/delete messages in code.

### No Tests, No CI
- There is zero test coverage. No CI pipeline.
- `npm run lint` runs only `tsc --noEmit` — no ESLint, no Prettier.
- Validate changes by running the app and testing manually.

### BeatriceAgent.tsx Size
- **3642 lines, ~2MB**. This is the single most critical file.
- When editing, be careful of the massive `switch` statement in `onmessage`.
- Always search for existing patterns before adding new code.
- The file mixes prompt engineering, API integration, state management, and UI rendering in one component.
