import { Router } from 'express'
import Project from '../models/Project.js'
import Task from '../models/Task.js'
import StandupSession from '../models/StandupSession.js'

const r = Router()
const DAY = 86_400_000
const dstr = (d) => d.toISOString().slice(0, 10)

/**
 * The pre-filled card stack. Generated before he opens it, because a blank page
 * is exactly what the paper notebook already gave him and exactly what he loses.
 */
r.get('/today', async (_req, res) => {
  const date = dstr(new Date())
  const yesterday = new Date(Date.now() - DAY)
  const riskWindow = new Date(Date.now() + 5 * DAY)

  const projects = await Project.find({ status: 'active' }).sort('name').lean()

  const cards = await Promise.all(
    projects.map(async (project) => {
      const [all, movedSince] = await Promise.all([
        Task.find({ project: project._id, state: { $nin: ['done', 'dropped'] } })
          .populate('assignee', 'name avatarColor')
          .sort('dueDate')
          .lean({ virtuals: true }),
        Task.find({ project: project._id, 'history.at': { $gte: yesterday } })
          .select('title state')
          .lean(),
      ])

      const tasks = all.filter((t) => t.track === 'team')
      const stalled = tasks.filter((t) => (t.daysOnTask ?? 0) >= 3)
      return {
        project,
        tasks,
        blockers: {
          waitingOnDev: [],
          waitingOnClient: all.filter((t) => t.track === 'client'),
          waitingOnMe: all.filter((t) => t.track === 'lead'),
        },
        deadlines: all.filter((t) => t.dueDate && new Date(t.dueDate) <= riskWindow),
        movedSinceYesterday: movedSince.length,
        stalled,
      }
    })
  )

  const session =
    (await StandupSession.findOne({ date }).lean()) ??
    (await StandupSession.create({ date, projectsCovered: [] })).toObject()

  res.json({ date, session, cards })
})

/** Ends the ritual. The digest is the payback paper never gave him. */
r.post('/complete', async (req, res) => {
  const date = dstr(new Date())
  const open = await Task.find({ state: { $nin: ['done', 'dropped'] }, track: { $in: ['client', 'lead'] } })
    .populate('project', 'name')
    .populate('assignee', 'name')
    .lean()
  const atRiskTasks = await Task.find({
    state: { $nin: ['done', 'dropped'] },
    dueDate: { $lte: new Date(Date.now() + 5 * DAY) },
  })
    .populate('project', 'name')
    .populate('assignee', 'name')
    .lean({ virtuals: true })

  const askFrom = open
    .filter((t) => t.track === 'client')
    .map((t) => ({ who: t.waitingOnLabel || 'client', item: t.title, project: t.project?.name }))
  const iOwe = open
    .filter((t) => t.track === 'lead')
    .map((t) => ({ who: t.waitingOnLabel || 'team', item: t.title, project: t.project?.name }))
  const atRisk = atRiskTasks.map((t) => ({
    what: t.title,
    project: t.project?.name,
    dueDate: t.dueDate,
    why: t.daysOnTask >= 3 ? `${t.daysOnTask} days on task` : 'deadline near',
  }))

  const session = await StandupSession.findOneAndUpdate(
    { date },
    {
      date,
      completed: true,
      completedAt: new Date(),
      durationSec: req.body.durationSec,
      projectsCovered: req.body.projectsCovered || [],
      digest: { askFrom, iOwe, atRisk, text: renderDigest({ askFrom, iOwe, atRisk }) },
    },
    { new: true, upsert: true }
  )
  res.json(session)
})

function renderDigest({ askFrom, iOwe, atRisk }) {
  const section = (title, rows, fmt) =>
    rows.length ? `${title}\n${rows.map(fmt).map((l) => `  • ${l}`).join('\n')}` : null

  return [
    `Standup — ${dstr(new Date())}`,
    section('Ask from', askFrom, (a) => `${a.who}: ${a.item}${a.project ? ` (${a.project})` : ''}`),
    section('I owe', iOwe, (a) => `${a.item}${a.who ? ` — ${a.who}` : ''}${a.project ? ` (${a.project})` : ''}`),
    section('At risk', atRisk, (a) => `${a.what}${a.project ? ` (${a.project})` : ''} — ${a.why}`),
  ]
    .filter(Boolean)
    .join('\n\n')
}

export default r
