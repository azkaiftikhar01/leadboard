# Leadboard

A voice-first team lead cockpit that lives in the macOS menu bar, built for a lead
with ADHD.

Replaces the paper notebook: he talks, the system structures. The morning standup
becomes a five-minute guided ritual instead of a blank page. Dev performance —
rework, deliveries, deadlines — is derived from work that already happens, never
hand-maintained.

## Layout

| Dir | What |
|---|---|
| `desktop/` | Electron main process — tray, popover, ⌥Space capture overlay, notifications |
| `fe/` | Vite + React 19 renderer. One bundle serves all three shells |
| `be/` | Express + MongoDB API — capture parsing, standup, registry |
| `docs/` | Approach, user flows, data model, shell decision, roadmap |

## Running it

```bash
# 1. Mongo (not installed yet on this machine)
brew tap mongodb/brew && brew install mongodb-community
brew services start mongodb-community

# 2. API
cd be && cp .env.example .env      # add ANTHROPIC_API_KEY + OPENAI_API_KEY
npm install && npm run seed && npm run dev

# 3. Renderer
cd fe && npm install && npm run dev

# 4. Desktop shell
cd desktop && npm install && npm run dev
```

The tray icon appears in the menu bar. `⌥Space` captures from anywhere,
`⌘⇧L` opens the main window.

For a browser-only run, skip step 4 and open `http://localhost:5173`.

### Keys

| Var | Where | Why |
|---|---|---|
| `ANTHROPIC_API_KEY` | `be/.env` | Capture parsing (`claude-opus-5`) |
| `OPENAI_API_KEY` | `be/.env` | Whisper transcription, ~$1/month at his volume |

Swap transcription with `STT_PROVIDER=deepgram`, or drop in a local `whisper.cpp`
adapter later — raw audio is retained, so switching never costs history.

## Docs

- [docs/APPROACH.md](docs/APPROACH.md) — the product thinking
- [docs/DESKTOP.md](docs/DESKTOP.md) — why menu bar, why Electron, the speech constraint
- [docs/USERFLOWS.md](docs/USERFLOWS.md) — screen-by-screen flows
- [docs/DATA-MODEL.md](docs/DATA-MODEL.md) — collections and the scoring rules
- [docs/ROADMAP.md](docs/ROADMAP.md) — build phases
