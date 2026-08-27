export const initials = (n = '?') => n.trim().slice(0, 2).toUpperCase()

export function Avatar({ user, size = 26 }) {
  return (
    <div
      className="avatar"
      style={{ background: user?.avatarColor || '#6b7cff', width: size, height: size }}
      title={user?.name}
    >
      {initials(user?.name)}
    </div>
  )
}

export function Streak({ count }) {
  const cold = !count
  return (
    <span className={`streak${cold ? ' cold' : ''}`} title="Consecutive weekdays with a standup">
      <span className="flame">{cold ? '·' : '🔥'}</span>
      {cold ? 'no streak yet' : `${count} day${count === 1 ? '' : 's'}`}
    </span>
  )
}

export function Empty({ icon = '✓', children }) {
  return (
    <div className="empty">
      <div className="big">{icon}</div>
      {children}
    </div>
  )
}

export function Pill({ tone = '', children, title }) {
  return <span className={`pill ${tone}`} title={title}>{children}</span>
}

export const dayLabel = (d) => {
  if (!d) return null
  const days = Math.round((new Date(d) - new Date().setHours(0, 0, 0, 0)) / 86_400_000)
  if (days < 0) return { text: `${-days}d overdue`, tone: 'red' }
  if (days === 0) return { text: 'today', tone: 'red' }
  if (days === 1) return { text: 'tomorrow', tone: 'amber' }
  if (days <= 3) return { text: `in ${days}d`, tone: 'amber' }
  return { text: `in ${days}d`, tone: '' }
}

export const fmt = (n, digits = 1) => (n === null || n === undefined ? '—' : n.toFixed(digits))
export const pct = (n) => (n === null || n === undefined ? '—' : `${Math.round(n * 100)}%`)
