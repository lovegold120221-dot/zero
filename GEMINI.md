# Voxx-Zero: Belgian AI Voice Assistant

Voxx-Zero is a highly specialized, sovereign voice AI assistant tailored for the Belgian market. It leverages the **Gemini Live API** for real-time bidirectional audio and features a suite of 10 administrative tools designed to reduce "Belgian Paperwork" friction.

## 🏗️ Architecture & Technology Stack

- **Frontend:** React 19, Vite, Tailwind CSS v4, Framer Motion.
- **Backend:** Express API (TypeScript) running on Node.js.
- **AI Core:** Gemini Live API (real-time PCM16 streaming).
- **Identity & Auth:** Firebase Authentication (Google OAuth).
- **Database & Storage:** Supabase (PostgreSQL for user settings/tool outputs, Storage for knowledge files).
- **Integrations:**
  - **WhatsApp:** `@whiskeysockets/baileys` (Multi-device session management).
  - **Google Services:** Gmail, Calendar, Drive, Tasks, YouTube.
  - **Belgian Tools:** KBO/CBE lookup, VIES VAT validation, Peppol E-Invoicing, Tax calculators, etc.

## 📁 Project Structure

- `/src`: Frontend application.
  - `/components`: Core UI including `BeatriceAgent.tsx` (the main AI orchestration component).
  - `/lib`: Client-side services (Supabase, Audio Pipeline, WhatsApp/Web clients).
- `/server`: Express backend.
  - `index.ts`: API entry point and tool routing.
  - `belgian-tools.ts`: Business logic for the 10 Belgian administrative tools.
  - `whatsapp.ts`: Session management for WhatsApp clients.
- `/docs`: Architecture diagrams (Mermaid).
- `/public`: Static assets, audio chimes, and HTML document templates used by Gemini for artifact generation.

## 🚀 Key Commands

- `npm run dev:full`: Starts both the Vite frontend (port 3000) and Express backend (port 4200) concurrently.
- `npm run dev`: Starts only the Vite frontend.
- `npm run dev:api`: Starts only the Express backend using `tsx`.
- `npm run build`: Generates the production build in `/dist`.
- `npm run lint`: Runs TypeScript type checking.

## 🛠️ Development Conventions

### State & Data Flow
- **Supabase as Source of Truth:** All tool results and generated documents must be saved to the `tool_outputs` table. The UI (`DocumentViewer`) should only render data fetched from Supabase by ID.
- **Audio Pipeline:** Real-time audio is handled via `AudioStreamer` and `AudioRecorder` in `src/lib/audio.ts`, communicating with Gemini over WebSockets.

### Tool Implementation
- **Client-Side vs. Server-Side:** Google Services tools are typically handled client-side in `BeatriceAgent.tsx` (using the user's browser token). WhatsApp and Belgian tools are proxied through the Express backend to handle session isolation and complex logic.
- **Privacy:** WhatsApp sessions are isolated per user in the `.baileys_auth` directory and never exposed to the client.

### UI/UX
- **Vanilla CSS + Tailwind:** Styling is a mix of Tailwind CSS v4 and custom CSS for high-fidelity interactive elements.
- **Document Generation:** Gemini generates standalone HTML documents using templates from `/public`. These are displayed as interactive artifacts in the workspace.

## 🇧🇪 The 10 Belgian Tools
1. KBO/CBE Company Intelligence
2. VIES VAT Validation
3. Peppol E-Invoicing Generator
4. Registration Tax Calculator
5. Tax & VAT Calendar Alerts
6. "Itsme" Integration Navigator
7. Bilingual Business Bridge (FR ↔ NL)
8. Social Security Navigator (RSZ/ONSS)
9. Labor Law Simplifier
10. Belgian Mobility Planner (NMBS/STIB)
