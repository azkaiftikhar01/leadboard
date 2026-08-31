import { Router } from 'express'
import Task, { TASK_TRACKS } from '../models/Task.js'
import Delivery from '../models/Delivery.js'
import ReworkEvent, { REWORK_REASONS } from '../models/ReworkEvent.js'
import { transitionTask } from '../lib/apply.js'

const r = Router()

/**
 * Tasks that have come due and have not been announced yet.
 *
 * The client polls this rather than computing it, so the same deadline does not
 * fire twice on two devices, and so a browser that was closed at the moment
 * still hears about it when it comes back.
 */
r.get('/due', async (_req, res) => {
  const now = new Date()
  const tasks = await Task.find({
    state: { $nin: ['done', 'dropped'] },
    dueDate: { $ne: null, $lte: now },
    dueNotifiedAt: null,
  })
    .populate('assignee', 'name')
    .populate('project', 'name color')
    .sort('dueDate')
    .limit(10)
    .lean({ virtuals: true })

  // a day-only deadline is not late until the day is over
  const ripe = tasks.filter((t) => {
    if (t.dueHasTime) return true
    const end = new Date(t.dueDate)
    end.setHours(23, 59, 59, 999)
    return now > end
  })
  res.json(ripe)
})

/** Acknowledged — do not raise this one again. */
r.post('/:id/notified', async (req, res) => {
  res.json(await Task.findByIdAndUpdate(req.params.id, { dueNotifiedAt: new Date() }, { new: true }))
})

/** Push a deadline out without leaving the alert. */
r.post('/:id/snooze', async (req, res) => {
  const mins = Math.max(1, Number(req.body?.minutes) || 10)
  const task = await Task.findById(req.params.id)
  if (!task) return res.status(404).json({ error: 'not found' })
  task.dueDate = new Date(Date.now() + mins * 60_000)
  task.dueHasTime = true
  task.dueNotifiedAt = null
  await task.save()
  res.json(task)
})

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
    dueHasTime: Boolean(req.body.dueHasTime),
    history: [{ from: null, to: req.body.state || 'assigned', by: req.body.actor }],
  })
  res.status(201).json(task)
})

r.patch('/:id', async (req, res) => {
  res.json(await Task.findByIdAndUpdate(req.params.id, req.body, { new: true }))
})

/**
 * Deletes the task, and deliberately leaves its rework events and deliveries
 * behind. Those are somebody's record - a task disappearing should not quietly
 * subtract points a person already earned or lost.
 */
r.delete('/:id', async (req, res) => {
  const task = await Task.findById(req.params.id)
  if (!task) return res.status(404).json({ error: 'not found' })
  await Task.deleteOne({ _id: task._id })
  res.json({ ok: true })
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
