import { Router } from 'express'
import Project, { PROJECT_MODES } from '../models/Project.js'
import Task from '../models/Task.js'
import Blocker from '../models/Blocker.js'

const r = Router()

r.get('/modes', (_req, res) =>
  res.json(Object.entries(PROJECT_MODES).map(([key, v]) => ({ key, ...v })))
)

r.get('/', async (_req, res) => {
  res.json(
    await Project.find({ status: { $ne: 'archived' } })
      .populate('members.user', 'name avatarColor title')
      .sort('name')
      .lean({ virtuals: true })
  )
})

r.post('/', async (req, res) => {
  const { name, aliases, ...rest } = req.body
  const list = (aliases?.length ? aliases : [name]).map((a) => String(a).toLowerCase().trim())
  const created = await Project.create({ ...rest, name, aliases: list })
  res.status(201).json(await created.populate('members.user', 'name avatarColor title'))
})

/** What a delete would actually cost, so the dialog can say it out loud. */
r.get('/:id/impact', async (req, res) => {
  const [tasks, open] = await Promise.all([
    Task.countDocuments({ project: req.params.id }),
    Task.countDocuments({ project: req.params.id, state: { $nin: ['done', 'dropped'] } }),
  ])
  res.json({ tasks, open })
})

r.delete('/:id', async (req, res) => {
  // archive is the default because it keeps every task and score intact and is
  // reversible; permanent is opt-in and takes the tasks with it
  if (req.query.permanent !== 'true') {
    return res.json(await Project.findByIdAndUpdate(req.params.id, { status: 'archived' }, { new: true }))
  }
  const removed = await Task.deleteMany({ project: req.params.id })
  await Project.findByIdAndDelete(req.params.id)
  res.json({ ok: true, tasksDeleted: removed.deletedCount })
})

r.post('/:id/restore', async (req, res) => {
  res.json(await Project.findByIdAndUpdate(req.params.id, { status: 'active' }, { new: true }))
})

/** Put someone on a project, or change what share of their week it takes. */
r.put('/:id/members/:userId', async (req, res) => {
  const project = await Project.findById(req.params.id)
  if (!project) return res.status(404).json({ error: 'not found' })
  const existing = project.members.find((m) => String(m.user) === req.params.userId)
  if (existing) {
    if (req.body.allocation !== undefined) existing.allocation = req.body.allocation
    if (req.body.role !== undefined) existing.role = req.body.role
    if (req.body.isManager !== undefined) existing.isManager = req.body.isManager
  } else {
    project.members.push({
      user: req.params.userId,
      allocation: req.body.allocation ?? 100,
      role: req.body.role || '',
      isManager: Boolean(req.body.isManager),
    })
  }
  await project.save()
  res.json(await project.populate('members.user', 'name avatarColor title'))
})

r.delete('/:id/members/:userId', async (req, res) => {
  const project = await Project.findById(req.params.id)
  if (!project) return res.status(404).json({ error: 'not found' })
  project.members = project.members.filter((m) => String(m.user) !== req.params.userId)
  await project.save()
  res.json(await project.populate('members.user', 'name avatarColor title'))
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
