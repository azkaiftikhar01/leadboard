# User flows

## Screens

| Screen | Purpose |
|---|---|
| **Today** | Landing. Mic FAB, streak, "waiting on me", today's deadlines |
| **Standup** | The morning ritual — card stack, one per project, ends in a digest |
| **Board** | Projects → tasks, kanban-lite, the source of truth |
| **People** | Dev player cards + drilldown to the tasks behind each number |
| **Inbox** | Captures the parser couldn't fully resolve — one swipe to place |
| **Notes** | Voice notes attached to project/dev/task, summarized, searchable |
| **Review** | Weekly retro, auto-generated from the week's events |

## Flow 1 — Morning standup (the primary loop, ~5 min)

1. Opens app → streak badge ("6 day streak") + **Start standup · 4 projects**
2. **Project card 1 of 4** shows, pre-filled:
   - Asad → widespace fix · day 3 · 🔴 blocked on Sara (figma)
   - Bilal → checkout API · day 1 · on track
   - ⚠️ client demo Thursday · 2 days out
3. He taps mic and talks freely through it.
4. Parsed items surface as chips beneath the card as he speaks.
5. Confirm / edit / discard — chips he ignores expire, they don't get created.
6. Swipe → next project. Repeat.
7. **Digest screen**:
   - *Ask from* — Sara: figma for widespace · Client: demo scope
   - *I owe* — Asad: staging key · Bilal: API contract review
   - *At risk* — client demo Thu (blocked chain), payments milestone Fri
8. One tap → copy to clipboard / share to Slack.
9. Streak increments. Board updates.

## Flow 2 — Ad-hoc capture (all day, ~10 sec)

1. Mic FAB from anywhere (also a global keyboard shortcut on desktop).
2. Speaks. Live transcript visible so he can see it heard him.
3. Release → confirm-cards.
4. Resolvable items apply immediately. Ambiguous ones → Inbox with a badge count.

## Flow 3 — Closing the loop on a task

1. Dev marks submitted (or lead does, from the board).
2. Lead reviews → **Approve** or **Reopen**.
3. Reopen forces the reason tap — six options, one tap, no free text required.
4. That single tap writes the ReworkEvent that feeds the registry.
5. Delivery recorded with promised vs actual date.

## Flow 4 — Checking a dev

1. **People** → Asad's player card: reliability, rework index, cycle time, unblock speed,
   each with a 12-week trend.
2. Tap "rework index −3" → the exact reopened tasks, each with its reason tag.
3. Every number is defensible in a 1:1 because it points at real events, not opinions.

## Flow 5 — End of day

1. Evening nudge: unresolved items are visibly piled on Today.
2. Two-minute sweep: clear, defer, or convert each.
3. Clearing animates. Anything left carries into tomorrow's standup card automatically.

## Flow 6 — Weekly review

Auto-generated Friday: deliveries made vs promised, deadline hit rate, rework by
attribution (dev / client / lead), blockers he cleared and how fast, capture streak.
The lead's own numbers are in there next to the team's — that's what keeps it honest.
