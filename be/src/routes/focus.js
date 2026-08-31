import { Router } from 'express'
import FocusSession from '../models/FocusSession.js'

const r = Router()
const DAY = 86_400_000

/** Today's blocks and a streak, so the habit has something to protect. */
r.get('/', async (_req, res) => {
  const midnight = new Date(new Date().setHours(0, 0, 0, 0))
  const [today, recent] = await Promise.all([
    FocusSession.find({ startedAt: { $gte: midnight } }).sort('-startedAt').lean(),
    FocusSession.find({ completed: true, startedAt: { $gte: new Date(Date.now() - 30 * DAY) } })
      .select('startedAt minutes')
      .lean(),
  ])

  const done = today.filter((s) => s.completed)
  const days = new Set(recent.map((s) => new Date(s.startedAt).toDateString()))
  let streak = 0
  const cursor = new Date()
  if (!days.has(cursor.toDateString())) cursor.setTime(cursor.getTime() - DAY)
  while (days.has(cursor.toDateString())) {
    streak += 1
    cursor.setTime(cursor.getTime() - DAY)
  }

  res.json({
    todayCount: done.length,
    todayMinutes: done.reduce((n, s) => n + (s.minutes || 0), 0),
    streak,
    recent: today.slice(0, 8),
  })
})

r.post('/', async (req, res) => {
  const { minutes, label, task, project } = req.body || {}
  if (!minutes || minutes < 1) return res.status(400).json({ error: 'minutes required' })
  res.status(201).json(await FocusSession.create({ minutes, label: label || '', task, project }))
})

/** Ended, whether it ran out or he stopped. Both are worth recording. */
r.post('/:id/end', async (req, res) => {
  const s = await FocusSession.findById(req.params.id)
  if (!s) return res.status(404).json({ error: 'not found' })
  s.endedAt = new Date()
  s.completed = Boolean(req.body?.completed)
  s.elapsedSec = Math.max(0, Math.round((s.endedAt - s.startedAt) / 1000))
  await s.save()
  res.json(s)
})

export default r
