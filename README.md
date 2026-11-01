# MacroMaster

**MacroMaster is an intent-driven AI guidance prototype that turns a user-defined goal into a structured project blueprint and provides contextual assistance as the user works through it.**

Built as a browser-based React application, MacroMaster follows a three-stage workflow: classify a goal, generate a project manifest, and guide execution against that manifest. Its intended scope spans hardware engineering, software development, culinary tasks, mechanical repairs, creative writing, and general-purpose projects.

> **Status:** Prototype / work in progress. The supplied source includes incomplete integrations. This document describes the implementation rather than claiming production readiness.

## How it works

1. **Scout — classify intent.** The user provides a goal and optionally attaches supporting files. The application asks Gemini to identify the task domain and refine the objective.
2. **Forge — generate the project manifest.** Gemini generates a resource inventory, ordered blueprint steps, hazard notes, and a feasibility assessment (`GO`, `CAUTION`, or `NO_GO`) with critical gaps.
3. **Guide — work through the blueprint.** The interface presents contextual chat alongside project steps, resources, and progress tracking.

## Capabilities represented in the source

- Domain-aware intent classification and blueprint generation.
- Resource inventory, feasibility summary, and step-by-step progress checklist.
- Contextual chat based on the active project manifest.
- Text and file attachments during initial intent capture.
- Client-side image compression and canvas-based annotations.
- Image attachment interface in chat.
- Browser speech recognition and text-to-speech, where supported.
- Session, project, and API-key persistence using browser `localStorage`.
- Basic API rate-limit/error feedback and cooldown handling.

## Technology

- React 19 and TypeScript
- Vite 6
- Google Gen AI SDK (`@google/genai`)
- Tailwind CSS via CDN
- Browser Canvas, FileReader, Web Speech APIs, and `localStorage`

The code selects `gemini-2.0-flash-exp` for Scout and `gemini-2.0-pro-exp-02-05` for Forge and Guide. Although the supplied `metadata.json` refers to Gemini 3 Pro, those are **not** the model IDs selected in `geminiService.ts`. The experimental model IDs may be unavailable.

## Run locally

**Prerequisites:** Node.js, npm, a Gemini API key, and a compatible browser.

```bash
git clone https://github.com/Justinhubbard37/MacroMaster.git
cd MacroMaster
npm install
```

Create a local `.env.local` file:

```dotenv
GEMINI_API_KEY=your_api_key_here
```

Run the development server:

```bash
npm run dev
```

Open `http://localhost:3000`.

For a production build and local preview:

```bash
npm run build
npm run preview
```

**API-key handling:** The current implementation also asks for a key in its interface and saves that key in browser `localStorage`. Vite's `define` configuration also makes the environment-provided key accessible to client-side code. Neither method is a secure server-side secret store. Do not commit real API keys or deploy this prototype publicly with a privileged key.

## Project structure

```text
App.tsx                     Main application flow and session initialization
components/
  ApiKeyGate.tsx            API-key entry interface
  IntentEngine.tsx          Scout/Forge workflow, uploads, and manifest review
  ChatInterface.tsx         Guided chat, resources, blueprint, and voice controls
  ImageAnnotator.tsx        Canvas-based image markup
services/
  geminiService.ts          Scout, Forge, and Guide model requests
utils/
  audioUtils.ts             Speech synthesis and recognition helpers
  imageUtils.ts             Image compression
  storageUtils.ts           Browser-local session and API-key storage
types.ts                    Domain, resource, step, manifest, and session types
index.tsx                   React entry point
index.html                  HTML document and styling configuration
vite.config.ts              Vite configuration
tsconfig.json               TypeScript configuration
package.json                Dependencies and development scripts
metadata.json               App metadata
```

## Known implementation gaps

These findings come from examination of the supplied project archive and are **not** fixes made to the source:

- **Gemini API integration:** Calls use `response.text()`, which may not match the SDK response shape in the specified dependency version; model IDs are experimental/legacy. Runtime compatibility is unverified.
- **Chat image input:** The chat interface accepts and stores images, but `consultGenie` builds text-only Gemini message parts and does not forward the attached image bytes.
- **Resource-to-step linking:** Generated manifest steps are initialized with empty `resourcesRequired` arrays; actual resource gating is not implemented.
- **Missing stylesheet:** `index.html` references `/index.css`, but that file is absent from the supplied archive. Tailwind is instead loaded through a CDN.
- **Native speech:** Capacitor-specific branches contain placeholders; browser speech APIs provide the current implementation.
- **Automated tests:** No test suite or test script was included.

## Origin and licensing

The project was supplied as a Google AI Studio application export. [Original AI Studio app](https://ai.studio/apps/drive/1XCvNyNeYba9CrVkNgH0_tzHwIB2-NeQp).

No license file was included in the source archive. Repository visibility alone does not grant an open-source license.
