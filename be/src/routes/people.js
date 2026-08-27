import { Router } from 'express'
import User from '../models/User.js'
import Task from '../models/Task.js'
import ReworkEvent from '../models/ReworkEvent.js'
import { scorecard, leadScorecard } from '../lib/scoring.js'

const r = Router()

r.get('/', async (_req, res) => {
  res.json(await User.find({ active: true }).sort('name').lean())
})

r.post('/', async (req, res) => {
  res.status(201).json(await User.create(req.body))
})

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
