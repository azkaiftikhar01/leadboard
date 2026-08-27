import { useState } from 'react'
import { api } from '../lib/api.js'
import { Icon } from '../components/ui.jsx'

/** The gate. One shared passphrase — this is a private board, not a product. */
export function Lock({ onIn }) {
  const [pw, setPw] = useState('')
  const [err, setErr] = useState(null)
  const [busy, setBusy] = useState(false)

  const go = async (e) => {
    e?.preventDefault()
    if (!pw) return
    setBusy(true); setErr(null)
    try { await api.login(pw); onIn() }
    catch { setErr('That’s not it.') }
    finally { setBusy(false) }
  }

  return (
    <div className="lock">
      <form className="lock-card" onSubmit={go}>
        <img src="/logo-wordmark.png" alt="LeadBoard" />
        <p>This board is private.</p>
        <input
          type="password" autoFocus value={pw} placeholder="Passphrase"
          onChange={(e) => setPw(e.target.value)}
        />
        {err && <div className="err">{err}</div>}
        <button className="btn primary wide" disabled={!pw || busy} type="submit">
          {busy ? <span className="spinner" /> : <>Open <Icon.arrow size={15} /></>}
        </button>
      </form>
    </div>
  )
}
