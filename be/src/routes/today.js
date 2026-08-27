import { Router } from 'express'
import Task from '../models/Task.js'
import Capture from '../models/Capture.js'
import StandupSession from '../models/StandupSession.js'
import { teamLoad } from '../lib/load.js'

const r = Router()
const DAY = 86_400_000
const dstr = (d) => d.toISOString().slice(0, 10)

/**
 * The day board. Three tracks, because that is how his paper page was always
 * laid out: what the team owes, what the client owes, what he owes.
 */
r.get('/', async (_req, res) => {
  const riskWindow = new Date(Date.now() + 3 * DAY)

  const [open, inboxCount, standup, streak, load] = await Promise.all([
    Task.find({ state: { $nin: ['done', 'dropped'] } })
      .populate('assignee', 'name avatarColor')
      .populate('project', 'name color mode')
      .sort('dueDate')
      .lean({ virtuals: true }),
    Capture.countDocuments({ status: { $in: ['pending', 'partial', 'failed'] } }),
    StandupSession.findOne({ date: dstr(new Date()) }).lean(),
    currentStreak(),
    teamLoad(),
  ])

  const midnight = new Date(new Date().setHours(0, 0, 0, 0))
  const doneToday = await Task.countDocuments({ state: 'done', doneAt: { $gte: midnight } })

  // last seven days of completions, oldest first - the sparkline behind
  // "cleared today", so the number has a shape to sit against
  const weekStart = new Date(midnight.getTime() - 6 * DAY)
  const recent = await Task.find({ state: 'done', doneAt: { $gte: weekStart } }).select('doneAt').lean()
  const doneWeek = Array.from({ length: 7 }, (_, i) => {
    const from = new Date(weekStart.getTime() + i * DAY)
    const to = new Date(from.getTime() + DAY)
    return recent.filter((t) => t.doneAt >= from && t.doneAt < to).length
  })

  const byTrack = {
    lead: open.filter((t) => t.track === 'lead'),
    client: open.filter((t) => t.track === 'client'),
    team: open.filter((t) => t.track === 'team'),
  }
  const dueSoon = open.filter((t) => t.dueDate && new Date(t.dueDate) <= riskWindow)
  const stale = open.filter((t) => t.track === 'team' && (t.daysOnTask ?? 0) >= 4)

  res.json({
    date: dstr(new Date()),
    standupDone: Boolean(standup?.completed),
    streak,
    inboxCount,
    doneToday,
    doneWeek,
    tracks: byTrack,
    dueSoon,
    stale,
    load: load.map((l) => ({
      user: { _id: l.user._id, name: l.user.name, avatarColor: l.user.avatarColor },
      loadPercent: l.loadPercent,
      band: l.band.key,
      headroom: l.headroom,
      openTasks: l.openTasks,
    })),
    badge: { owed: byTrack.lead.length, atRisk: dueSoon.length, inbox: inboxCount },
  })
})

/** Consecutive weekdays with a completed standup. The loss-aversion hook. */
async function currentStreak() {
  const sessions = await StandupSession.find({ completed: true }).sort('-date').limit(90).lean()
  const done = new Set(sessions.map((s) => s.date))
  let streak = 0
  const cursor = new Date()
  // today not being done yet must not break a live streak
  if (!done.has(dstr(cursor))) cursor.setTime(cursor.getTime() - DAY)
  while (true) {
    const day = cursor.getDay()
    if (day === 0 || day === 6) {
      cursor.setTime(cursor.getTime() - DAY)
      continue
    }
    if (!done.has(dstr(cursor))) break
    streak += 1
    cursor.setTime(cursor.getTime() - DAY)
  }
  return streak
}

export default r
