import { useEffect, useState } from 'react'
import { api } from '../lib/api.js'
import { CaptureChips } from '../components/CaptureChips.jsx'
import { EmptyArt, Tag, Spinner, Icon } from '../components/ui.jsx'
import { useConfirm } from '../components/Confirm.jsx'

/**
 * Everything the parser could not place with confidence. It lands here rather
 * than being guessed at — one wrong silent guess costs more trust than an extra tap.
 */
export function Inbox() {
  const confirm = useConfirm()
  const [items, setItems] = useState(null)
  const load = () => api.inbox().then(setItems)

  const bin = async (c) => {
    const ok = await confirm({
      title: 'Discard this capture?',
      body: 'The transcript and everything still unconfirmed in it will be deleted.',
      danger: 'Discard',
      onConfirm: () => api.deleteCapture(c._id),
    })
    if (ok) load()
  }
  useEffect(() => { load() }, [])

  if (!items) return <Spinner />

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Inbox</h1>
          <div className="sub">{items.length ? `${items.length} to place` : 'Nothing waiting'}</div>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="panel">
          <EmptyArt kind="inbox">
            Everything you said landed somewhere. Anything the parser can’t place with
            confidence waits here instead of being guessed at.
          </EmptyArt>
        </div>
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
                  <button className="row-del" onClick={() => bin(c)} title="Discard capture">
                    <Icon.trash size={14} />
                  </button>
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
