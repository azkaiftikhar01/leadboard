import { useEffect, useState } from 'react'
import { api } from '../lib/api.js'
import { Modal, Icon } from './ui.jsx'

const linkFor = (token) => `${location.origin}${location.pathname}#/b/${token}`

/**
 * Hand somebody their own list.
 *
 * The link is the only credential, so it is revocable and it opens a page that
 * carries the work and nothing else - no scores, no load, no sign of anyone
 * else's record. Whoever holds it can tick things off, because a to-do list
 * you cannot tick off is just a screenshot.
 */
export function ShareLink({ kind, refId, name, onClose }) {
  const [share, setShare] = useState(null)
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    api.shares(`?kind=${kind}&refId=${refId}`)
      .then((rows) => setShare(rows[0] ?? null))
      .catch(() => setShare(null))
  }, [kind, refId])

  const create = async () => {
    setBusy(true)
    try { setShare(await api.createShare({ kind, refId, label: name })) }
    finally { setBusy(false) }
  }

  const revoke = async () => {
    setBusy(true)
    try { await api.revokeShare(share._id); setShare(null) }
    finally { setBusy(false) }
  }

  const copy = async () => {
    await navigator.clipboard.writeText(linkFor(share.token))
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }

  return (
    <Modal
      title={`Share ${name}’s list`}
      sub="A link they can open without an account, and tick things off from."
      onClose={onClose}
      foot={<button className="btn" onClick={onClose}>Close</button>}
    >
      {!share ? (
        <>
          <p className="muted" style={{ fontSize: 13.5, lineHeight: 1.6 }}>
            Creates a private link showing only {name}’s open tasks. No scores, no
            load, nothing about anyone else. You can revoke it at any time.
          </p>
          <button className="btn primary wide" disabled={busy} onClick={create}>
            {busy ? <span className="spinner" /> : <>Create the link</>}
          </button>
        </>
      ) : (
        <>
          <div className="share-box">
            <input type="text" readOnly value={linkFor(share.token)} onFocus={(e) => e.target.select()} />
            <button className="btn primary" onClick={copy}>
              {copied ? <><Icon.check size={14} /> Copied</> : 'Copy'}
            </button>
          </div>

          <div className="share-meta">
            <span>{share.views} view{share.views === 1 ? '' : 's'}</span>
            {share.lastViewedAt && <span>· last opened {new Date(share.lastViewedAt).toLocaleDateString()}</span>}
            <span>· they can tick things off</span>
          </div>

          <button className="btn danger wide" disabled={busy} onClick={revoke}>
            <Icon.trash size={14} /> Revoke this link
          </button>
        </>
      )}
    </Modal>
  )
}
