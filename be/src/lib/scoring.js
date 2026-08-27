import Task from '../models/Task.js'
import Delivery from '../models/Delivery.js'
import ReworkEvent from '../models/ReworkEvent.js'
import Blocker from '../models/Blocker.js'

const DAY = 86_400_000
const median = (xs) => {
  if (!xs.length) return null
  const s = [...xs].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

/**
 * Every number here is derived from events that had to happen anyway. Nothing is
 * hand-entered, which is what makes it defensible in a 1:1 - each figure points
 * back at specific tasks the lead can open.
 */
export async function scorecard(userId, { weeks = 12 } = {}) {
  const since = new Date(Date.now() - weeks * 7 * DAY)

  const [deliveries, rework, doneTasks, myBlockers] = await Promise.all([
    Delivery.find({ owner: userId, actualDate: { $gte: since } }).lean(),
    ReworkEvent.find({ subject: userId, occurredAt: { $gte: since } }).lean(),
    Task.find({ assignee: userId, state: 'done', doneAt: { $gte: since } }).lean(),
    Blocker.find({ waitingOn: userId, openedAt: { $gte: since }, clearedAt: { $ne: null } }).lean(),
  ])

  const onTime = deliveries.filter((d) => (d.varianceDays ?? 0) <= 0).length
  const reworkPoints = rework.reduce((sum, r) => sum + r.points, 0)

  const cycleTimes = doneTasks
    .map((t) => {
      const from = t.startedAt || t.assignedAt || t.createdAt
      return from && t.doneAt ? (t.doneAt - from) / DAY : null
    })
    .filter((n) => n !== null)

  return {
    user: userId,
    windowWeeks: weeks,
    deliveries: deliveries.length,
    reliability: deliveries.length ? onTime / deliveries.length : null,
    reworkIndex: deliveries.length ? reworkPoints / deliveries.length : reworkPoints,
    reworkPoints,
    reworkBreakdown: rework.reduce((acc, r) => {
      acc[r.reason] = (acc[r.reason] || 0) + 1
      return acc
    }, {}),
    // split matters more than the total: churn the client caused is not a mark
    // against the person who absorbed it
    reworkByAttribution: rework.reduce((acc, r) => {
      acc[r.attributedTo] = (acc[r.attributedTo] || 0) + r.points
      return acc
    }, {}),
    cycleTimeDays: median(cycleTimes),
    tasksCompleted: doneTasks.length,
    unblockSpeedHours: median(myBlockers.map((b) => (b.clearedAt - b.openedAt) / 3_600_000)),
  }
}

/** The lead's own numbers, sat next to the team's. That is what keeps it honest. */
export async function leadScorecard(leadId, { weeks = 12 } = {}) {
  const since = new Date(Date.now() - weeks * 7 * DAY)
  const [owed, chargedToMe] = await Promise.all([
    Blocker.find({ type: 'waiting_on_me', openedAt: { $gte: since } }).lean(),
    ReworkEvent.find({ attributedTo: 'lead', occurredAt: { $gte: since } }).lean(),
  ])
  const cleared = owed.filter((b) => b.clearedAt)
  return {
    user: leadId,
    windowWeeks: weeks,
    blockersOnMe: owed.length,
    blockersCleared: cleared.length,
    stillOpen: owed.length - cleared.length,
    unblockSpeedHours: median(cleared.map((b) => (b.clearedAt - b.openedAt) / 3_600_000)),
    unclearBriefCount: chargedToMe.length,
    reworkChargedToMe: chargedToMe.reduce((s, r) => s + r.points, 0),
  }
}
