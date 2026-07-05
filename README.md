# Beatrice — AI Voice Agent

**Beatrice** is a real-time voice AI agent powered by the **Gemini Live API**. It features WhatsApp integration, multi-language support, a persistent memory system, a Cerebras-powered browser automation agent, and 10 specialized Belgian administrative tools. Built by [Eburon AI](https://eburon.ai).

---

## Architecture

```
┌─────────────────────────────────────────────────┐
│                  Frontend (React 19 + Vite)      │
│  ┌──────────┐ ┌──────────┐ ┌─────────────────┐  │
│  │  Voice   │ │  Chat    │ │   Eburon PC      │  │
│  │  Pipeline│ │  Page    │ │   Sandbox Viewer │  │
│  └──────────┘ └──────────┘ └─────────────────┘  │
│  ┌──────────┐ ┌──────────┐ ┌─────────────────┐  │
│  │ Profile  │ │ Settings │ │   Theme System   │  │
│  │   Page   │ │  Panel   │ │  Dark / Light    │  │
│  └──────────┘ └──────────┘ └─────────────────┘  │
├─────────────────────────────────────────────────┤
│           Backend (Express + tsx)                │
│  ┌──────────┐ ┌──────────┐ ┌─────────────────┐  │
│  │ Baileys  │ │ Belgian  │ │   Sandbox Sub-   │  │
│  │ WhatsApp │ │  Tools   │ │   Agent Runner   │  │
│  └──────────┘ └──────────┘ └─────────────────┘  │
│  ┌──────────┐ ┌──────────┐ ┌─────────────────┐  │
│  │ Cerebras │ │  Ollama  │ │   Web Glance     │  │
│  │  Browser │ │  Proxy   │ │   (DuckDuckGo)   │  │
│  └──────────┘ └──────────┘ └─────────────────┘  │
├─────────────────────────────────────────────────┤
│            AI Layer                              │
│  ┌─────────────────────────────────────────┐    │
│  │  Gemini Live API (gemini-2.5-flash-     │    │
│  │  native-audio-preview-12-2025)          │    │
│  │  + Google Search Grounding              │    │
│  └─────────────────────────────────────────┘    │
├─────────────────────────────────────────────────┤
│            Data Layer                            │
│  ┌──────────┐ ┌──────────┐ ┌─────────────────┐  │
│  │ Supabase │ │ Firebase │ │   IndexedDB      │  │
│  │(Postgres)│ │  Auth    │ │  (local workspace)│  │
│  └──────────┘ └──────────┘ └─────────────────┘  │
└─────────────────────────────────────────────────┘
```

### Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 19, Vite 6, Tailwind CSS v4, `motion` (Framer Motion) |
| **Backend** | Express 4, tsx runtime, Node 22+ |
| **AI Voice** | Gemini 2.5 Flash Native Audio (`gemini-2.5-flash-native-audio-preview-12-2025`) |
| **Auth** | Firebase Auth (Google OAuth) |
| **Database** | Supabase (PostgreSQL + Storage) |
| **WhatsApp** | Baileys (`@whiskeysockets/baileys`) |
| **Hosting** | Ubuntu VPS + PM2 + Traefik + Let's Encrypt |

---

## Features

### 🎙️ Real-Time Voice
- Low-latency PCM16 bidirectional audio streaming via WebSocket
- Gemini 2.5 Flash with native audio support
- Voice activity detection and interruption handling
- Ambient sound (office/cafe background bed)
- 5 selectable voice profiles (Aoede, Fenrir, Kore, Puck, Charon)

### 💬 WhatsApp Integration
- Pair via QR code or OTP (country-code-aware)
- Full history sync on pairing with auto-sync trigger
- Real-time message streaming via SSE (`/api/whatsapp/stream/:userId`)
- Send/receive messages, read chats, manage contacts and groups
- All permissions default-enabled on pair
- Auto Belgian phone normalization (`04xx` → `+324xx`)
- Contact names resolved from WhatsApp profile names + phonebook
- **Provider**: Baileys exclusively (Go WhatsApp removed)

### 🧠 Memory System
- `add_to_memory` — save facts, preferences, and personal info
- `search_memory` — retrieve past memories via full-text search
- 10 most recent memories pre-loaded at session start
- Stored in Supabase `memories` table with tags

### 🧩 Sandbox Sub-Agent
- `run_sandbox_task` — delegate complex tasks to a secondary AI
- Uses Gemini API directly (free tier) or OpenCode CLI
- Returns compressed results — keeps main agent context clean
- Results rendered in Eburon PC sandbox viewer

### 🌐 Cerebras Browser Agent
- `cerebras_browser_task` — automated web browsing via Browser-Use
- Powered by Cerebras inference (`gpt-oss-120b` or `zai-glm-4.7`)
- Chromium headless browser, Playwright-based
- Sub-second latency for page interactions
- Python wrapper at `scripts/cerebras_browser.py`

### 🎭 Human Voice Personality
- 100+ human vocal expressions: laughter, sighs, humming, throat clears, exclamations
- Dynamic emotional modulation per context (excited, thoughtful, frustrated, flirty)
- Language-adaptive expressions: French "ouf!", Filipino "hay nako!", Dutch "he hè!"
- 80/20 vocal balance rule — mostly clean speech with natural expressions
- 460-line voice personality prompt defining the Beatrice persona

### 🔄 WebSocket Stability & Auto-Reconnect
- Exponential backoff reconnection (1s → 2s → 4s → 8s → 16s)
- Saved conversation context restored on reconnect
- Audio recorder `killed` flag prevents flood on session close
- `onclose` auto-reconnects; `onerror` no longer kills session
- `sendToolResponse` wrapped in try/catch

### ⏰ Temporal Awareness
- Relative timestamps injected into conversation history (5s ago, 3m ago, 2h ago)
- Beatrice knows exactly when the last conversation happened
- Current date/time injected in system prompt for time-aware responses

### ⚡ Real-Time Settings Sync
- Persona name, user title, language changes sync to active session immediately
- No restart needed when changing settings mid-conversation
- Tracking refs detect what changed and send system update to Live session

### 🎵 Audio Feedback
- Clean connect chime: C-E-G rising arpeggio
- Clean disconnect chime: G-D-A falling pattern
- Generated via Web Audio API — no audio files needed

### 🇧🇪 Belgian Administrative Tools
| Tool | What it does |
|---|---|
| **company_lookup** | KBO/CBE enterprise registry lookup |
| **vies_vat_validate** | EU VAT number validation |
| **peppol_invoice** | UBL 2.1 e-invoice generation |
| **tax_calendar** | VAT, income tax, social security deadlines |
| **registration_tax_calc** | Property registration tax (Flanders/Wallonia/Brussels) |
| **itsme_navigator** | Itsme digital identity guides |
| **language_bridge** | FR ↔ NL ↔ EN translation with cultural context |
| **social_security_navigator** | Healthcare reimbursement guidance |
| **labor_law_simplifier** | Notice periods, indexation, 13th month |
| **mobility_planner** | NMBS/SNCB train routing |

### 🌓 Theme System
- Full dark + light themes with CSS custom properties
- 70+ CSS override rules for light mode compatibility
- All pages: Chat, Video, Profile, Settings — theme-aware
- Persistent in `localStorage` + synced via Supabase

### 🗣️ Multi-Language
- 147 languages in the dropdown (shared `constants.ts`)
- Flemish (`nl-BE`) as primary Belgian language
- `set_user_language` tool — change language via voice
- `translate_message` tool — translate text naturally
- Language instruction enforced in system prompt

### 🧹 Content Filtering
- Toggle in Profile → Content Filtering
- When disabled: agent will not refuse, moralize, or censor
- When enabled: standard content safety applied
- Stored in `user_settings.censorship_enabled`

---

## Quick Start

### Prerequisites
- Node.js 22+
- A Gemini API key ([Google AI Studio](https://aistudio.google.com))
- A Supabase project
- A Firebase project (for auth)

### Local Development
```bash
# Clone & install
git clone https://github.com/lovegold120221-dot/stunning-goggles.git
cd stunning-goggles
npm install

# Set up environment
cp .env.example .env
# Add your API keys: GEMINI_API_KEY, SUPABASE_*, FIREBASE_*

# Start both servers
npm run dev:full

# Or separately:
npm run dev         # Frontend on :3000
npm run dev:api     # Backend on :4200
```

### Database Setup
Run in Supabase SQL Editor:
1. `supabase-migration-settings.sql` — fixes `user_settings` schema
2. `supabase-migration-memories.sql` — creates `memories` table

### Cerebras Browser Setup (optional)
```bash
bash scripts/setup-cerebras.sh     # Install Python deps
# Add CEREBRAS_API_KEY to .env
python3 scripts/cerebras_browser.py --task "Go to example.com"
```

---

## Deployment

### VPS (Production)
```bash
# Build
npm run build

# Run with PM2
pm2 start server/index.ts --interpreter node_modules/.bin/tsx --name voxx-backend
pm2 save
pm2 startup
```

The app runs on port 4200. A reverse proxy (Traefik, Nginx) handles HTTPS and domain routing. The production URL is `https://whatsapp.eburon.ai`.

### Firebase Hosting (Static Frontend)
```bash
firebase deploy --only hosting
```

The API requires a Cloud Function proxy or a separate VPS backend.

---

## Project Structure

```
src/
├── components/
│   ├── BeatriceAgent.tsx    # Main agent: voice, tools, session lifecycle
│   ├── ChatPage.tsx          # Text chat interface
│   ├── VideoPage.tsx         # Camera and screen sharing
│   ├── ProfilePage.tsx       # User settings: persona, language, memory
│   ├── AuthPage.tsx          # Login / register forms
│   ├── EntryFlow.tsx         # Splash → Onboarding
│   ├── WhatsAppOnboarding.tsx # WhatsApp pairing wizard
│   ├── WhatsAppSettings.tsx  # WhatsApp permissions & pairing
│   ├── WhatsAppChatList.tsx  # WhatsApp chat browser
│   ├── DocumentViewer.tsx    # Eburon PC sandbox iframe viewer
│   └── UnifiedTranscript.tsx # Animated word-by-word transcript
├── lib/
│   ├── audio.ts             # AudioStreamer + AudioRecorder
│   ├── supabase.ts          # Supabase client
│   ├── supabaseStorage.ts   # File uploads
│   ├── whatsappClient.ts    # WhatsApp API client
│   ├── belgianClient.ts     # Belgian tools client
│   ├── webClient.ts         # Web glance client
│   └── workspace.ts         # IndexedDB workspace + Drive upload
├── constants.ts             # Shared LANGUAGES array
├── firebase.ts              # Firebase init
└── index.css                # Theme system + Tailwind

server/
├── index.ts                 # Express server: all routes
├── whatsapp.ts              # WhatsAppManager (Baileys)
├── whatsapp-tools.ts        # Permission-gated tool dispatch
├── belgian-tools.ts         # 10 Belgian admin tools
├── supabase.ts              # Server Supabase client
└── types.ts                 # Shared types

scripts/
├── cerebras_browser.py      # Browser-Use + Cerebras wrapper
└── setup-cerebras.sh        # Python dep installer
```

---

## API Endpoints

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/health` | Health check |
| POST | `/api/whatsapp/pair` | Start WhatsApp pairing |
| GET | `/api/whatsapp/qr/:userId` | Get QR code PNG |
| GET | `/api/whatsapp/status/:userId` | Check pairing status |
| POST | `/api/whatsapp/send` | Send WhatsApp message |
| POST | `/api/whatsapp/tool` | Execute WhatsApp tool |
| POST | `/api/whatsapp/disconnect` | Unpair device |
| POST | `/api/belgian/tool` | Belgian admin tools |
| POST | `/api/sandbox/run` | Sandbox sub-agent |
| POST | `/api/cerebras/browser` | Cerebras browser agent |
| POST | `/api/web/glance` | DuckDuckGo search |
| POST | `/api/ollama/generate` | Ollama proxy |

---

## Environment Variables

| Variable | Required | Purpose |
|---|---|---|
| `GEMINI_API_KEY` | ✅ | Gemini Live API |
| `SUPABASE_URL` | ✅ | Supabase project URL |
| `SUPABASE_PUBLISHABLE_KEY` | ✅ | Supabase anon key |
| `VITE_FIREBASE_*` | ✅ | Firebase config |
| `GOOGLE_CLIENT_ID` | ✅ | Google OAuth |
| `GOOGLE_CLIENT_SECRET` | ✅ | Google OAuth |
| `WHATSAPP_ACCESS_TOKEN` | ⬜ | WhatsApp Cloud API |
| `CEREBRAS_API_KEY` | ⬜ | Browser automation |
| `WA_AUTH_ROOT` | ⬜ | Baileys auth path |

---

## License

Private Project — Eburon AI / Beatrice

Built by [Eburon AI](https://eburon.ai) — founded by Jo Lernout.
