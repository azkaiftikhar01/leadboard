import { useCallback, useEffect, useRef, useState } from 'react'
import confetti from 'canvas-confetti'
import { api } from '../lib/api.js'
import { Icon } from './ui.jsx'

const PRESETS = [10, 15, 25, 45]

/**
 * A chime, synthesised rather than shipped.
 *
 * A bundled audio file is a network request that can fail at exactly the moment
 * it matters, and this needs to land the instant the timer does. Three notes of
 * a major triad, each with its own soft envelope - it reads as arrival rather
 * than as an alarm, which is the point: the block ending is a good thing.
 */
function chime() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext
    if (!Ctx) return
    const ctx = new Ctx()
    const now = ctx.currentTime
    // C6, E6, G6 — an arpeggio up, so it resolves
    ;[1046.5, 1318.5, 1568.0].forEach((freq, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = freq
      const t = now + i * 0.13
      gain.gain.setValueAtTime(0, t)
      gain.gain.linearRampToValueAtTime(0.22, t + 0.03)
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 1.5)
      osc.connect(gain).connect(ctx.destination)
      osc.start(t)
      osc.stop(t + 1.6)
    })
    setTimeout(() => ctx.close(), 2600)
  } catch { /* a silent finish is better than a thrown one */ }
}

const mmss = (s) =>
  `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`

/**
 * Focus mode.
 *
 * Full screen on purpose - the whole value is that everything else goes away.
 * The ring is the clock: a number counting down is information, a ring closing
 * is a feeling, and the feeling is what makes him sit through the last four
 * minutes. It breathes at roughly the pace of a slow exhale.
 */
export function Focus({ open, onClose, onFinished }) {
  const [minutes, setMinutes] = useState(10)
  const [custom, setCustom] = useState('')
  const [label, setLabel] = useState('')
  const [phase, setPhase] = useState('setup')  // setup | running | done
  const [left, setLeft] = useState(0)
  const [stats, setStats] = useState(null)
  const session = useRef(null)
  const deadline = useRef(0)

  useEffect(() => {
    if (open) api.focusState().then(setStats).catch(() => {})
  }, [open, phase])

  useEffect(() => {
    if (!open) { setPhase('setup'); setLabel(''); setCustom('') }
  }, [open])

  const finish = useCallback(async () => {
    setPhase('done')
    chime()
    confetti({ particleCount: 130, spread: 78, origin: { y: 0.62 }, disableForReducedMotion: true,
               colors: ['#E57A44', '#F0954F', '#A8446F', '#C2536A', '#4A2A8C'] })
    setTimeout(() => confetti({ particleCount: 70, spread: 100, origin: { y: 0.5 }, disableForReducedMotion: true,
                                colors: ['#E57A44', '#A8446F'] }), 240)
    if (session.current) await api.endFocus(session.current, true).catch(() => {})
    session.current = null
    onFinished?.()
  }, [onFinished])

  // wall-clock, not a tick counter: a background tab throttles setInterval and
  // a ten-minute block would quietly become fourteen
  useEffect(() => {
    if (phase !== 'running') return
    const id = setInterval(() => {
      const remaining = Math.max(0, Math.round((deadline.current - Date.now()) / 1000))
      setLeft(remaining)
      if (remaining <= 0) { clearInterval(id); finish() }
    }, 250)
    return () => clearInterval(id)
  }, [phase, finish])

  useEffect(() => {
    if (!open) return
    const k = (e) => { if (e.key === 'Escape') phase === 'running' ? stop() : onClose() }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  })

  const start = async () => {
    const m = Number(custom) || minutes
    if (!m || m < 1) return
    deadline.current = Date.now() + m * 60_000
    setLeft(m * 60)
    setPhase('running')
    try {
      const s = await api.startFocus({ minutes: m, label: label.trim() })
      session.current = s._id
    } catch { /* the timer matters more than the record of it */ }
  }

  const stop = async () => {
    if (session.current) await api.endFocus(session.current, false).catch(() => {})
    session.current = null
    setPhase('setup')
    onFinished?.()
  }

  if (!open) return null

  const total = (Number(custom) || minutes) * 60
  const progress = phase === 'running' && total ? 1 - left / total : 0
  const R = 132
  const C = 2 * Math.PI * R

  return (
    <div className={`focus ${phase}`}>
      <div className="focus-aura" aria-hidden="true"><b /><b /><b /></div>

      <button className="focus-x" onClick={phase === 'running' ? stop : onClose}>
        <Icon.x size={18} />
      </button>

      {phase === 'setup' && (
        <div className="focus-setup">
          <h1>How long?</h1>
          <p>Everything else goes away until it’s done.</p>

          <div className="focus-presets">
            {PRESETS.map((m) => (
              <button
                key={m}
                className={!custom && minutes === m ? 'on' : ''}
                onClick={() => { setMinutes(m); setCustom('') }}
              >
                <b>{m}</b><i>min</i>
              </button>
            ))}
            <input
              type="number" min="1" max="180" value={custom} placeholder="Other"
              onChange={(e) => setCustom(e.target.value.replace(/\D/g, '').slice(0, 3))}
            />
          </div>

          <input
            className="focus-label" type="text" value={label}
            placeholder="What are you working on? (optional)"
            onChange={(e) => setLabel(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && start()}
          />

          <button className="btn primary focus-go" onClick={start}>
            Start {Number(custom) || minutes} minutes
          </button>

          {stats && (stats.todayCount > 0 || stats.streak > 0) && (
            <div className="focus-stats">
              {stats.todayCount > 0 && <span>{stats.todayCount} today · {stats.todayMinutes} min</span>}
              {stats.streak > 0 && <span><Icon.flame size={13} /> {stats.streak} day streak</span>}
            </div>
          )}
        </div>
      )}

      {phase !== 'setup' && (
        <div className="focus-ring-wrap">
          <svg className="focus-ring" width="320" height="320" viewBox="0 0 320 320">
            <defs>
              <linearGradient id="fring" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#F5A65C" />
                <stop offset="50%" stopColor="#E57A44" />
                <stop offset="100%" stopColor="#A8446F" />
              </linearGradient>
            </defs>
            <circle cx="160" cy="160" r={R} fill="none" stroke="var(--s-3)" strokeWidth="10" />
            <circle
              cx="160" cy="160" r={R} fill="none" stroke="url(#fring)" strokeWidth="10"
              strokeLinecap="round" transform="rotate(-90 160 160)"
              strokeDasharray={C}
              strokeDashoffset={phase === 'done' ? 0 : C * (1 - progress)}
              style={{ transition: 'stroke-dashoffset .3s linear' }}
            />
          </svg>

          <div className="focus-centre">
            {phase === 'running' ? (
              <>
                <div className="focus-time num">{mmss(left)}</div>
                {label && <div className="focus-doing">{label}</div>}
              </>
            ) : (
              <>
                <div className="focus-tick"><Icon.check size={44} /></div>
                <div className="focus-done-n">{Number(custom) || minutes} minutes</div>
                <div className="focus-doing">{label || 'Nicely done.'}</div>
              </>
            )}
          </div>
        </div>
      )}

      {phase === 'running' && (
        <button className="btn focus-stop" onClick={stop}>Give up</button>
      )}
      {phase === 'done' && (
        <div className="focus-again">
          <button className="btn" onClick={() => setPhase('setup')}>Another one</button>
          <button className="btn primary" onClick={onClose}>Back to the board</button>
        </div>
      )}
    </div>
  )
}
