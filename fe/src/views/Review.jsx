import { useEffect, useState } from 'react'
import { api } from '../lib/api.js'
import { Avatar, Tag, EmptyArt, Modal, Spinner, Icon, dueLabel } from '../components/ui.jsx'
import { useConfirm } from '../components/Confirm.jsx'

/**
 * The verdict queue. Approving is one tap; sending something back costs one
 * more, and that second tap is the entire performance registry.
 *
 * The reasons are deliberately not symmetrical. Work that comes back because
 * the fix did not hold counts against the dev. Work that comes back because the
 * client changed their mind counts *for* them — absorbing churn is work. And
 * "my brief was unclear" charges the lead, which is the valve that stops every
 * ambiguous outcome quietly landing on whoever held the ticket.
 */
export function Review() {
  const confirm = useConfirm()
  const [queue, setQueue] = useState(null)
  const [reworking, setReworking] = useState(null)
  const [busy, setBusy] = useState(null)

  const load = () => api.reviewQueue().then(setQueue)
  useEffect(() => { load() }, [])

  const approve = async (task) => {
    setBusy(task._id)
    try {
      await api.transition(task._id, { to: 'done' })
      load()
    } finally { setBusy(null) }
  }

  const remove = async (task) => {
    const ok = await confirm({
      title: 'Delete this task?',
      body: `“${task.title}” will be removed without a verdict.`,
      danger: 'Delete task',
      consequences: [
        { text: 'No rework is recorded against anyone', kept: true },
        { text: 'The task is gone for good', kept: false },
      ],
      onConfirm: () => api.deleteTask(task._id),
    })
    if (ok) load()
  }

  if (!queue) return <Spinner />

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Review</h1>
          <div className="sub">
            {queue.length ? `${queue.length} waiting on your verdict` : 'Nothing waiting'}
          </div>
        </div>
      </div>

      {queue.length === 0 ? (
        <div className="panel">
          <EmptyArt kind="review">
            Nothing waiting on a verdict. This fills the moment a dev marks something
            submitted — approve in one tap, send it back in two.
          </EmptyArt>
        </div>
      ) : (
        <div className="stack">
          {queue.map((t) => {
            const due = dueLabel(t.dueDate)
            return (
              <div className="card" key={t._id}>
                <div className="row-between">
                  <div className="inline" style={{ gap: 11, minWidth: 0 }}>
                    <Avatar user={t.assignee} size={38} />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 14.5 }}>{t.title}</div>
                      <div className="dim inline" style={{ fontSize: 12, marginTop: 3, gap: 7 }}>
                        <span>{t.assignee?.name || 'unassigned'}</span>
                        <span>· {t.project?.name}</span>
                        {due && <Tag tone={due.tone}>{due.text}</Tag>}
                        {t.reopenCount > 0 && <Tag tone="red">back ×{t.reopenCount}</Tag>}
                      </div>
                    </div>
                  </div>
                  <div className="inline" style={{ gap: 7, flex: 'none' }}>
                    <button className="row-del" onClick={() => remove(t)} title="Delete task">
                      <Icon.trash size={14} />
                    </button>
                    <button className="btn" onClick={() => setReworking(t)}>Send back</button>
                    <button className="btn primary" disabled={busy === t._id} onClick={() => approve(t)}>
                      {busy === t._id ? <span className="spinner" /> : 'Approve'}
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {reworking && (
        <ReasonSheet task={reworking} onClose={() => setReworking(null)} onDone={() => { setReworking(null); load() }} />
      )}
    </>
  )
}

const COPY = {
  not_fixed: 'It came back the same way. Counts against them.',
  regression: 'The fix broke something else. Counts against them.',
  missed_requirement: 'Something stated was left out.',
  client_change: 'They changed their mind — not the dev’s fault.',
  scope_added: 'New work after sign-off. Credit for absorbing it.',
  unclear_brief: 'The brief was ambiguous. This lands on you, not them.',
  wrong_spec: 'The spec or design was wrong.',
}

function ReasonSheet({ task, onClose, onDone }) {
  const [reasons, setReasons] = useState([])
  const [busy, setBusy] = useState(null)
  useEffect(() => { api.reopenReasons().then(setReasons) }, [])

  const pick = async (key) => {
    setBusy(key)
    try {
      await api.reopen(task._id, { reason: key, subject: task.assignee?._id })
      onDone()
    } finally { setBusy(null) }
  }

  const tone = (r) => (r.attributedTo === 'lead' ? 'self' : r.points >= 0 ? 'pos' : 'neg')

  return (
    <Modal
      title="Why is it coming back?"
      sub={`${task.title} — one tap, and this is the whole performance record.`}
      onClose={onClose}
      foot={<button className="btn ghost" onClick={onClose}>Cancel</button>}
    >
      <div className="stack" style={{ gap: 7 }}>
        {reasons.map((r) => (
          <button key={r.key} className={`reason ${tone(r)}`} disabled={Boolean(busy)} onClick={() => pick(r.key)}>
            <span>
              <span className="l">{r.label}</span>
              <span className="d">{COPY[r.key]}</span>
            </span>
            {busy === r.key ? (
              <span className="spinner" />
            ) : (
              <Tag tone={r.attributedTo === 'lead' ? 'amber' : r.points >= 0 ? 'green' : 'red'}>
                {r.attributedTo === 'lead' ? 'on me' : r.attributedTo} {r.points > 0 ? '+' : ''}{r.points}
              </Tag>
            )}
          </button>
        ))}
      </div>
    </Modal>
  )
}
