# Build phases

Each phase is usable on its own — nothing here needs the next phase to have value.

**P0 · Skeleton**
Repo, auth, data model, projects/tasks/people CRUD, board with the state machine.
Manual entry only. Proves the transitions before anything is built on top of them.

**P1 · Capture — the spine**
Mic → live transcript (Web Speech API, audio blob retained) → Claude parse into typed
entities → confirm-cards → apply. Inbox for anything unresolved.
*This is the phase that decides whether he keeps using it.*

**P2 · Standup ritual**
Pre-generated project cards, the swipe stack, digest generation, copy/share out.
Streak counter lands here — the habit needs its reward from day one.

**P3 · Registry**
Reopen reason tap, ReworkEvent, deliveries, deadline tracking, dev player cards,
drilldown to source events.

**P4 · Playful layer**
Board-clear animation, XP, milestone confetti, daily nudge, sound/haptics, offline.

**P5 · Outward**
Slack/WhatsApp digest push, read-only dev view so devs update their own tasks,
weekly review export.

## Stack

Matching the house convention in the sibling repos:

- **fe** — Vite + React 19, react-router, plain CSS
- **be** — Express + Mongoose + zod
- **desktop** — Electron: tray, popover, global shortcut, native notifications
- **speech** — Whisper running locally in the renderer (WebGPU / WASM). Free, offline,
  no key. Paid providers optional behind the same adapter
- **parsing** — rules-based by default, no model and no network. Ollama or Claude are
  drop-in upgrades over the same interface
