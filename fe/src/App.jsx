import { useEffect, useState } from 'react'
import { Today } from './views/Today.jsx'
import { Team } from './views/Team.jsx'
import { Projects } from './views/Projects.jsx'
import { Review } from './views/Review.jsx'
import { Standup } from './views/Standup.jsx'
import { People } from './views/People.jsx'
import { Inbox } from './views/Inbox.jsx'
import { Mic } from './components/Mic.jsx'
import { CaptureChips } from './components/CaptureChips.jsx'
import { api } from './lib/api.js'

const useHash = () => {
  const [hash, setHash] = useState(location.hash || '#/')
  useEffect(() => {
    const on = () => setHash(location.hash || '#/')
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  return hash
}

const NAV = [
  { to: '#/', label: 'Today', ico: '◎', badge: 'owed' },
  { to: '#/standup', label: 'Standup', ico: '☀' },
  { to: '#/review', label: 'Review', ico: '⌾', badge: 'review' },
  { to: '#/inbox', label: 'Inbox', ico: '⌂', badge: 'inbox' },
]
const NAV_SETUP = [
  { to: '#/team', label: 'Team', ico: '◍' },
  { to: '#/projects', label: 'Projects', ico: '▦' },
  { to: '#/people', label: 'Scorecards', ico: '◈' },
]

const ROUTES = {
  '#/': Today,
  '#/standup': Standup,
  '#/review': Review,
  '#/inbox': Inbox,
  '#/team': Team,
  '#/projects': Projects,
  '#/people': People,
}

export default function App() {
  const view = new URLSearchParams(location.search).get('view')
  const hash = useHash()

  if (view === 'popover') return <div className="popover"><Today /></div>
  if (view === 'capture') return <CaptureOverlay />

  const View = ROUTES[hash] || Today
  return (
    <div className="shell">
      <Rail hash={hash} />
      <main className="main"><View /></main>
    </div>
  )
}

function Rail({ hash }) {
  const [counts, setCounts] = useState({})

  useEffect(() => {
    const pull = async () => {
      try {
        const [today, review] = await Promise.all([api.today(), api.reviewQueue()])
        setCounts({ owed: today.badge.owed, inbox: today.inboxCount, review: review.length, streak: today.streak })
      } catch { /* rail badges are decoration; never let them break the shell */ }
    }
    pull()
    const t = setInterval(pull, 30_000)
    return () => clearInterval(t)
  }, [hash])

  const Item = ({ to, label, ico, badge }) => {
    const n = badge ? counts[badge] : 0
    return (
      <a href={to} className={`nav-item${hash === to ? ' on' : ''}`}>
        <span className="ico">{ico}</span>
        <span className="label">{label}</span>
        {n > 0 && <span className={`count ${badge === 'owed' ? 'warm' : badge === 'review' ? 'hot' : ''}`}>{n}</span>}
      </a>
    )
  }

  return (
    <nav className="rail">
      <div className="brand">
        <span className="mark">◆</span>
        <span className="name">Leadboard</span>
      </div>

      {NAV.map((n) => <Item key={n.to} {...n} />)}

      <div className="rail-group eyebrow">Setup</div>
      {NAV_SETUP.map((n) => <Item key={n.to} {...n} />)}

      <div className="rail-foot">
        <div className="card" style={{ padding: 11, background: 'var(--n-2)' }}>
          <div className="eyebrow" style={{ marginBottom: 5 }}>Streak</div>
          <div style={{ fontSize: 19, fontWeight: 700 }}>
            {counts.streak ? `🔥 ${counts.streak}` : '—'}
          </div>
          <div className="dim" style={{ fontSize: 11, marginTop: 2 }}>
            {counts.streak ? 'days running' : 'do a standup'}
          </div>
        </div>
      </div>
    </nav>
  )
}

/** ⌥Space from anywhere. Speak, confirm, gone — no context switch. */
function CaptureOverlay() {
  const [capture, setCapture] = useState(null)
  useEffect(() => {
    const k = (e) => e.key === 'Escape' && window.leadboard?.closeCapture()
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [])

  return (
    <div className="popover">
      <Mic source="hotkey" onCapture={setCapture} hint="⌥Space anywhere. Esc to dismiss." />
      {capture && (
        <div className="stack" style={{ gap: 6, marginTop: 10 }}>
          <CaptureChips capture={capture} onChange={setCapture} />
          <button className="btn wide" onClick={() => window.leadboard?.closeCapture()}>Done</button>
        </div>
      )}
    </div>
  )
}
