import { useEffect, useState } from 'react'
import { api } from '../lib/api.js'
import { Icon } from './icons.jsx'

const KIND = { task: 'task', blocker: 'blocked', owed: 'on me', status: 'update', note: 'note', deadline: 'due' }

const describe = (card) => {
  const p = card.payload || {}
  switch (card.kind) {
    case 'task':    return p.title
    case 'blocker': return p.item
    case 'owed':    return p.item
    case 'status':  return `${p.taskHint}${p.newState ? ` → ${p.newState.replace('_', ' ')}` : ''}`
    default:        return p.body || p.title || p.item || '—'
  }
}

/**
 * Chips are editable, not just acceptable.
 *
 * The parser gets the words right far more often than it gets the project
 * right - so a chip that cannot be applied because one field is missing is a
 * dead end, and he has to type the whole thing again by hand. Anything
 * unresolved becomes a dropdown on the chip itself: pick it, accept it, done.
 */
export function CaptureChips({ capture, onChange }) {
  const [busy, setBusy] = useState(null)
  const [edits, setEdits] = useState({})
  const [opts, setOpts] = useState({ projects: [], people: [], tasks: [] })

  const pending = (capture?.parsed || []).filter((c) => c.status === 'pending')

  useEffect(() => {
    if (!pending.length) return
    Promise.all([api.projects(), api.people(), api.tasks('?open=true')])
      .then(([projects, people, tasks]) =>
        setOpts({ projects, people: people.filter((p) => p.role === 'dev'), tasks }))
      .catch(() => {})
  }, [pending.length])

  if (!capture) return null
  if (!pending.length) return <div className="dim" style={{ fontSize: 12 }}>Nothing left to confirm.</div>

  const patch = (id, field, value) => setEdits((e) => ({ ...e, [id]: { ...e[id], [field]: value } }))
  const merged = (card) => ({ ...card.payload, ...(edits[card._id] || {}) })

  // what this card still needs before it can become a real record
  const missing = (card) => {
    const p = merged(card)
    const need = []
    if (card.kind !== 'note' && !p.project) need.push('project')
    if (card.kind === 'status' && !p.task) need.push('task')
    if (card.kind === 'status' && !p.newState) need.push('state')
    return need
  }

  const act = async (card, accept) => {
    setBusy(card._id)
    const p = merged(card)
    try {
      // "asad is on the grid fix" is an update to a task that may not exist
      // yet. Rather than dead-ending, let it become the task.
      if (accept && card.kind === 'status' && p.task === '__new') {
        await api.addTask({
          title: p.taskHint, project: p.project, track: 'team',
          assignee: p.assignee || undefined,
        })
        const res = await api.discardCard(capture._id, card._id)
        return onChange?.(res.capture)
      }
      const res = accept
        ? await api.applyCard(capture._id, card._id, p)
        : await api.discardCard(capture._id, card._id)
      onChange?.(res.capture)
    } catch {
      /* leave the chip in place so nothing he said is lost */
    } finally { setBusy(null) }
  }

  return (
    <>
      {pending.map((card) => {
        const p = merged(card)
        const need = missing(card)
        const ready = need.length === 0
        const projectTasks = opts.tasks.filter((t) => !p.project || String(t.project?._id) === String(p.project))

        return (
          <div key={card._id} className={`chip${ready ? '' : ' needs'}`}>
            <span className="k">{KIND[card.kind] || card.kind}</span>

            <span className="c">
              <span className="chip-text">{describe(card)}</span>

              {(need.length > 0 || card.kind === 'task') && (
                <span className="chip-fix">
                  {card.kind !== 'note' && (
                    <select
                      value={p.project || ''}
                      onChange={(e) => patch(card._id, 'project', e.target.value || null)}
                    >
                      <option value="">Which project?</option>
                      {opts.projects.map((x) => <option key={x._id} value={x._id}>{x.name}</option>)}
                    </select>
                  )}

                  {(card.kind === 'task' || card.kind === 'status') && (
                    <select
                      value={p.assignee || ''}
                      onChange={(e) => patch(card._id, 'assignee', e.target.value || null)}
                    >
                      <option value="">{p.assigneeSpoken ? `“${p.assigneeSpoken}” — who?` : 'Unassigned'}</option>
                      {opts.people.map((x) => <option key={x._id} value={x._id}>{x.name}</option>)}
                    </select>
                  )}

                  {card.kind === 'status' && (
                    <select
                      value={p.task || ''}
                      onChange={(e) => patch(card._id, 'task', e.target.value || null)}
                    >
                      <option value="">Which task?</option>
                      <option value="__new">＋ Add “{p.taskHint}” as a new task</option>
                      {projectTasks.map((t) => <option key={t._id} value={t._id}>{t.title}</option>)}
                    </select>
                  )}
                </span>
              )}
            </span>

            <span className="acts">
              <button
                className="chip-btn yes" disabled={busy === card._id || !ready}
                title={ready ? 'Add it' : `Pick a ${need[0]} first`}
                onClick={() => act(card, true)}
              >
                {busy === card._id ? <span className="spinner" /> : <Icon.check size={14} />}
              </button>
              <button className="chip-btn no" disabled={busy === card._id} title="Discard" onClick={() => act(card, false)}>
                <Icon.x size={14} />
              </button>
            </span>
          </div>
        )
      })}
    </>
  )
}
