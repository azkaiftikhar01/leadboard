# Approach

## The real problem

The lead does not have a *tracking* problem. He has a **capture-to-structure** problem.
Paper works because it costs zero friction at the moment of thought. Paper fails because
it never gives anything back — no rollup, no reminder, no history.

So the rule for every decision in this product:

> **Capture must be cheaper than paper. Payback must be immediate and visible.**

Anything that costs more than a tap or a sentence at capture time will lose to the
notebook, and he will go back.

## Five design principles

1. **Voice is the primary input, not a feature.** The app opens into capture mode, not a
   dashboard. Typing is always optional.
2. **Never silently create.** Parsed items appear as confirm-cards he accepts or discards.
   ADHD trust dies the moment the system "does something" he didn't see.
3. **Scores are derived, never entered.** Every metric comes from state transitions that
   already have to happen. There is no "rate this dev" form, ever.
4. **One decision per screen.** Standup is a card stack, not a table. Deep tables exist,
   but behind a drilldown.
5. **Playful where it aids retention, sober where it aids trust.** Streaks and animation on
   *his* habit loop. No cartoons on a dev's performance record — that has to be defensible.

## The three systems

### 1. Capture (the spine)

Mic button → browser speech recognition streams a transcript (audio blob kept as backup)
→ Claude parses the transcript into typed entities:

```
"asad's on the widespace fix, still stuck on sara's figma,
 I owe him the staging key, needs to land thursday"

→ task     { title: "widespace fix", assignee: Asad, project: <inferred>, due: Thu }
→ blocker  { task: ^, waitingOn: Sara, type: waiting-on-dev, item: "figma" }
→ owed     { from: Lead, to: Asad, item: "staging key" }
```

Each becomes a confirm-card. Accept, edit inline, or discard. Anything the parser can't
resolve (unknown project, ambiguous name) lands in **Inbox** rather than being guessed.

### 2. The Morning Standup ritual

The thing that replaces the paper page. Not a blank form — a **pre-filled card stack**,
one card per project, generated from current state before he opens it:

- who is on what, and how many days they've been on it
- what moved since yesterday, what didn't
- open blockers, split into *waiting on a dev* / *waiting on client* / **waiting on me**
- deadlines inside the risk window

He swipes through, talking. Output is a **digest** — ask-list, owe-list, at-risk list —
one tap to copy into Slack/WhatsApp. That digest is the immediate payback that paper
never gave him.

The "waiting on me" lane matters most. Leads reliably forget their own blockers, and a
lead's unblocking latency gates the whole team.

### 3. The performance registry

Built on one honest idea: **rework is only bad when the rework was avoidable.**

Every task that reopens requires a one-tap reason. That tap is the entire data collection
mechanism — no forms, no reviews.

| Reason | Attributed to | Polarity |
|---|---|---|
| Not actually fixed / regression | Dev | negative |
| Missed a stated requirement | Dev | negative |
| Client changed their mind | Client | neutral → positive on delivery |
| Scope added after sign-off | Client | positive (absorbed churn) |
| Brief was unclear | **Lead** | negative to lead, neutral to dev |
| Spec/design was wrong | Whoever owned spec | routed |

This is what makes the registry survive contact with the team. A dev who reopens a task
five times because the client keeps moving should trend *up*, not down. A system that
punishes them is a system nobody trusts, and untrusted metrics get gamed or ignored.

Derived per dev: reliability (on-time deliveries), rework index (signed, per delivery),
cycle time, unblock responsiveness. Shown as a player card with trend arrows — readable
in three seconds, drillable to the exact tasks behind every number.

## Keeping him in the app

- **Streak** on consecutive weekday standups. Loss aversion is the strongest retention
  lever available and it costs nothing to build.
- **Board clears** — unresolved items visibly pile up during the day and clear with
  animation. Completion has to *feel* like something.
- **XP for the lead too**, not only the devs: blockers cleared, promises kept, captures made.
- Confetti reserved for real milestones (project shipped, week streak). Cheap celebration
  stops registering fast.
- Daily nudge at his standup time. Offline-capable — paper always works, so this must too.
