import { useEffect, useState } from 'react'
import { api } from '../lib/api.js'
import { Avatar, Pill, dayLabel } from '../components/bits.jsx'

const LANES = [
  ['assigned', 'Assigned'],
  ['in_progress', 'In progress'],
  ['submitted', 'Submitted'],
  ['in_review', 'In review'],
  ['done', 'Done'],
]

export function Board() {
  const [projects, setProjects] = useState([])
  const [sel, setSel] = useState(null)
  const [board, setBoard] = useState(null)
  const [reopening, setReopening] = useState(null)

  useEffect(() => {
    api.projects().then((p) => { setProjects(p); setSel(p[0]?._id ?? null) })
  }, [])

  const load = (id) => id && api.board(id).then(setBoard)
  useEffect(() => { load(sel) }, [sel])

  const move = async (task, to) => {
    await api.transition(task._id, { to })
    load(sel)
  }

  return (
    <div>
      <div className="topbar">
        <h1>Board</h1>
        <select value={sel || ''} onChange={(e) => setSel(e.target.value)}>
          {projects.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
        </select>
      </div>

      {!board ? (
        <div className="empty">…</div>
      ) : (
        LANES.map(([state, label]) => {
          const rows = board.tasks.filter((t) => t.state === state)
          if (!rows.length) return null
          return (
            <div key={state}>
              <div className="section-title">{label} · {rows.length}</div>
              <div className="card tight">
                {rows.map((t) => {
                  const d = dayLabel(t.dueDate)
                  return (
                    <div className="row" key={t._id}>
                      <Avatar user={t.assignee} />
                      <div className="grow">
                        <div className="title">{t.title}</div>
                        <div className="sub">
                          {t.assignee?.name || 'unassigned'}
                          {t.daysOnTask != null && ` · day ${t.daysOnTask}`}
                        </div>
                      </div>
                      {t.reopenCount > 0 && <Pill tone="red">×{t.reopenCount}</Pill>}
                      {d && <Pill tone={d.tone}>{d.text}</Pill>}
                      {state === 'submitted' && (
                        <>
                          <button className="btn sm" onClick={() => move(t, 'done')}>Approve</button>
                          <button className="btn sm" onClick={() => setReopening(t)}>Reopen</button>
                        </>
                      )}
                      {state === 'assigned' && (
                        <button className="btn sm" onClick={() => move(t, 'in_progress')}>Start</button>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })
      )}

      {reopening && (
        <ReopenSheet
          task={reopening}
          onClose={() => setReopening(null)}
          onDone={() => { setReopening(null); load(sel) }}
        />
      )}
    </div>
  )
}

/**
 * The only forced choice in the whole product. One tap, six options, no typing —
 * and this single tap is the entire performance registry. If it were optional it
 * would never get filled in.
 */
function ReopenSheet({ task, onClose, onDone }) {
  const [reasons, setReasons] = useState([])
  useEffect(() => { api.reopenReasons().then(setReasons) }, [])

  const pick = async (reason) => {
    await api.reopen(task._id, { reason, subject: task.assignee?._id })
    onDone()
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgb(0 0 0 / .55)',
        display: 'grid', placeItems: 'center', padding: 20, zIndex: 50,
      }}
      onClick={onClose}
    >
      <div className="card" style={{ maxWidth: 460, width: '100%' }} onClick={(e) => e.stopPropagation()}>
        <div className="card-head">
          <h2>Why is it coming back?</h2>
          <button className="btn ghost sm" onClick={onClose}>Esc</button>
        </div>
        <div className="muted" style={{ fontSize: 12, marginBottom: 12 }}>
          {task.title}
        </div>
        {reasons.map((r) => (
          <button
            key={r.key}
            className="btn wide"
            style={{ marginBottom: 6, justifyContent: 'space-between' }}
            onClick={() => pick(r.key)}
          >
            <span>{r.label}</span>
            <Pill tone={r.points >= 0 ? 'green' : r.attributedTo === 'lead' ? 'amber' : 'red'}>
              {r.attributedTo === 'lead' ? 'on me' : r.attributedTo}
              {' '}{r.points > 0 ? '+' : ''}{r.points}
            </Pill>
          </button>
        ))}
      </div>
    </div>
  )
}
