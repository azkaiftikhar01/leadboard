# Shell decision: macOS menu-bar app (Electron)

## Verdict

**Desktop-first, as a macOS menu-bar app — not a browser tab, not mobile.**

He is at the laptop all day. A browser tab is the wrong container for this product for one
reason: a tab has to be *found*. It gets buried behind twenty others, it dies on restart,
and it can't reach him when it isn't focused. The paper notebook beat the tab because the
notebook was always lying open next to him.

The menu bar is the digital version of "lying open next to him".

## What the shell buys us

| Capability | Menu-bar app | Browser tab | Mobile |
|---|---|---|---|
| Always-visible status at a glance | ✅ tray icon | ❌ | ❌ |
| Reaches him when unfocused | ✅ native notifications | ⚠️ only while open | ✅ but wrong device |
| Capture without leaving current app | ✅ global hotkey | ❌ | ❌ |
| Survives restart | ✅ launch at login | ❌ | — |
| Zero-navigation surface | ✅ popover | ❌ | ✅ |

## The four surfaces

**1. Tray icon — ambient status.** Carries live state without being opened: streak flame,
a badge count of *waiting on me* items, a red dot when a deadline enters the risk window.
He learns to read it peripherally, the way people read an unread badge.

**2. Popover panel (≈380×560) — the 90% surface.** Click the tray icon: today's list, the
mic button, the owe-list, one-tap clears. Most days he never opens anything else.

**3. Global hotkey (⌥Space) — capture from anywhere.** Overlay appears over whatever app
he's in, he talks, confirms the chips, it's gone. Under ten seconds, zero context switch.
This is the capture-cheaper-than-paper promise actually delivered — paper still requires
picking up a pen and finding the page.

**4. Main window — depth on demand.** Board, People, Review. Opened when he needs to dig,
which is not most of the time.

## Native notifications (the reason paper loses)

- Standup nudge at his set time — the streak's alarm clock
- Deadline entering risk window
- End-of-day sweep prompt
- Staleness: "Asad has been on the widespace fix for 4 days"
- Unblock nag on anything in *waiting on me* older than a day

Notification actions ("Clear", "Snooze", "Open") handle a good share of these without
opening the app at all.

## Electron over Tauri

Tauri is the lighter binary, but Electron wins here on the things that matter for a
one-user internal tool:

- Same Chromium as dev-in-browser, so `fe/` runs unchanged in both — one codebase, no
  WKWebView divergence to debug
- Team is already JS-only; Tauri means a Rust toolchain for zero benefit at this scale
- Bundle size is irrelevant for an app installed once on one machine

## Speech: two paths, picked automatically

**In the browser, Chrome's `SpeechRecognition` is the right answer** - free, no key,
no account, no download, and it streams words live as he talks so he can see it heard
him. That is the path whenever it exists.

**It does not exist in packaged Electron.** Electron's Chromium ships without Google's
speech service keys, so `webkitSpeechRecognition` is dead there. This is a known
limitation, not something we can configure around.

So the app falls back to running Whisper itself, locally in the renderer - WebGPU where
available, WASM otherwise. Also free, also no key, and it works offline. It costs a
one-off ~150MB model download, so it is never fetched unless it is actually the path in
use. The browser never pays for it.

The switch is automatic, and it also catches the case where Google's endpoint is simply
unreachable mid-capture: the recorded audio is always kept, so the fallback re-transcribes
rather than losing what he said.

Paid providers stay available behind the same adapter for anyone who wants lower latency,
but nothing requires one:

```
be/src/services/stt/
  index.js        ← adapter, picks provider from env
  (client)        ← browser speech, or local Whisper — default, free
  whisper.js      ← OpenAI Whisper API   — optional, needs a key
  deepgram.js     ← lower latency        — optional, needs a key
```

## Desktop-specific interaction changes

He is at a keyboard, so the ritual is keyboard-driven, not swipe-driven:

- Standup advances on `→` / `Enter`, chips confirm on `Enter`, discard on `⌫`
- `⌥Space` capture from anywhere
- `⌘K` command palette over projects, people, tasks
- Popover closes on `Esc`, never traps him

## Delivery

- `desktop/` — Electron main process: tray, popover, global shortcut, notifications,
  launch-at-login, `LSUIElement` (no dock icon)
- `fe/` — the same Vite + React 19 app, loaded by the popover, the overlay and the main window
- `be/` — Express + Mongo, run locally alongside; nothing leaves the machine except the
  audio clip going to the STT provider
