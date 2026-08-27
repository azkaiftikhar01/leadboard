import { Router } from 'express'
import Award, { AWARDS } from '../models/Award.js'
import User from '../models/User.js'
import { scoreboard } from '../lib/scoreboard.js'

const r = Router()

r.get('/types', (_req, res) =>
  res.json(Object.entries(AWARDS).map(([key, v]) => ({ key, ...v })))
)

r.get('/board', async (req, res) => {
  res.json(await scoreboard({ weeks: Number(req.query.weeks) || 12 }))
})

/** Recent activity, newest first — the feed under the board. */
r.get('/', async (req, res) => {
  const q = req.query.subject ? { subject: req.query.subject } : {}
  const rows = await Award.find(q)
    .populate('subject', 'name')
    .populate('project', 'name color')
    .sort('-givenAt')
    .limit(Number(req.query.limit) || 40)
    .lean()
  res.json(rows.map((a) => ({ ...a, meta: AWARDS[a.kind] })))
})

r.post('/', async (req, res) => {
  const { subject, kind, note, project, task } = req.body
  const spec = AWARDS[kind]
  if (!spec) return res.status(400).json({ error: 'unknown award', valid: Object.keys(AWARDS) })
  if (!subject) return res.status(400).json({ error: 'subject required' })

  const lead = await User.findOne({ role: 'lead' }).lean()
  const created = await Award.create({
    subject, kind, tone: spec.tone, points: spec.points,
    note: note || '', project: project || undefined, task: task || undefined,
    givenBy: lead?._id,
  })
  res.status(201).json({ ...created.toObject(), meta: spec })
})

/** Undo. He will misfire one, and a record he cannot correct is one he stops trusting. */
r.delete('/:id', async (req, res) => {
  await Award.findByIdAndDelete(req.params.id)
  res.json({ ok: true })
})

export default r
