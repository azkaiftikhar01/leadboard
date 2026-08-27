import { useEffect, useState } from 'react'
import { api } from '../lib/api.js'
import { CaptureChips } from '../components/CaptureChips.jsx'
import { Empty, Tag } from '../components/ui.jsx'

/**
 * Everything the parser could not place with confidence. It lands here rather
 * than being guessed at — one wrong silent guess costs more trust than an extra tap.
 */
export function Inbox() {
  const [items, setItems] = useState(null)
  const load = () => api.inbox().then(setItems)
  useEffect(() => { load() }, [])

  if (!items) return <div className="empty"><span className="spinner" /></div>

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Inbox</h1>
          <div className="sub">{items.length ? `${items.length} to place` : 'Nothing waiting'}</div>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="panel"><Empty ico="✓">Everything you said landed somewhere.</Empty></div>
      ) : (
        <div className="stack">
          {items.map((c) => (
            <div className="panel" key={c._id}>
              <div className="panel-head">
                <span className="dim" style={{ fontSize: 12 }}>
                  {new Date(c.createdAt).toLocaleString()} · {c.source}
                </span>
                <div className="inline" style={{ gap: 6 }}>
                  {c.parser && <Tag>{c.parser}</Tag>}
                  {c.status === 'failed' && <Tag tone="red">{c.error}</Tag>}
                </div>
              </div>
              <div className="panel-body">
                <div className="muted" style={{ fontSize: 13, margin: '8px 0 12px', lineHeight: 1.55, fontStyle: 'italic' }}>
                  “{c.transcript || 'nothing transcribed'}”
                </div>
                <div className="stack" style={{ gap: 6 }}>
                  <CaptureChips capture={c} onChange={load} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  )
}
