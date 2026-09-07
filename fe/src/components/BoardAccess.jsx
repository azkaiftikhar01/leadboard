import { useState } from 'react'
import { api } from '../lib/api.js'
import { Modal, Icon } from './ui.jsx'
import { useConfirm } from './Confirm.jsx'

/**
 * Give somebody a board of their own.
 *
 * Their code is shown exactly once, here, because it is stored hashed and
 * cannot be read back — the same reason a password reset never emails you the
 * old one. Rotating issues a new code and the previous one stops working.
 */
export function BoardAccess({ user, hasBoard, onClose, onChanged }) {
  const confirm = useConfirm()
  const [code, setCode] = useState(null)
  const [custom, setCustom] = useState('')
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  const [err, setErr] = useState(null)

  const grant = async () => {
    setBusy(true); setErr(null)
    try {
      const r = await api.enableBoard(user._id, custom.trim() || undefined)
      setCode(r.code)
      onChanged?.()
    } catch (e) { setErr(e.message) } finally { setBusy(false) }
  }

  const revoke = async () => {
    const ok = await confirm({
      title: `Take away ${user.name}’s board?`,
      body: 'Their code stops working immediately.',
      danger: 'Remove access',
      consequences: [
        { text: 'Tasks already on their board stay exactly where they are', kept: true },
        { text: 'They can no longer sign in', kept: false },
      ],
      onConfirm: () => api.disableBoard(user._id),
    })
    if (ok) { onChanged?.(); onClose() }
  }

  return (
    <Modal
      title={`${user.name}’s board`}
      sub="Second in command — their own board, below yours in the chain."
      onClose={onClose}
      foot={
        hasBoard && !code
          ? <>
              <button className="btn danger" onClick={revoke}>Remove access</button>
              <span style={{ flex: 1 }} />
              <button className="btn" onClick={grant} disabled={busy}>
                {busy ? <span className="spinner" /> : 'Issue a new code'}
              </button>
              <button className="btn primary" onClick={onClose}>Done</button>
            </>
          : <button className="btn" onClick={onClose}>Close</button>
      }
    >
      {err && <div className="err">{err}</div>}

      {code ? (
        <>
          <div className="ok-banner">
            <Icon.check size={15} /> {user.name} can sign in with this code.
          </div>
          <div className="share-box">
            <input type="text" readOnly value={code} onFocus={(e) => e.target.select()} />
            <button
              className="btn primary"
              onClick={async () => {
                await navigator.clipboard.writeText(code)
                setCopied(true); setTimeout(() => setCopied(false), 1700)
              }}
            >
              {copied ? <><Icon.check size={14} /> Copied</> : 'Copy'}
            </button>
          </div>
          <p className="dim" style={{ fontSize: 12.5, lineHeight: 1.6 }}>
            Send it to them now — it is stored hashed and cannot be shown again.
            Issue a new one any time; the old one stops working the moment you do.
          </p>
        </>
      ) : hasBoard ? (
        <p className="muted" style={{ fontSize: 13.5, lineHeight: 1.6 }}>
          {user.name} already has a board. Their existing code still works — issuing a
          new one replaces it.
        </p>
      ) : (
        <>
          <p className="muted" style={{ fontSize: 13.5, lineHeight: 1.6 }}>
            They get their own “On me” list and their own sign-in. You can hand tasks
            to their board, and they can hand things back. The team, projects and
            scoreboard stay shared — it is one organisation, not two.
          </p>
          <div className="field">
            <label>Code (leave blank for a generated one)</label>
            <input
              type="text" value={custom} placeholder="At least 6 characters"
              onChange={(e) => setCustom(e.target.value)}
            />
          </div>
          <button className="btn primary wide" disabled={busy} onClick={grant}>
            {busy ? <span className="spinner" /> : `Give ${user.name} a board`}
          </button>
        </>
      )}
    </Modal>
  )
}
