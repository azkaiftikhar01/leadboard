import { useEffect, useMemo, useRef, useState } from 'react'
import { Icon, Mark } from './ui.jsx'

/**
 * ⌘K. The dock holds the seven things he touches daily; everything else lives
 * here, so the chrome never has to grow to fit a new screen.
 */
export function Palette({ items, onClose }) {
  const [q, setQ] = useState('')
  const [sel, setSel] = useState(0)
  const listRef = useRef(null)

  const hits = useMemo(() => {
    const n = q.toLowerCase().trim()
    if (!n) return items
    return items.filter((i) => `${i.label} ${i.group || ''}`.toLowerCase().includes(n))
  }, [q, items])

  useEffect(() => { setSel(0) }, [q])

  useEffect(() => {
    const k = (e) => {
      if (e.key === 'Escape') return onClose()
      if (e.key === 'ArrowDown') { e.preventDefault(); setSel((s) => Math.min(s + 1, hits.length - 1)) }
      if (e.key === 'ArrowUp') { e.preventDefault(); setSel((s) => Math.max(s - 1, 0)) }
      if (e.key === 'Enter') { e.preventDefault(); hits[sel]?.run(); onClose() }
    }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [hits, sel, onClose])

  useEffect(() => {
    listRef.current?.querySelector('.opt.sel')?.scrollIntoView({ block: 'nearest' })
  }, [sel])

  return (
    <div className="scrim" style={{ alignItems: 'flex-start', paddingTop: '14vh' }} onClick={onClose}>
      <div className="palette" onClick={(e) => e.stopPropagation()}>
        <div className="palette-top">
          <Mark size={22} id="pal-mark" />
          <input
            autoFocus value={q} placeholder="Go to, or do…"
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <div className="list" ref={listRef}>
          {hits.length === 0 ? (
            <div className="empty" style={{ padding: 22 }}>Nothing matches “{q}”.</div>
          ) : (
            hits.map((i, n) => {
              const I = Icon[i.icon] || Icon.arrow
              return (
                <button
                  key={i.label}
                  className={`opt${n === sel ? ' sel' : ''}`}
                  onMouseEnter={() => setSel(n)}
                  onClick={() => { i.run(); onClose() }}
                >
                  <I size={17} />
                  <span>{i.label}</span>
                  {i.group && <span className="k">{i.group}</span>}
                </button>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
