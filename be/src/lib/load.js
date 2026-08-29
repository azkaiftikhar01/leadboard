import Project, { PROJECT_MODES } from '../models/Project.js'
import Task from '../models/Task.js'
import User from '../models/User.js'

/**
 * Bandwidth, weighted by what kind of work it actually is.
 *
 * The lead's own framing: someone sitting on a support project is not spent.
 * So a project contributes `allocation × modeWeight` to a dev's load, meaning
 * 100% on a support project reads as 45% loaded - and the view says, correctly,
 * that they have room for something real.
 *
 * Open tasks are reported alongside but deliberately do NOT feed the number.
 * Load is about commitment, not backlog; a dev with twenty small tickets on a
 * support project is not the person to protect.
 */
export const BANDS = [
  { max: 55, key: 'free', label: 'Has room' },
  { max: 85, key: 'ok', label: 'Comfortable' },
  { max: 100, key: 'full', label: 'Full' },
  { max: Infinity, key: 'over', label: 'Overloaded' },
]

const band = (pct) => BANDS.find((b) => pct <= b.max)

export async function teamLoad() {
  const [people, projects, openTasks] = await Promise.all([
    User.find({ active: true, role: { $in: ['dev', 'manager'] } }).sort('name').lean(),
    Project.find({ status: { $in: ['active', 'paused'] } }).lean(),
    Task.find({ state: { $nin: ['done', 'dropped'] }, track: 'team' }).select('assignee project dueDate').lean(),
  ])

  return people.map((user) => {
    const on = projects
      .map((p) => {
        const m = p.members?.find((x) => String(x.user) === String(user._id))
        if (!m) return null
        const weight = (PROJECT_MODES[p.mode] || PROJECT_MODES.development).weight
        return {
          project: { _id: p._id, name: p.name, color: p.color, mode: p.mode, status: p.status },
          allocation: m.allocation,
          role: m.role,
          weight,
          effective: Math.round(m.allocation * weight),
        }
      })
      .filter(Boolean)

    const load = on.reduce((sum, a) => sum + a.effective, 0)
    const capacity = user.capacityPercent ?? 100
    const pct = capacity ? Math.round((load / capacity) * 100) : 0
    const mine = openTasks.filter((t) => String(t.assignee) === String(user._id))

    return {
      user,
      assignments: on,
      rawLoad: load,
      capacity,
      loadPercent: pct,
      band: band(pct),
      headroom: Math.max(0, capacity - load),
      openTasks: mine.length,
      overdue: mine.filter((t) => t.dueDate && new Date(t.dueDate) < new Date()).length,
    }
  })
}

/** Who could take something on right now, best headroom first. */
export async function whoHasBandwidth() {
  const team = await teamLoad()
  return team
    .filter((t) => t.headroom > 0)
    .sort((a, b) => b.headroom - a.headroom)
}
