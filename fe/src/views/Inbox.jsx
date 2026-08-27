import { useEffect, useState } from 'react'
import { api } from '../lib/api.js'
import { CaptureChips } from '../components/CaptureChips.jsx'
import { Empty } from '../components/bits.jsx'

/**
 * Everything the parser could not place with confidence. It lands here rather
 * than being guessed at — a wrong silent guess costs more trust than an extra tap.
 */
export function Inbox() {
  const [items, setItems] = useState(null)
  const load = () => api.inbox().then(setItems)
  useEffect(() => { load() }, [])

  if (!items) return <div className="empty">…</div>

  return (
    <div>
      <div className="topbar"><h1>Inbox</h1></div>
      {items.length === 0 ? (
        <Empty>Nothing waiting. Everything you said landed somewhere.</Empty>
      ) : (
        items.map((c) => (
          <div className="card" key={c._id}>
            <div className="card-head">
              <span className="muted" style={{ fontSize: 12 }}>
                {new Date(c.createdAt).toLocaleString()} · {c.source}
              </span>
              {c.status === 'failed' && <span className="pill red">{c.error}</span>}
            </div>
            <div style={{ fontSize: 13, marginBottom: 10, lineHeight: 1.5 }}>
              “{c.transcript || 'nothing transcribed'}”
            </div>
            <CaptureChips capture={c} onChange={load} />
          </div>
        ))
      )}
    </div>
  )
}
