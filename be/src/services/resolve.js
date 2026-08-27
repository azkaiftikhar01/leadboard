import User from '../models/User.js'
import Project from '../models/Project.js'

const norm = (s) => (s || '').toLowerCase().trim()

/**
 * Name -> record. Returns { match, candidates } so the caller can tell the
 * difference between "no idea who that is" and "could be either of two Alis".
 * Both cases go to Inbox; only an unambiguous hit is auto-applied.
 */
function matchOne(spoken, records) {
  const n = norm(spoken)
  if (!n) return { match: null, candidates: [] }

  const exact = records.filter((r) => norm(r.name) === n || (r.aliases || []).includes(n))
  if (exact.length === 1) return { match: exact[0], candidates: [] }
  if (exact.length > 1) return { match: null, candidates: exact }

  const partial = records.filter((r) => {
    const rn = norm(r.name)
    return rn.startsWith(n) || n.startsWith(rn.split(' ')[0]) || rn.split(' ')[0] === n
  })
  if (partial.length === 1) return { match: partial[0], candidates: [] }
  return { match: null, candidates: partial }
}

export async function buildResolver() {
  const [people, projects] = await Promise.all([
    User.find({ active: true }).lean(),
    Project.find({ status: { $in: ['active', 'paused'] } }).lean(),
  ])
  return {
    people,
    projects,
    person: (spoken) => matchOne(spoken, people),
    project: (spoken) => matchOne(spoken, projects),
  }
}

/**
 * Turns the parser's name-shaped output into confirm-cards. Every card carries
 * what it could not resolve, so the UI can show "which project?" inline rather
 * than silently dropping the item.
 */
export function toCards(parsed, resolver) {
  const cards = []
  const push = (kind, payload, unresolved) =>
    cards.push({ kind, payload, unresolved, confidence: unresolved.length ? 0.5 : 0.9, status: 'pending' })

  for (const t of parsed.tasks ?? []) {
    const a = resolver.person(t.assigneeName)
    const p = resolver.project(t.projectName)
    const unresolved = []
    if (t.assigneeName && !a.match) unresolved.push('assignee')
    if (!t.projectName || !p.match) unresolved.push('project')
    push('task', {
      title: t.title,
      assignee: a.match?._id ?? null,
      assigneeSpoken: t.assigneeName,
      project: p.match?._id ?? null,
      projectSpoken: t.projectName,
      dueDate: t.dueDate,
      priority: t.priority ?? 'normal',
      candidates: { assignee: a.candidates.map((c) => c._id), project: p.candidates.map((c) => c._id) },
    }, unresolved)
  }

  for (const s of parsed.statusUpdates ?? []) {
    const a = resolver.person(s.assigneeName)
    push('status', {
      taskHint: s.taskHint,
      assignee: a.match?._id ?? null,
      assigneeSpoken: s.assigneeName,
      newState: s.newState,
      note: s.note,
    }, s.newState ? [] : ['state'])
  }

  for (const b of parsed.blockers ?? []) {
    const w = resolver.person(b.waitingOnName)
    const p = resolver.project(b.projectName)
    const unresolved = []
    if (b.type === 'waiting_on_dev' && b.waitingOnName && !w.match) unresolved.push('waitingOn')
    if (!p.match) unresolved.push('project')
    push('blocker', {
      item: b.item,
      type: b.type,
      taskHint: b.taskHint,
      waitingOn: w.match?._id ?? null,
      waitingOnLabel: b.waitingOnName,
      project: p.match?._id ?? null,
      projectSpoken: b.projectName,
    }, unresolved)
  }

  for (const o of parsed.owed ?? []) {
    const to = resolver.person(o.toName)
    const p = resolver.project(o.projectName)
    push('owed', {
      item: o.item,
      to: to.match?._id ?? null,
      toSpoken: o.toName,
      project: p.match?._id ?? null,
      dueDate: o.dueDate,
    }, o.toName && !to.match ? ['to'] : [])
  }

  for (const n of parsed.notes ?? []) {
    const person = resolver.person(n.refName)
    const project = resolver.project(n.refName)
    const ref = person.match
      ? { refType: 'user', refId: person.match._id }
      : project.match
        ? { refType: 'project', refId: project.match._id }
        : { refType: 'none', refId: null }
    push('note', { body: n.body, ...ref }, [])
  }

  return cards
}
