import { useState } from 'react'
import { api } from '../lib/api.js'
import { Brand, Icon } from '../components/ui.jsx'

/**
 * The gate.
 *
 * Deliberately quiet: the real wordmark, one field, and the same glass-card and
 * gradient-field language every other screen uses. The only motion is feedback
 * — a headshake on a wrong passphrase, a green edge on the way in — because
 * decoration on a door he opens every morning stops being charming by Thursday.
 */
export function Lock({ onIn }) {
  const [pw, setPw] = useState('')
  const [state, setState] = useState('idle') // idle | busy | wrong | in
  const [help, setHelp] = useState(false)

  const go = async (e) => {
    e?.preventDefault()
    if (!pw || state === 'busy') return
    setState('busy')
    try {
      await api.login(pw)
      setState('in')
      setTimeout(onIn, 420)
    } catch {
      setState('wrong')
      setPw('')
      setTimeout(() => setState('idle'), 800)
    }
  }

  return (
    <div className="lock">
      <div className="aura" aria-hidden="true"><b /><b /><b /></div>

      <form className={`lock-card ${state}`} onSubmit={go}>
        <Brand size={30} className="lock-logo" />

        <p className="lock-sub">
          {state === 'in'
            ? 'Opening the board…'
            : state === 'wrong'
              ? 'That’s not it — try again.'
              : 'Private board. One passphrase, then it remembers you.'}
        </p>

        <div className="lock-field">
          <input
            type="password" autoFocus value={pw} placeholder="Passphrase"
            disabled={state === 'busy' || state === 'in'}
            onChange={(e) => setPw(e.target.value)}
          />
          <button
            className="lock-go" type="submit" aria-label="Open"
            disabled={!pw || state === 'busy' || state === 'in'}
          >
            {state === 'busy' ? <span className="spinner" />
              : state === 'in' ? <Icon.check size={18} />
              : <Icon.arrow size={18} />}
          </button>
        </div>
        <button type="button" className="lock-help" onClick={() => setHelp((v) => !v)}>
          Forgotten it?
        </button>

        {help && (
          <p className="lock-help-text">
            Use the <b>APP_PASSWORD</b> from your deployment settings — it always works,
            so you can get back in and set a new one from Settings.
          </p>
        )}
      </form>
    </div>
  )
}
