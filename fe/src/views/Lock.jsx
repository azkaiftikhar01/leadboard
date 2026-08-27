import { useEffect, useRef, useState } from 'react'
import { api } from '../lib/api.js'
import { Icon } from '../components/ui.jsx'

/**
 * The gate.
 *
 * A password box is the least interesting screen in any product, and it is the
 * first thing he sees every morning — so the mark does the work. It follows the
 * pointer while he is deciding, shuts its eyes the moment he starts typing (it
 * is not looking at the passphrase), shakes its head on a wrong one, and grins
 * on the way in. Cheap to build, and it makes the front door feel like the app.
 */
export function Lock({ onIn }) {
  const [pw, setPw] = useState('')
  const [state, setState] = useState('idle') // idle | busy | wrong | in
  const [gaze, setGaze] = useState({ x: 0, y: 0 })
  const wrap = useRef(null)

  useEffect(() => {
    const move = (e) => {
      const box = wrap.current?.getBoundingClientRect()
      if (!box) return
      const cx = box.left + box.width / 2
      const cy = box.top + box.height / 2
      const dx = (e.clientX - cx) / box.width
      const dy = (e.clientY - cy) / box.height
      // clamped so the pupils never leave the eye
      setGaze({ x: Math.max(-1, Math.min(1, dx)) * 1.1, y: Math.max(-1, Math.min(1, dy)) * 0.9 })
    }
    window.addEventListener('pointermove', move)
    return () => window.removeEventListener('pointermove', move)
  }, [])

  const go = async (e) => {
    e?.preventDefault()
    if (!pw || state === 'busy') return
    setState('busy')
    try {
      await api.login(pw)
      setState('in')
      // let the grin land before the app swaps in
      setTimeout(onIn, 620)
    } catch {
      setState('wrong')
      setPw('')
      setTimeout(() => setState('idle'), 900)
    }
  }

  const typing = pw.length > 0 && state !== 'in'

  return (
    <div className="lock">
      <div className="lock-aura" aria-hidden="true"><b /><b /><b /></div>
      <FloatingBits />

      <form className={`lock-card ${state}`} onSubmit={go} ref={wrap}>
        <LockMark gaze={gaze} typing={typing} state={state} />

        <h1 className="lock-title">
          {state === 'in' ? 'Welcome back' : state === 'wrong' ? 'Nope.' : 'LeadBoard'}
        </h1>
        <p className="lock-sub">
          {state === 'in'
            ? 'Opening the board…'
            : state === 'wrong'
              ? 'That’s not the one. Try again.'
              : 'Private board. One passphrase, then it remembers you.'}
        </p>

        <div className="lock-field">
          <input
            type="password" autoFocus value={pw} placeholder="Passphrase"
            disabled={state === 'busy' || state === 'in'}
            onChange={(e) => setPw(e.target.value)}
          />
          <button className="lock-go" type="submit" disabled={!pw || state === 'busy' || state === 'in'} aria-label="Open">
            {state === 'busy' ? <span className="spinner" /> : <Icon.arrow size={18} />}
          </button>
        </div>

        <span className="lock-dots" aria-hidden="true">
          {Array.from({ length: 6 }, (_, i) => (
            <i key={i} className={i < Math.min(pw.length, 6) ? 'on' : ''} />
          ))}
        </span>
      </form>
    </div>
  )
}

/** The clipboard, with a face that reacts. */
function LockMark({ gaze, typing, state }) {
  const ex = typing ? 0 : gaze.x
  const ey = typing ? 0 : gaze.y

  return (
    <svg className="lock-mark" viewBox="0 0 64 64" width="104" height="104" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id="lockg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#F97316" />
          <stop offset="48%" stopColor="#E0487E" />
          <stop offset="100%" stopColor="#5B2B9E" />
        </linearGradient>
      </defs>

      <g stroke="url(#lockg)" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round">
        <rect x="13" y="12.5" width="33" height="42" rx="7" />
        <path d="M23.5 12.5V10a2.6 2.6 0 0 1 2.6-2.6h7.3A2.6 2.6 0 0 1 36 10v2.5" />
        <path d="M7.5 14.5 5 12M6.5 21H3.4M9.5 8.4 7.8 6.2" strokeWidth="3" />
        <path d="M20.5 39.5h9M20.5 46.5h13" strokeWidth="3" />
        <path
          className={`lock-tick${state === 'in' ? ' drawn' : ''}`}
          d="M34.5 41.2 37.6 44.4 43.5 37.5" strokeWidth="3.2"
        />
        {/* eyes shut while typing — it is not looking at the passphrase */}
        {typing ? (
          <g strokeWidth="2.6">
            <path d="M23.4 24.8q2.2 2 4.4 0" />
            <path d="M31.4 24.8q2.2 2 4.4 0" />
          </g>
        ) : null}
        <path
          d={state === 'wrong' ? 'M25.5 32.5a4.6 4.6 0 0 1 8 0' : 'M25.5 30.5a4.6 4.6 0 0 0 8 0'}
          strokeWidth="3" className="lock-mouth"
        />
      </g>

      <g fill="url(#lockg)">
        <circle cx="29.5" cy="10.6" r="2.1" />
        <circle cx="16.6" cy="39.5" r="1.9" />
        <circle cx="16.6" cy="46.5" r="1.9" />
        {!typing && (
          <>
            <ellipse cx={25.6 + ex} cy={24.6 + ey} rx="1.9" ry="2.4" />
            <ellipse cx={33.6 + ex} cy={24.6 + ey} rx="1.9" ry="2.4" />
          </>
        )}
      </g>
    </svg>
  )
}

/** Slow-drifting sample chips — a glimpse of what is behind the door. */
function FloatingBits() {
  const bits = [
    { t: 'Send Asad the staging key', tone: 'lead', x: 12, y: 22, d: 0 },
    { t: 'Sign-off on payment scope', tone: 'client', x: 74, y: 30, d: 1.4 },
    { t: 'Grid overflow · day 3', tone: 'team', x: 18, y: 72, d: 2.6 },
    { t: 'Clean run  +2', tone: 'good', x: 70, y: 68, d: 3.8 },
  ]
  return (
    <div className="lock-bits" aria-hidden="true">
      {bits.map((b) => (
        <span
          key={b.t} className={`lock-bit ${b.tone}`}
          style={{ left: `${b.x}%`, top: `${b.y}%`, animationDelay: `${b.d}s` }}
        >
          {b.t}
        </span>
      ))}
    </div>
  )
}
