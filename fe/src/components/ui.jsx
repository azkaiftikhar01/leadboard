import { useEffect } from 'react'
import { Identicon, gradientFor } from './Identicon.jsx'
import { Icon, Mark } from './icons.jsx'

export { Identicon, gradientFor, Icon, Mark }

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

export const dueLabel = (d, hasTime = false) => {
  if (!d) return null
  if (hasTime) {
    const mins = Math.round((new Date(d) - Date.now()) / 60_000)
    if (mins < -60) return { text: `${Math.round(-mins / 60)}h late`, tone: 'red' }
    if (mins < 0) return { text: `${-mins}m late`, tone: 'red' }
    if (mins < 60) return { text: `in ${mins}m`, tone: 'red' }
    if (mins < 60 * 8) return { text: `in ${Math.round(mins / 60)}h`, tone: 'amber' }
  }
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

/** Ambient gradient field. Sits behind everything, moves with the theme, and
 *  keeps a mostly-empty board from reading as a blank page. */
export const Aura = () => (
  <div className="aura" aria-hidden="true"><b /><b /><b /></div>
)

/** Illustrated empty state. A drawn scene reads as "nothing here yet" where a
 *  20px icon reads as "something failed". */
export function EmptyArt({ kind = 'check', children, action }) {
  const art = {
    check: (
      <svg width="96" height="72" viewBox="0 0 96 72" fill="none">
        <defs><linearGradient id="ea1" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#06B6D4" /><stop offset="100%" stopColor="#10B981" />
        </linearGradient></defs>
        <rect x="18" y="14" width="60" height="44" rx="9" fill="url(#ea1)" opacity=".12" />
        <rect x="18" y="14" width="60" height="44" rx="9" stroke="url(#ea1)" strokeWidth="1.6" opacity=".5" />
        <path d="M36 36l8 8 16-16" stroke="url(#ea1)" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    team: (
      <svg width="96" height="72" viewBox="0 0 96 72" fill="none">
        <defs><linearGradient id="ea2" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#8B5CF6" /><stop offset="100%" stopColor="#EC4899" />
        </linearGradient></defs>
        <circle cx="36" cy="27" r="10" fill="url(#ea2)" opacity=".18" />
        <circle cx="36" cy="27" r="10" stroke="url(#ea2)" strokeWidth="1.6" opacity=".55" />
        <path d="M20 56a16 16 0 0 1 32 0" stroke="url(#ea2)" strokeWidth="1.6" opacity=".55" strokeLinecap="round" />
        <circle cx="62" cy="31" r="7.5" stroke="url(#ea2)" strokeWidth="1.6" opacity=".3" />
        <path d="M50 56a13 13 0 0 1 26 0" stroke="url(#ea2)" strokeWidth="1.6" opacity=".3" strokeLinecap="round" />
      </svg>
    ),
    projects: (
      <svg width="96" height="72" viewBox="0 0 96 72" fill="none">
        <defs><linearGradient id="ea3" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#7C3AED" /><stop offset="100%" stopColor="#06B6D4" />
        </linearGradient></defs>
        {[[20, 16], [52, 16], [20, 42], [52, 42]].map(([x, y], i) => (
          <rect key={i} x={x} y={y} width="24" height="18" rx="5"
            fill="url(#ea3)" fillOpacity={i === 0 ? '.2' : '.08'}
            stroke="url(#ea3)" strokeWidth="1.5" strokeOpacity={i === 0 ? '.6' : '.28'} />
        ))}
      </svg>
    ),
    inbox: (
      <svg width="96" height="72" viewBox="0 0 96 72" fill="none">
        <defs><linearGradient id="ea4" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#FBBF24" /><stop offset="100%" stopColor="#F97316" />
        </linearGradient></defs>
        <path d="M22 26h52l6 20v10a5 5 0 0 1-5 5H21a5 5 0 0 1-5-5V46l6-20Z"
          fill="url(#ea4)" fillOpacity=".13" stroke="url(#ea4)" strokeWidth="1.6" strokeOpacity=".55" strokeLinejoin="round" />
        <path d="M16 46h18l4 7h20l4-7h18" stroke="url(#ea4)" strokeWidth="1.6" strokeOpacity=".55" strokeLinejoin="round" />
        <path d="M48 10v11M40 15l8 6 8-6" stroke="url(#ea4)" strokeWidth="1.6" strokeOpacity=".38" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    review: (
      <svg width="96" height="72" viewBox="0 0 96 72" fill="none">
        <defs><linearGradient id="ea5" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#10B981" /><stop offset="100%" stopColor="#06B6D4" />
        </linearGradient></defs>
        <circle cx="48" cy="36" r="21" fill="url(#ea5)" opacity=".1" />
        <circle cx="48" cy="36" r="21" stroke="url(#ea5)" strokeWidth="1.7" opacity=".5" />
        <path d="M39 36.5l6.5 6.5L59 30" stroke="url(#ea5)" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  }[kind]

  return (
    <div className="empty" style={{ padding: '34px 18px' }}>
      <div className="empty-art">{art}</div>
      <div style={{ maxWidth: 340, margin: '0 auto', lineHeight: 1.6 }}>{children}</div>
      {action && <div style={{ marginTop: 16 }}>{action}</div>}
    </div>
  )
}

/** Compact bar sparkline — gives a stat tile a shape to read, not just a number. */
export const Spark = ({ values = [], hotLast = true }) => {
  const max = Math.max(...values, 1)
  return (
    <div className="spark">
      {values.map((v, i) => (
        <i key={i} className={hotLast && i === values.length - 1 ? 'hot' : ''}
           style={{ height: `${Math.max(8, (v / max) * 100)}%` }} />
      ))}
    </div>
  )
}


/**
 * The brand lockup: the pixel mark, then the name in the app's own face.
 *
 * The name is live text rather than part of the artwork - it stays sharp at any
 * size, respects the theme, and means the wordmark does not have to be
 * regenerated to change a colour.
 */
export const Brand = ({ size = 26, name = true, className = '' }) => (
  <span className={`brand-lockup ${className}`}>
    {/* the mark is 7 cells wide but only 5 tall, so matching its WIDTH to the
        cap height leaves it looking like a footnote next to the name */}
    <Mark size={size * 1.85} />
    {name && <b style={{ fontSize: size }}>LeadBoard</b>}
  </span>
)
