import { Router } from 'express'
import Project from '../models/Project.js'
import Task from '../models/Task.js'
import Blocker from '../models/Blocker.js'

const r = Router()

r.get('/', async (_req, res) => {
  res.json(await Project.find({ status: { $ne: 'archived' } }).sort('name').lean())
})

r.post('/', async (req, res) => {
  res.status(201).json(await Project.create(req.body))
})

r.patch('/:id', async (req, res) => {
  res.json(await Project.findByIdAndUpdate(req.params.id, req.body, { new: true }))
})

r.get('/:id/board', async (req, res) => {
  const [project, tasks, blockers] = await Promise.all([
    Project.findById(req.params.id).lean(),
    Task.find({ project: req.params.id, state: { $ne: 'dropped' } })
      .populate('assignee', 'name avatarColor')
      .sort('state dueDate')
      .lean({ virtuals: true }),
    Blocker.find({ project: req.params.id, clearedAt: null }).populate('waitingOn', 'name').lean(),
  ])
  if (!project) return res.status(404).json({ error: 'not found' })
  res.json({ project, tasks, blockers })
})

export default r
