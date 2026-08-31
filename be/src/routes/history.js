import { Router } from 'express'
import Task from '../models/Task.js'
import Award, { AWARDS } from '../models/Award.js'
import ReworkEvent, { REWORK_REASONS } from '../models/ReworkEvent.js'
import StandupSession from '../models/StandupSession.js'

const r = Router()
const DAY = 86_400_000

const median = (xs) => {
  if (!xs.length) return null
  const s = [...xs].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

/** When work on a task actually started, falling back through what we know. */
const startOf = (t) => t.startedAt || t.assignedAt || t.createdAt

/** A due date names a day, and a day is not over until it ends. Comparing
 *  against the stored midnight marks anything finished after 00:00 on the due
 *  day as late, which made every same-day task read as missed. */
const endOfDueDay = (t) => {
  const e = new Date(t.dueDate)
  // a deadline with a time on it means that time, not midnight after it
  if (!t.dueHasTime) e.setHours(23, 59, 59, 999)
  return e
}
const cycleDays = (t) => {
  const from = startOf(t)
  return from && t.doneAt ? Math.max(0, (t.doneAt - from) / DAY) : null
}

/**
 * One time-ordered record of what happened.
 *
 * Completed work used to vanish: a task ticked done left the board and had
 * nowhere else to be, so the only trace was a number on a scorecard. The events
 * were all being written - transitions, rework, awards - just never read back.
 *
 * Everything here is derived from those records rather than logged separately,
 * so the history cannot drift from the scores computed off the same rows.
 */
r.get('/', async (req, res) => {
  const days = Number(req.query.days) || 90
  const since = new Date(Date.now() - days * DAY)

  const taskQ = { doneAt: { $gte: since }, state: 'done' }
  if (req.query.person) taskQ.assignee = req.query.person
  if (req.query.project) taskQ.project = req.query.project

  const [done, rework, awards, standups] = await Promise.all([
    Task.find(taskQ)
      .populate('assignee', 'name title')
      .populate('project', 'name color')
      .sort('-doneAt')
      .lean({ virtuals: true }),
    ReworkEvent.find({
      occurredAt: { $gte: since },
      ...(req.query.person ? { subject: req.query.person } : {}),
      ...(req.query.project ? { project: req.query.project } : {}),
    })
      .populate('subject', 'name')
      .populate('task', 'title')
      .populate('project', 'name color')
      .sort('-occurredAt')
      .lean(),
    Award.find({
      givenAt: { $gte: since },
      ...(req.query.person ? { subject: req.query.person } : {}),
      ...(req.query.project ? { project: req.query.project } : {}),
    })
      .populate('subject', 'name')
      .populate('project', 'name color')
      .sort('-givenAt')
      .lean(),
    req.query.person || req.query.project
      ? []
      : StandupSession.find({ completed: true, completedAt: { $gte: since } })
          .sort('-completedAt')
          .lean(),
  ])

  const events = [
    ...done.map((t) => ({
      type: 'completed',
      at: t.doneAt,
      title: t.title,
      person: t.assignee,
      project: t.project,
      track: t.track,
      cycleDays: cycleDays(t),
      reopenCount: t.reopenCount,
      dueDate: t.dueDate,
      // late is measured against what was promised, not against how long it took
      late: t.dueDate ? t.doneAt > endOfDueDay(t) : null,
    })),
    ...rework.map((e) => ({
      type: 'rework',
      at: e.occurredAt,
      title: e.task?.title || 'a task',
      person: e.subject,
      project: e.project,
      reason: e.reason,
      label: REWORK_REASONS[e.reason]?.label,
      attributedTo: e.attributedTo,
      points: e.points,
      note: e.note,
    })),
    ...awards.map((a) => ({
      type: 'award',
      at: a.givenAt,
      title: AWARDS[a.kind]?.label || a.kind,
      person: a.subject,
      project: a.project,
      tone: a.tone,
      points: a.points,
      note: a.note,
    })),
    ...standups.map((s) => ({
      type: 'standup',
      at: s.completedAt,
      title: `Standup — ${s.date}`,
      durationSec: s.durationSec,
      covered: s.digest?.askFrom?.length ?? 0,
    })),
  ].sort((a, b) => new Date(b.at) - new Date(a.at))

  const cycles = done.map(cycleDays).filter((n) => n !== null)
  const withDue = done.filter((t) => t.dueDate)
  const byPerson = {}
  for (const t of done) {
    const id = String(t.assignee?._id || 'unassigned')
    byPerson[id] ??= { person: t.assignee || null, completed: 0, cycles: [], late: 0 }
    byPerson[id].completed += 1
    const c = cycleDays(t)
    if (c !== null) byPerson[id].cycles.push(c)
    if (t.dueDate && t.doneAt > endOfDueDay(t)) byPerson[id].late += 1
  }

  res.json({
    events: events.slice(0, Number(req.query.limit) || 200),
    summary: {
      days,
      completed: done.length,
      medianCycleDays: median(cycles),
      fastest: cycles.length ? Math.min(...cycles) : null,
      slowest: cycles.length ? Math.max(...cycles) : null,
      onTime: withDue.length
        ? withDue.filter((t) => t.doneAt <= endOfDueDay(t)).length / withDue.length
        : null,
      reworked: done.filter((t) => t.reopenCount > 0).length,
      byPerson: Object.values(byPerson)
        .map((p) => ({
          person: p.person,
          completed: p.completed,
          medianCycleDays: median(p.cycles),
          late: p.late,
        }))
        .sort((a, b) => b.completed - a.completed),
    },
  })
})

export default r
