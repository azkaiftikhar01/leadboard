import { useEffect } from 'react'
import { Identicon, gradientFor } from './Identicon.jsx'
import { Icon } from './icons.jsx'

export { Identicon, gradientFor, Icon }

export const Avatar = ({ user, size = 28 }) =>
  <Identicon name={user?.name || '?'} size={size} rounded={size > 32 ? 12 : 9} />

export const Tag = ({ tone = '', dot = false, children, title }) => (
  <span className={`tag ${tone}${dot ? ' dot' : ''}`} title={title}>{children}</span>
)

export const Empty = ({ icon = 'check', children }) => {
  const I = Icon[icon] || Icon.check
  return <div className="empty"><div className="ico"><I size={26} /></div>{children}</div>
}

export const Spinner = () => <div className="empty"><span className="spinner" /></div>

export function Streak({ count }) {
  return (
    <span className={`streak${count ? '' : ' cold'}`} title="Consecutive weekdays with a standup">
      <Icon.flame size={14} />
      {count ? `${count} day${count === 1 ? '' : 's'}` : 'no streak yet'}
    </span>
  )
}

/**
 * Load dial. A ring reads as "how full" instantly in a way a number never does,
 * and the arc can overshoot past 100% without breaking the shape — which is
 * exactly the state he most needs to notice.
 */
export function Dial({ pct = 0, size = 46, stroke = 5 }) {
  const r = (size - stroke) / 2
  const circ = 2 * Math.PI * r
  const shown = Math.min(pct, 100)
  const over = pct > 100
  const colour = over ? 'var(--c-warm)' : pct > 85 ? 'var(--warn)' : pct > 55 ? 'var(--c-primary)' : 'var(--good)'

  return (
    <div className="dial" style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--s-3)" strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke={colour} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={circ} strokeDashoffset={circ - (shown / 100) * circ}
          style={{ transition: 'stroke-dashoffset .6s cubic-bezier(.22,.9,.3,1)' }}
        />
      </svg>
      <div className="val" style={{ color: colour }}>{pct}</div>
    </div>
  )
}

/** Segmented bar — each project is its own block, so he can see what the load
 *  is made of, not just how big it is. */
export function LoadMeter({ assignments = [], capacity = 100 }) {
  const total = assignments.reduce((s, a) => s + a.effective, 0)
  const scale = Math.max(capacity, total, 1)
  return (
    <div className="meter">
      {assignments.map((a, i) => (
        <i
          key={i}
          style={{ width: `${(a.effective / scale) * 100}%`, background: `linear-gradient(135deg, ${gradientFor(a.project.name).join(', ')})` }}
          title={`${a.project.name} — ${a.allocation}% × ${a.weight} = ${a.effective}`}
        />
      ))}
    </div>
  )
}

export const dueLabel = (d) => {
  if (!d) return null
  const days = Math.round((new Date(d).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0)) / 86_400_000)
  if (days < 0) return { text: `${-days}d late`, tone: 'red' }
  if (days === 0) return { text: 'today', tone: 'red' }
  if (days === 1) return { text: 'tomorrow', tone: 'amber' }
  if (days <= 3) return { text: `${days}d`, tone: 'amber' }
  return { text: `${days}d`, tone: '' }
}

export function Modal({ title, sub, onClose, children, foot, wide }) {
  useEffect(() => {
    const k = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [onClose])

  return (
    <div className="scrim" onClick={onClose}>
      <div className="modal" style={wide ? { maxWidth: 760 } : undefined} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>{title}</h2>
          {sub && <div className="muted" style={{ fontSize: 12.5, marginTop: 5 }}>{sub}</div>}
        </div>
        <div className="modal-body">{children}</div>
        {foot && <div className="modal-foot">{foot}</div>}
      </div>
    </div>
  )
}

export const Field = ({ label, children }) => (
  <div className="field"><label>{label}</label>{children}</div>
)

export const pct = (n) => (n === null || n === undefined ? '—' : `${Math.round(n * 100)}%`)
export const fmt = (n, d = 1) => (n === null || n === undefined ? '—' : Number(n).toFixed(d))
