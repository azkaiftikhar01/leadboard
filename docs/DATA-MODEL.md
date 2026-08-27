# Data model

MongoDB via Mongoose. Everything the registry reports is derived from these events —
nothing is hand-scored.

## Collections

**User** — `name, role (lead|dev), avatar, capacity, active`

**Project** — `name, client, status, health (green|amber|red), startDate, targetDate, leadNotes`

**Task** — `project, assignee, title, state, priority, estimate, dueDate, history[]`
State machine: `assigned → in_progress → submitted → in_review → done`, with `reopened`
re-entering `in_progress`. Every transition appends to `history[]` with actor + timestamp.
Cycle time and days-on-task fall out of this for free.

**ReworkEvent** — `task, reopenedAt, reason, attributedTo (dev|lead|client), polarity, points`
Written by the mandatory reason-tap on reopen. The heart of the registry.

**Delivery** — `task|milestone, project, promisedDate, actualDate, varianceDays, accepted`
Drives on-time reliability.

**Blocker** — `task, type (waiting-on-dev|waiting-on-client|waiting-on-me), waitingOn, item, openedAt, clearedAt`
`clearedAt − openedAt` on `waiting-on-me` is the lead's own responsiveness metric.

**Capture** — `audioRef, transcript, parsed[], status (pending|applied|partial|discarded), createdAt`
Raw transcript is retained so a bad parse is always recoverable.

**StandupSession** — `date, projectCards[], digest, durationSec, completed`

**Note** — `body, source (voice|typed), refType, refId, summary, tags[]`

**ScoreSnapshot** — weekly rollup per dev, so trends survive data edits.

## Scoring

```
reliability   = onTimeDeliveries / totalDeliveries          (rolling 12 weeks)
reworkIndex   = Σ ReworkEvent.points / deliveries           (signed; 0 is clean)
cycleTime     = median(done − assigned)
unblockSpeed  = median(clearedAt − openedAt) on waiting-on-me   ← the LEAD's number
```

Rework points:

| Reason | Attribution | Points |
|---|---|---|
| `not-fixed` | dev | −2 |
| `regression` | dev | −2 |
| `missed-requirement` | dev | −1 |
| `client-change` | client | +0.5 |
| `scope-added` | client | +1 |
| `unclear-brief` | lead | 0 to dev, −1 to lead |
| `wrong-spec` | routed to spec owner | −1 to that owner |

Positive points on client-driven rework are deliberate: absorbing churn is work, and a
dev who eats three client pivots without complaint should read *better* than one who
never gets touched by the client. If rework only ever counted against people, the tags
would be gamed within a month and the registry would be worthless.

`unclear-brief` charging the lead is the honesty valve — without it, every ambiguous
outcome silently lands on the dev.
