import { useEffect, useState } from 'react'
import { api } from '../lib/api.js'
import { Modal, Field, Icon } from './ui.jsx'

/**
 * Settings, which for now is one thing: the passphrase.
 *
 * It used to live only in an environment variable, so changing it meant a
 * redeploy. It is stored hashed in the database now, with the env var acting as
 * the bootstrap - so the first thing this screen does is tell him he is still on
 * it, because a passphrase that shipped in a config file is not really his.
 */
export function Settings({ onClose, onSignedOut }) {
  const [state, setState] = useState(null)
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [again, setAgain] = useState('')
  const [err, setErr] = useState(null)
  const [done, setDone] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => { api.authState().then(setState).catch(() => {}) }, [])

  const signOut = async () => {
    await api.logout().catch(() => {})
    onSignedOut()
  }

  const save = async () => {
    setErr(null)
    if (next.length < 6) return setErr('New passphrase needs at least 6 characters.')
    if (next !== again) return setErr('The two new passphrases don’t match.')
    setBusy(true)
    try {
      await api.changePassphrase(current, next)
      setDone(true)
      setCurrent(''); setNext(''); setAgain('')
      setTimeout(onClose, 1200)
    } catch (e) {
      setErr(e.message === 'unauthorized' ? 'Current passphrase is wrong.' : e.message)
    } finally { setBusy(false) }
  }

  return (
    <Modal
      title="Settings"
      sub="Change the passphrase for this board."
      onClose={onClose}
      foot={
        <>
          <button className="btn danger" onClick={signOut}>
            <Icon.back size={14} /> Sign out
          </button>
          <span style={{ flex: 1 }} />
          <button className="btn ghost" onClick={onClose}>Close</button>
          <button className="btn primary" disabled={!next || !again || busy || done} onClick={save}>
            {busy ? <span className="spinner" /> : done ? <><Icon.check size={15} /> Saved</> : 'Update passphrase'}
          </button>
        </>
      }
    >
      {state?.usingBootstrap && (
        <div className="note-interim" style={{ margin: 0 }}>
          You’re still on the passphrase from the deployment config. Set your own —
          it’s stored hashed and won’t need a redeploy to change again.
        </div>
      )}

      {err && <div className="err">{err}</div>}
      {done && <div className="ok-banner"><Icon.check size={15} /> Passphrase updated. Every other session is signed out.</div>}

      <Field label="Current passphrase">
        <input type="password" value={current} placeholder="The one you used to get in"
          onChange={(e) => setCurrent(e.target.value)} />
      </Field>
      <Field label="New passphrase">
        <input type="password" value={next} placeholder="At least 6 characters"
          onChange={(e) => setNext(e.target.value)} />
      </Field>
      <Field label="New passphrase again">
        <input type="password" value={again} placeholder="Type it once more"
          onChange={(e) => setAgain(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && save()} />
      </Field>

      {state?.hasRecovery && (
        <p className="dim" style={{ fontSize: 12, lineHeight: 1.55 }}>
          Locked out? The <b>APP_PASSWORD</b> in your deployment settings always works as a
          recovery key, so a forgotten passphrase can never brick the board.
        </p>
      )}
    </Modal>
  )
}
