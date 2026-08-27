import { useEffect, useState } from 'react'
import { Today } from './views/Today.jsx'
import { Team } from './views/Team.jsx'
import { Projects } from './views/Projects.jsx'
import { Review } from './views/Review.jsx'
import { Standup } from './views/Standup.jsx'
import { People } from './views/People.jsx'
import { Inbox } from './views/Inbox.jsx'
import { Start } from './views/Start.jsx'
import { Mic } from './components/Mic.jsx'
import { CaptureChips } from './components/CaptureChips.jsx'
import { Icon } from './components/ui.jsx'
import { useTheme } from './lib/useTheme.js'
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
  { to: '#/', label: 'Today', icon: 'today', badge: 'owed' },
  { to: '#/standup', label: 'Standup', icon: 'sun' },
  { to: '#/review', label: 'Review', icon: 'review', badge: 'review' },
  { to: '#/inbox', label: 'Inbox', icon: 'inbox', badge: 'inbox' },
]
const NAV_SETUP = [
  { to: '#/team', label: 'Team', icon: 'team' },
  { to: '#/projects', label: 'Projects', icon: 'projects' },
  { to: '#/people', label: 'Scorecards', icon: 'chart' },
]

const ROUTES = {
  '#/standup': Standup, '#/review': Review, '#/inbox': Inbox,
  '#/team': Team, '#/projects': Projects, '#/people': People,
}

export default function App() {
  const view = new URLSearchParams(location.search).get('view')
  const hash = useHash()
  const { theme, toggle } = useTheme()
  const [counts, setCounts] = useState(null)

  const pull = async () => {
    try {
      const [today, review, people, projects] = await Promise.all([
        api.today(), api.reviewQueue(), api.people(), api.projects(),
      ])
      setCounts({
        owed: today.badge.owed, inbox: today.inboxCount, review: review.length, streak: today.streak,
        people: people.filter((p) => p.role === 'dev').length,
        projects: projects.length,
        assigned: projects.filter((p) => p.members?.length).length,
      })
    } catch { setCounts((c) => c ?? {}) }
  }

  useEffect(() => { pull() }, [hash])
  useEffect(() => {
    const t = setInterval(pull, 30_000)
    return () => clearInterval(t)
  }, [])

  if (view === 'popover') return <div className="popover"><Today /></div>
  if (view === 'capture') return <CaptureOverlay />

  // an empty install lands on setup rather than on three empty columns
  const firstRun = counts && !counts.projects && hash === '#/'
  const View = ROUTES[hash] || Today

  return (
    <div className="shell">
      <Rail hash={hash} counts={counts || {}} theme={theme} onToggleTheme={toggle} />
      <main className="main">
        {firstRun ? <Start counts={counts} onGo={(to) => { location.hash = to }} /> : <View />}
      </main>
    </div>
  )
}

function Rail({ hash, counts, theme, onToggleTheme }) {
  const Item = ({ to, label, icon, badge }) => {
    const I = Icon[icon]
    const n = badge ? counts[badge] : 0
    return (
      <a href={to} className={`nav-item${hash === to ? ' on' : ''}`}>
        <I size={17} />
        <span className="label">{label}</span>
        {n > 0 && <span className={`count ${badge === 'review' ? 'hot' : badge === 'owed' ? 'warm' : ''}`}>{n}</span>}
      </a>
    )
  }

  return (
    <nav className="rail">
      <div className="brand">
        <span className="mark"><Icon.brand size={17} /></span>
        <span className="name">Leadboard</span>
      </div>

      {NAV.map((n) => <Item key={n.to} {...n} />)}
      <div className="rail-group eyebrow">Setup</div>
      {NAV_SETUP.map((n) => <Item key={n.to} {...n} />)}

      <div className="rail-foot">
        {counts.streak > 0 && (
          <div className="card" style={{ padding: 13, boxShadow: 'none' }}>
            <div className="eyebrow" style={{ marginBottom: 6 }}>Streak</div>
            <div className="inline" style={{ gap: 7 }}>
              <span style={{ color: 'var(--c-sun)' }}><Icon.flame size={19} /></span>
              <span style={{ fontSize: 21, fontWeight: 700, letterSpacing: '-.02em' }}>{counts.streak}</span>
              <span className="dim" style={{ fontSize: 11.5 }}>days</span>
            </div>
          </div>
        )}
        <button className="theme-toggle" onClick={onToggleTheme}>
          {theme === 'light' ? <Icon.moon size={15} /> : <Icon.sun size={15} />}
          <span>{theme === 'light' ? 'Dark' : 'Light'}</span>
        </button>
      </div>
    </nav>
  )
}

/** Global hotkey overlay. Speak, confirm, gone. */
function CaptureOverlay() {
  const [capture, setCapture] = useState(null)
  useEffect(() => {
    const k = (e) => e.key === 'Escape' && window.leadboard?.closeCapture()
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [])

  return (
    <div className="popover">
      <Mic source="hotkey" onCapture={setCapture} hint="Speak. Esc to dismiss." />
      {capture && (
        <div className="stack" style={{ gap: 7, marginTop: 12 }}>
          <CaptureChips capture={capture} onChange={setCapture} />
          <button className="btn wide" onClick={() => window.leadboard?.closeCapture()}>Done</button>
        </div>
      )}
    </div>
  )
}
