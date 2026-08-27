import { useEffect, useState } from 'react'
import { api } from '../lib/api.js'
import { Icon } from './icons.jsx'

const KIND = { task: 'task', blocker: 'blocked', owed: 'on me', status: 'update', note: 'note', deadline: 'due' }

/**
 * "can you make a task for asad about the pricing page" -> "pricing page".
 *
 * Applied twice, because the politeness word and the verb are separate layers
 * ("can you" then "make a task for X about") and one pass only ever eats one.
 */
const LEADIN = /^(?:can you|could you|would you|please|pls|remind me to|i need to|we need to|let'?s|make|create|add|put)\s+(?:a\s+|an\s+)?(?:task|ticket|note|reminder|item)?\s*(?:for\s+\S+\s*)?(?:to|about|on|that|regarding|re)?\s*/i

const asTitle = (body = '') => {
  let out = body.trim()
  for (let i = 0; i < 2; i++) {
    const next = out.replace(LEADIN, '').trim()
    if (!next || next === out) break
    out = next
  }
  return out.replace(/\s+/g, ' ') || body.trim()
}

const describe = (card) => {
  const p = card.payload || {}
  switch (card.kind) {
    case 'task':    return p.title
    case 'blocker': return p.item
    case 'owed':    return p.item
    case 'status':  return `${p.taskHint}${p.newState ? ` \u2192 ${p.newState.replace('_', ' ')}` : ''}`
    default:        return p.body || p.title || p.item || '\u2014'
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

  /** Switching a note to a task: trim the lead-in and pick up any name in it,
   *  so he is editing a task rather than retyping his own sentence. */
  const toTask = (card) => {
    const body = card.payload?.body || ''
    const named = opts.people.find((u) =>
      String(u.name).split(/\s+/).filter((w) => w.length >= 3)
        .some((w) => new RegExp(`\\b${w}\\b`, 'i').test(body))
    )
    setEdits((e) => ({
      ...e,
      [card._id]: {
        ...e[card._id],
        __as: 'task',
        title: e[card._id]?.title ?? asTitle(body),
        assignee: e[card._id]?.assignee ?? named?._id ?? null,
      },
    }))
  }
  const merged = (card) => ({ ...card.payload, ...edits[card._id] })
  // a note he *meant* as an instruction should not need retyping as a task
  const asTask = (card) => merged(card).__as === 'task'

  // what this card still needs before it can become a real record
  const missing = (card) => {
    const p = merged(card)
    const need = []
    if ((card.kind !== 'note' || asTask(card)) && !p.project) need.push('project')
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
      if (accept && card.kind === 'note' && p.__as === 'task') {
        await api.addTask({
          title: (p.title || p.body || '').trim(),
          project: p.project, track: p.track || 'team',
          assignee: p.assignee || undefined,
        })
        const res = await api.discardCard(capture._id, card._id)
        return onChange?.(res.capture)
      }

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
              {asTask(card) ? (
                <input
                  className="chip-title" type="text"
                  value={p.title ?? p.body ?? ''}
                  onChange={(e) => patch(card._id, 'title', e.target.value)}
                  placeholder="Task title"
                />
              ) : (
                <span className="chip-text">{describe(card)}</span>
              )}

              {card.kind === 'note' && (
                <span className="chip-as">
                  <button className={p.__as !== 'task' ? 'on' : ''} onClick={() => patch(card._id, '__as', 'note')}>
                    Keep as note
                  </button>
                  <button className={p.__as === 'task' ? 'on' : ''} onClick={() => toTask(card)}>
                    Make it a task
                  </button>
                </span>
              )}

              {(need.length > 0 || card.kind === 'task' || asTask(card)) && (
                <span className="chip-fix">
                  {(card.kind !== 'note' || asTask(card)) && (
                    <select
                      value={p.project || ''}
                      onChange={(e) => patch(card._id, 'project', e.target.value || null)}
                    >
                      <option value="">Which project?</option>
                      {opts.projects.map((x) => <option key={x._id} value={x._id}>{x.name}</option>)}
                    </select>
                  )}

                  {(card.kind === 'task' || card.kind === 'status' || asTask(card)) && (
                    <select
                      value={p.assignee || ''}
                      onChange={(e) => patch(card._id, 'assignee', e.target.value || null)}
                    >
                      <option value="">{p.assigneeSpoken ? `“${p.assigneeSpoken}” — who?` : 'Who? (optional)'}</option>
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
