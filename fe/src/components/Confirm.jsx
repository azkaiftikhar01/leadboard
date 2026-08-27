import { createContext, useCallback, useContext, useRef, useState } from 'react'
import { Icon } from './ui.jsx'

/**
 * Promise-based confirmation, so a call site reads as one line:
 *
 *   if (!(await confirm({ title, body, danger: 'Delete' }))) return
 *
 * window.confirm would have been less code, but it cannot show what a deletion
 * costs - and every destructive action here has a consequence worth naming
 * before it happens, not after.
 */
const Ctx = createContext(() => Promise.resolve(false))
export const useConfirm = () => useContext(Ctx)

export function ConfirmProvider({ children }) {
  const [req, setReq] = useState(null)
  const [busy, setBusy] = useState(false)
  const resolver = useRef(null)

  const confirm = useCallback((options) => {
    setReq(options)
    return new Promise((resolve) => { resolver.current = resolve })
  }, [])

  const close = (answer) => {
    resolver.current?.(answer)
    resolver.current = null
    setReq(null)
    setBusy(false)
  }

  const go = async () => {
    if (!req?.onConfirm) return close(true)
    setBusy(true)
    try { await req.onConfirm(); close(true) } catch { setBusy(false) }
  }

  return (
    <Ctx.Provider value={confirm}>
      {children}
      {req && (
        <div className="scrim" onClick={() => !busy && close(false)}>
          <div className="confirm" onClick={(e) => e.stopPropagation()}>
            <div className={`confirm-ico ${req.tone || 'danger'}`}>
              <Icon.warn size={20} />
            </div>

            <h2>{req.title}</h2>
            {req.body && <p>{req.body}</p>}

            {req.consequences?.length > 0 && (
              <ul className="confirm-list">
                {req.consequences.map((c, i) => (
                  <li key={i}>
                    <span className={c.kept ? 'keeps' : 'loses'}>
                      <Icon.check size={12} />
                    </span>
                    {c.text}
                  </li>
                ))}
              </ul>
            )}

            <div className="confirm-acts">
              <button className="btn" disabled={busy} onClick={() => close(false)}>
                {req.cancel || 'Cancel'}
              </button>
              {req.alternative && (
                <button
                  className="btn"
                  disabled={busy}
                  onClick={async () => { setBusy(true); await req.alternative.run(); close(false) }}
                >
                  {req.alternative.label}
                </button>
              )}
              <button
                className={`btn ${req.tone === 'warm' ? 'warm' : 'confirm-danger'}`}
                disabled={busy}
                onClick={go}
              >
                {busy ? <span className="spinner" /> : req.danger || 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Ctx.Provider>
  )
}
