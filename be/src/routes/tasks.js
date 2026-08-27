import { Router } from 'express'
import Task, { TASK_TRACKS } from '../models/Task.js'
import Delivery from '../models/Delivery.js'
import ReworkEvent, { REWORK_REASONS } from '../models/ReworkEvent.js'
import { transitionTask } from '../lib/apply.js'

const r = Router()

r.get('/tracks', (_req, res) =>
  res.json(Object.entries(TASK_TRACKS).map(([key, v]) => ({ key, ...v })))
)

/** The review queue: everything handed back to him, waiting on a verdict. */
r.get('/review', async (_req, res) => {
  res.json(
    await Task.find({ state: { $in: ['submitted', 'in_review'] } })
      .populate('assignee', 'name avatarColor')
      .populate('project', 'name color mode')
      .sort('-updatedAt')
      .lean({ virtuals: true })
  )
})

r.get('/reopen-reasons', (_req, res) => {
  res.json(
    Object.entries(REWORK_REASONS).map(([key, v]) => ({ key, ...v }))
  )
})

r.get('/', async (req, res) => {
  const q = {}
  if (req.query.project) q.project = req.query.project
  if (req.query.assignee) q.assignee = req.query.assignee
  if (req.query.track) q.track = req.query.track
  if (req.query.open === 'true') q.state = { $nin: ['done', 'dropped'] }
  if (req.query.due) q.dueDate = { $lte: new Date(req.query.due) }
  res.json(
    await Task.find(q)
      .populate('assignee', 'name avatarColor')
      .populate('project', 'name color')
      .sort('dueDate')
      .lean({ virtuals: true })
  )
})

r.post('/', async (req, res) => {
  const task = await Task.create({
    ...req.body,
    history: [{ from: null, to: req.body.state || 'assigned', by: req.body.actor }],
  })
  res.status(201).json(task)
})

r.patch('/:id', async (req, res) => {
  res.json(await Task.findByIdAndUpdate(req.params.id, req.body, { new: true }))
})

/** One tap from anywhere in the app: done, or back to open. */
r.post('/:id/toggle', async (req, res) => {
  const task = await Task.findById(req.params.id)
  if (!task) return res.status(404).json({ error: 'not found' })
  const to = task.state === 'done' ? 'in_progress' : 'done'
  const result = await transitionTask(task, to, { by: req.body.actor })
  if (to === 'done' && task.track === 'team') {
    await Delivery.create({
      task: task._id, project: task.project, owner: task.assignee,
      title: task.title, promisedDate: task.dueDate, actualDate: new Date(),
    })
  }
  res.json(result)
})

r.post('/:id/transition', async (req, res) => {
  const task = await Task.findById(req.params.id)
  if (!task) return res.status(404).json({ error: 'not found' })
  const { to, actor, note } = req.body

  const result = await transitionTask(task, to, { by: actor, note })

  // approving a submission is what closes the delivery loop
  if (to === 'done') {
    await Delivery.create({
      task: task._id,
      project: task.project,
      owner: task.assignee,
      title: task.title,
      promisedDate: task.dueDate,
      actualDate: new Date(),
    })
  }
  res.json(result)
})

/**
 * Reopen is the only write in the system that forces the lead to say *why*, and
 * that single tap is the entire performance registry. Reason is required - if it
 * were optional it would never be filled in, and the registry would be empty.
 */
r.post('/:id/reopen', async (req, res) => {
  const { reason, actor, note, subject } = req.body
  const spec = REWORK_REASONS[reason]
  if (!spec) return res.status(400).json({ error: 'reason required', valid: Object.keys(REWORK_REASONS) })

  const task = await Task.findById(req.params.id)
  if (!task) return res.status(404).json({ error: 'not found' })

  // unclear_brief lands on the lead, not on whoever happened to hold the task
  const chargedTo = spec.attributedTo === 'lead' ? actor : (subject || task.assignee)

  await ReworkEvent.create({
    task: task._id,
    project: task.project,
    subject: chargedTo,
    reason,
    attributedTo: spec.attributedTo,
    points: spec.points,
    note,
  })

  task.reopenCount += 1
  const result = await transitionTask(task, 'in_progress', {
    by: actor,
    note: `reopened: ${spec.label}${note ? ` - ${note}` : ''}`,
  })
  res.json({ ...result, reason: spec })
})

export default r
