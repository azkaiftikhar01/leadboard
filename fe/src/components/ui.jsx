import { useEffect } from 'react'

export const initials = (n = '?') =>
  n.trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase()

export function Avatar({ user, lg = false }) {
  if (!user) return <div className={`avatar${lg ? ' lg' : ''}`} style={{ background: 'var(--n-4)', color: 'var(--text-3)' }}>?</div>
  return (
    <div className={`avatar${lg ? ' lg' : ''}`} style={{ background: user.avatarColor || '#7c8cff' }} title={user.name}>
      {initials(user.name)}
    </div>
  )
}

export const Tag = ({ tone = '', dot = false, children, title }) => (
  <span className={`tag ${tone}${dot ? ' dot' : ''}`} title={title}>{children}</span>
)

export const Empty = ({ ico = '·', children }) => (
  <div className="empty"><div className="ico">{ico}</div>{children}</div>
)

export function Streak({ count }) {
  return (
    <span className={`streak${count ? '' : ' cold'}`} title="Consecutive weekdays with a standup">
      {count ? '🔥' : '·'} {count ? `${count} day${count === 1 ? '' : 's'}` : 'no streak yet'}
    </span>
  )
}

/** Segmented load bar — each project is its own segment, so he can see what
 *  the load is actually made of, not just how big it is. */
export function LoadMeter({ assignments = [], capacity = 100 }) {
  const scale = Math.max(capacity, assignments.reduce((s, a) => s + a.effective, 0))
  return (
    <div className="meter">
      {assignments.map((a, i) => (
        <i
          key={i}
          style={{ width: `${(a.effective / scale) * 100}%`, background: a.project.color || 'var(--team)' }}
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
      <div className="modal" style={wide ? { maxWidth: 720 } : undefined} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>{title}</h2>
          {sub && <div className="muted" style={{ fontSize: 12.5, marginTop: 4 }}>{sub}</div>}
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
