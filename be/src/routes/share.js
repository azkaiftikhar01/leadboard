import { Router } from 'express'
import Share from '../models/Share.js'
import Task from '../models/Task.js'
import User from '../models/User.js'
import Project from '../models/Project.js'
import { transitionTask } from '../lib/apply.js'

/* ---------------- authenticated: manage links ---------------- */
export const shareAdmin = Router()

shareAdmin.get('/', async (req, res) => {
  const q = { revoked: false }
  if (req.query.kind) q.kind = req.query.kind
  if (req.query.refId) q.refId = req.query.refId
  res.json(await Share.find(q).sort('-createdAt').lean())
})

shareAdmin.post('/', async (req, res) => {
  const { kind, refId, label, canComplete } = req.body || {}
  if (!kind || !refId) return res.status(400).json({ error: 'kind and refId required' })
  // one live link per target, so re-sharing does not scatter tokens nobody can revoke
  const existing = await Share.findOne({ kind, refId, revoked: false })
  if (existing) return res.json(existing)
  res.status(201).json(await Share.create({ kind, refId, label: label || '', canComplete: canComplete !== false }))
})

shareAdmin.post('/:id/revoke', async (req, res) => {
  res.json(await Share.findByIdAndUpdate(req.params.id, { revoked: true }, { new: true }))
})

/* ---------------- public: no session, token only ---------------- */
export const sharePublic = Router()

const load = async (token) => {
  const share = await Share.findOne({ token, revoked: false })
  if (!share) return null
  if (share.expiresAt && share.expiresAt < new Date()) return null
  return share
}

sharePublic.get('/:token', async (req, res) => {
  const share = await load(req.params.token)
  if (!share) return res.status(404).json({ error: 'This link is no longer active.' })

  share.views += 1
  share.lastViewedAt = new Date()
  await share.save()

  const q = { state: { $nin: ['dropped'] } }
  let title = share.label
  if (share.kind === 'person') {
    q.assignee = share.refId
    q.track = 'team'
    title ||= (await User.findById(share.refId).lean())?.name
  } else {
    q.project = share.refId
    title ||= (await Project.findById(share.refId).lean())?.name
  }

  const tasks = await Task.find(q)
    .populate('project', 'name color')
    .populate('assignee', 'name')
    .sort('state dueDate')
    .lean({ virtuals: true })

  // Only what the holder of this link needs: the work itself. No scores, no
  // load, no rework - a to-do list, not a performance record.
  res.json({
    title,
    kind: share.kind,
    canComplete: share.canComplete,
    open: tasks
      .filter((t) => t.state !== 'done')
      .map((t) => ({
        _id: t._id, title: t.title, state: t.state, dueDate: t.dueDate,
        daysOnTask: t.daysOnTask, priority: t.priority,
        project: share.kind === 'person' ? t.project : null,
        assignee: share.kind === 'project' ? t.assignee : null,
      })),
    done: tasks
      .filter((t) => t.state === 'done')
      .slice(0, 20)
      .map((t) => ({ _id: t._id, title: t.title, doneAt: t.doneAt })),
  })
})

/** Tick something off. The only write a public link can make. */
sharePublic.post('/:token/tasks/:taskId/done', async (req, res) => {
  const share = await load(req.params.token)
  if (!share) return res.status(404).json({ error: 'This link is no longer active.' })
  if (!share.canComplete) return res.status(403).json({ error: 'This link is read-only.' })

  const task = await Task.findById(req.params.taskId)
  if (!task) return res.status(404).json({ error: 'not found' })

  // the token grants access to one list, not to every task in the database
  const owns =
    share.kind === 'person'
      ? String(task.assignee) === String(share.refId)
      : String(task.project) === String(share.refId)
  if (!owns) return res.status(403).json({ error: 'not on this board' })

  const to = task.state === 'done' ? 'in_progress' : 'done'
  res.json(await transitionTask(task, to, { note: 'via shared link' }))
})
