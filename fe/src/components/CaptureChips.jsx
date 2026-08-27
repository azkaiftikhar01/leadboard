import { useState } from 'react'
import { api } from '../lib/api.js'

const KIND = { task: 'task', blocker: 'blocked', owed: 'on me', status: 'update', note: 'note', deadline: 'due' }

function describe(card) {
  const p = card.payload || {}
  switch (card.kind) {
    case 'task':    return `${p.title}${p.assigneeSpoken ? ` → ${p.assigneeSpoken}` : ''}${p.dueDate ? ` · ${p.dueDate}` : ''}`
    case 'blocker': return `${p.item}${p.waitingOnLabel ? ` — waiting on ${p.waitingOnLabel}` : ''}`
    case 'owed':    return `${p.item}${p.toSpoken ? ` → ${p.toSpoken}` : ''}`
    case 'status':  return `${p.taskHint}${p.newState ? ` → ${p.newState.replace('_', ' ')}` : ''}`
    default:        return p.body || p.title || p.item || '—'
  }
}

/** Nothing is applied until he taps. Chips he ignores expire with the capture —
 *  the system never creates something he did not watch it create. */
export function CaptureChips({ capture, onChange }) {
  const [busy, setBusy] = useState(null)
  const pending = (capture?.parsed || []).filter((c) => c.status === 'pending')

  if (!capture) return null
  if (!pending.length) return <div className="dim" style={{ fontSize: 12 }}>Nothing left to confirm.</div>

  const act = async (card, accept) => {
    setBusy(card._id)
    try {
      const res = accept
        ? await api.applyCard(capture._id, card._id, card.payload)
        : await api.discardCard(capture._id, card._id)
      onChange?.(res.capture)
    } finally { setBusy(null) }
  }

  return (
    <>
      {pending.map((card) => {
        const blocked = card.unresolved?.length > 0
        return (
          <div key={card._id} className={`chip${blocked ? ' needs' : ''}`}>
            <span className="k">{KIND[card.kind] || card.kind}</span>
            <span className="c">
              {describe(card)}
              {blocked && (
                <div style={{ color: 'var(--warn)', fontSize: 11, marginTop: 3 }}>
                  needs {card.unresolved.join(', ')} — sits in Inbox
                </div>
              )}
            </span>
            <span className="acts">
              <button className="chip-btn yes" disabled={busy === card._id || blocked}
                title={blocked ? 'Resolve it in Inbox first' : 'Accept'} onClick={() => act(card, true)}>✓</button>
              <button className="chip-btn no" disabled={busy === card._id} title="Discard" onClick={() => act(card, false)}>✕</button>
            </span>
          </div>
        )
      })}
    </>
  )
}
