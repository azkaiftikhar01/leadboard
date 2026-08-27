import { Router } from 'express'
import Task from '../models/Task.js'
import Blocker from '../models/Blocker.js'
import Capture from '../models/Capture.js'
import StandupSession from '../models/StandupSession.js'

const r = Router()
const DAY = 86_400_000
const dstr = (d) => d.toISOString().slice(0, 10)

/** Everything the tray popover and the tray icon badge need, in one call. */
r.get('/', async (_req, res) => {
  const riskWindow = new Date(Date.now() + 3 * DAY)

  const [owed, dueSoon, stale, inboxCount, standup, streak] = await Promise.all([
    Blocker.find({ type: 'waiting_on_me', clearedAt: null })
      .populate('project', 'name color')
      .sort('openedAt')
      .lean({ virtuals: true }),
    Task.find({ state: { $nin: ['done', 'dropped'] }, dueDate: { $lte: riskWindow } })
      .populate('assignee', 'name avatarColor')
      .populate('project', 'name color')
      .sort('dueDate')
      .lean({ virtuals: true }),
    Task.find({ state: 'in_progress', startedAt: { $lte: new Date(Date.now() - 4 * DAY) } })
      .populate('assignee', 'name avatarColor')
      .populate('project', 'name color')
      .lean({ virtuals: true }),
    Capture.countDocuments({ status: { $in: ['pending', 'partial', 'failed'] } }),
    StandupSession.findOne({ date: dstr(new Date()) }).lean(),
    currentStreak(),
  ])

  res.json({
    date: dstr(new Date()),
    standupDone: Boolean(standup?.completed),
    streak,
    inboxCount,
    owed,
    dueSoon,
    stale,
    // what the tray icon renders without opening anything
    badge: { owed: owed.length, atRisk: dueSoon.length, inbox: inboxCount },
  })
})

/** Consecutive weekdays with a completed standup. The loss-aversion hook. */
async function currentStreak() {
  const sessions = await StandupSession.find({ completed: true }).sort('-date').limit(60).lean()
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
