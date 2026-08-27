import { Router } from 'express'
import User from '../models/User.js'
import Task from '../models/Task.js'
import ReworkEvent from '../models/ReworkEvent.js'
import Award from '../models/Award.js'
import { scorecard, leadScorecard } from '../lib/scoring.js'
import { teamLoad, whoHasBandwidth } from '../lib/load.js'

const r = Router()

r.get('/', async (_req, res) => {
  res.json(await User.find({ active: true }).sort('name').lean())
})

r.post('/', async (req, res) => {
  const { name, aliases, ...rest } = req.body
  // spoken names are how the capture parser finds people, so seed the alias
  // list from the name rather than making him type it twice
  const list = (aliases?.length ? aliases : [name]).map((a) => String(a).toLowerCase().trim())
  res.status(201).json(await User.create({ ...rest, name, aliases: list }))
})

r.get('/:id/impact', async (req, res) => {
  const [open, awards, rework] = await Promise.all([
    Task.countDocuments({ assignee: req.params.id, state: { $nin: ['done', 'dropped'] } }),
    Award.countDocuments({ subject: req.params.id }),
    ReworkEvent.countDocuments({ subject: req.params.id }),
  ])
  res.json({ open, awards, rework })
})

r.delete('/:id', async (req, res) => {
  // deactivating keeps their whole record, which is the point of having one;
  // permanent removal is opt-in and takes the awards and rework with it
  if (req.query.permanent !== 'true') {
    return res.json(await User.findByIdAndUpdate(req.params.id, { active: false }, { new: true }))
  }
  await Promise.all([
    Award.deleteMany({ subject: req.params.id }),
    ReworkEvent.deleteMany({ subject: req.params.id }),
    Task.updateMany({ assignee: req.params.id }, { assignee: null }),
  ])
  await User.findByIdAndDelete(req.params.id)
  res.json({ ok: true })
})

/** The bandwidth board. */
r.get('/load/all', async (_req, res) => res.json(await teamLoad()))
r.get('/load/available', async (_req, res) => res.json(await whoHasBandwidth()))

r.patch('/:id', async (req, res) => {
  res.json(await User.findByIdAndUpdate(req.params.id, req.body, { new: true }))
})

// the player card
r.get('/:id/scorecard', async (req, res) => {
  const user = await User.findById(req.params.id).lean()
  if (!user) return res.status(404).json({ error: 'not found' })
  const weeks = Number(req.query.weeks) || 12
  const card = user.role === 'lead'
    ? await leadScorecard(user._id, { weeks })
    : await scorecard(user._id, { weeks })
  const openTasks = await Task.find({ assignee: user._id, state: { $nin: ['done', 'dropped'] } })
    .populate('project', 'name color')
    .lean()
  res.json({ user, ...card, openTasks })
})

// every number drills down to the events behind it - that is the whole point
r.get('/:id/rework', async (req, res) => {
  res.json(
    await ReworkEvent.find({ subject: req.params.id })
      .populate('task', 'title')
      .populate('project', 'name')
      .sort('-occurredAt')
      .lean()
  )
})

export default r
