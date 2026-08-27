import { useState } from 'react'
import { api } from '../lib/api.js'

const KIND_LABEL = {
  task: 'task', blocker: 'blocked', owed: 'i owe',
  status: 'update', note: 'note', deadline: 'due',
}

function describe(card) {
  const p = card.payload || {}
  switch (card.kind) {
    case 'task':
      return `${p.title}${p.assigneeSpoken ? ` → ${p.assigneeSpoken}` : ''}${p.dueDate ? ` · ${p.dueDate}` : ''}`
    case 'blocker':
      return `${p.item}${p.waitingOnLabel ? ` — waiting on ${p.waitingOnLabel}` : ''}`
    case 'owed':
      return `${p.item}${p.toSpoken ? ` → ${p.toSpoken}` : ''}`
    case 'status':
      return `${p.taskHint}${p.newState ? ` → ${p.newState.replace('_', ' ')}` : ''}`
    default:
      return p.body || p.title || p.item || '—'
  }
}

/**
 * Nothing here is applied until he taps. Ignored chips simply expire with the
 * capture - the system never creates something he did not watch it create.
 */
export function CaptureChips({ capture, onChange }) {
  const [busy, setBusy] = useState(null)
  const pending = (capture?.parsed || []).filter((c) => c.status === 'pending')

  if (!capture) return null
  if (!pending.length) {
    return <div className="muted" style={{ fontSize: 12, padding: '6px 0' }}>Nothing left to confirm.</div>
  }

  const act = async (card, accept) => {
    setBusy(card._id)
    try {
      const res = accept
        ? await api.applyCard(capture._id, card._id, card.payload)
        : await api.discardCard(capture._id, card._id)
      onChange?.(res.capture)
    } finally {
      setBusy(null)
    }
  }

  return (
    <div>
      {pending.map((card) => (
        <div key={card._id} className={`chip${card.unresolved?.length ? ' needs' : ''}`}>
          <span className="kind">{KIND_LABEL[card.kind] || card.kind}</span>
          <span className="body">
            {describe(card)}
            {card.unresolved?.length ? (
              <div className="sub" style={{ color: 'var(--warn)', fontSize: 11, marginTop: 3 }}>
                needs {card.unresolved.join(', ')} — goes to Inbox
              </div>
            ) : null}
          </span>
          <span className="acts">
            <button
              className="chip-btn yes"
              disabled={busy === card._id || card.unresolved?.length}
              title={card.unresolved?.length ? 'Resolve in Inbox first' : 'Accept (Enter)'}
              onClick={() => act(card, true)}
            >
              ✓
            </button>
            <button className="chip-btn no" disabled={busy === card._id} title="Discard (⌫)" onClick={() => act(card, false)}>
              ✕
            </button>
          </span>
        </div>
      ))}
    </div>
  )
}
