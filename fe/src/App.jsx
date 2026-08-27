import { useCallback, useEffect, useState } from 'react'
import { Today } from './views/Today.jsx'
import { Team } from './views/Team.jsx'
import { Projects } from './views/Projects.jsx'
import { Review } from './views/Review.jsx'
import { Standup } from './views/Standup.jsx'
import { Scoreboard } from './views/Scoreboard.jsx'
import { Inbox } from './views/Inbox.jsx'
import { Start } from './views/Start.jsx'
import { Lock } from './views/Lock.jsx'
import { Mic } from './components/Mic.jsx'
import { Dock } from './components/Dock.jsx'
import { Palette } from './components/Palette.jsx'
import { CaptureChips } from './components/CaptureChips.jsx'
import { Icon, Aura } from './components/ui.jsx'
import { GiveAward } from './components/GiveAward.jsx'
import { QuickTask } from './components/QuickTask.jsx'
import { useTheme } from './lib/useTheme.js'
import { useCapture } from './lib/useCapture.js'
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

const DOCK = [
  { side: 'l', to: '#/', label: 'Today', icon: 'today', badge: 'owed', calm: true },
  { side: 'l', to: '#/standup', label: 'Standup', icon: 'sun' },
  { side: 'l', to: '#/review', label: 'Review', icon: 'review', badge: 'review' },
  { side: 'r', to: '#/projects', label: 'Projects', icon: 'projects' },
  { side: 'r', to: '#/inbox', label: 'Inbox', icon: 'inbox', badge: 'inbox' },
  { side: 'r', to: '#/team', label: 'Team', icon: 'team' },
  { side: 'r', to: '#/score', label: 'Scoreboard', icon: 'chart' },
]

const ROUTES = {
  '#/standup': Standup, '#/review': Review, '#/inbox': Inbox,
  '#/team': Team, '#/projects': Projects, '#/score': Scoreboard,
}

export default function App() {
  const view = new URLSearchParams(location.search).get('view')
  const hash = useHash()
  const { theme, toggle: toggleTheme } = useTheme()
  const [counts, setCounts] = useState(null)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [giving, setGiving] = useState(false)
  const [adding, setAdding] = useState(false)
  const [authed, setAuthed] = useState(null)

  useEffect(() => {
    api.authState().then((a) => setAuthed(a.authed)).catch(() => setAuthed(false))
  }, [])
  const cap = useCapture({ source: 'window' })

  const pull = useCallback(async () => {
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
  }, [])

  useEffect(() => { pull() }, [hash, pull])
  useEffect(() => {
    const t = setInterval(pull, 30_000)
    return () => clearInterval(t)
  }, [pull])

  // ⌘K anywhere; ⌘⇧Space starts a capture without reaching for the dock
  useEffect(() => {
    const k = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setPaletteOpen((v) => !v) }
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.code === 'Space') { e.preventDefault(); cap.toggle() }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'n') { e.preventDefault(); setAdding(true) }
    }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [cap])

  if (authed === null) return <div className="lock"><span className="spinner" /></div>
  if (authed === false) return <Lock onIn={() => { setAuthed(true); pull() }} />

  if (view === 'popover') return <div className="popover"><Today /></div>
  if (view === 'capture') return <CaptureOverlay />

  const firstRun = counts && !counts.projects && hash === '#/'
  const View = ROUTES[hash] || Today

  const go = (to) => { location.hash = to }
  const paletteItems = [
    { label: 'Today', icon: 'today', group: 'Go', run: () => go('#/') },
    { label: 'Standup', icon: 'sun', group: 'Go', run: () => go('#/standup') },
    { label: 'Review queue', icon: 'review', group: 'Go', run: () => go('#/review') },
    { label: 'Inbox', icon: 'inbox', group: 'Go', run: () => go('#/inbox') },
    { label: 'Team & bandwidth', icon: 'team', group: 'Go', run: () => go('#/team') },
    { label: 'Projects', icon: 'projects', group: 'Go', run: () => go('#/projects') },
    { label: 'Scoreboard', icon: 'chart', group: 'Go', run: () => go('#/score') },
    { label: 'Log what you saw', icon: 'spark', group: 'Do', run: () => setGiving(true) },
    { label: 'Add a task', icon: 'plus', group: 'Do', run: () => setAdding(true) },
    { label: 'Start a capture', icon: 'mic', group: 'Do', run: () => cap.toggle() },
    { label: theme === 'light' ? 'Switch to dark' : 'Switch to light', icon: theme === 'light' ? 'moon' : 'sun', group: 'Do', run: toggleTheme },
  ]

  return (
    <div className="shell">
      <Aura />
      <a href="#/" className="brand-corner" aria-label="LeadBoard — Today">
        <img src="/logo-wordmark.png" alt="LeadBoard" />
      </a>
      <main className="main">
        {firstRun ? <Start counts={counts} onGo={go} /> : <View />}
      </main>

      {(cap.live || cap.capture || cap.error || cap.status) && (
        <div className="sheet-wrap">
          <div className="sheet">
            {cap.error && <div className="err" style={{ marginBottom: 10 }}>{cap.error}</div>}
            {cap.live && (
              <div className="row-between" style={{ marginBottom: cap.interim ? 10 : 0 }}>
                <span className="inline" style={{ gap: 9, color: 'var(--c-warm)' }}>
                  <span style={{ width: 8, height: 8, borderRadius: 99, background: 'var(--c-warm)' }} />
                  <span style={{ fontWeight: 620 }}>Listening</span>
                </span>
                <span className="num dim">
                  {String(Math.floor(cap.seconds / 60)).padStart(2, '0')}:{String(cap.seconds % 60).padStart(2, '0')}
                </span>
              </div>
            )}
            {cap.interim && <div className="mic-live-text" style={{ maxWidth: 'none', textAlign: 'left' }}>{cap.interim}</div>}
            {cap.status && <div className="inline" style={{ gap: 9 }}><span className="spinner" /><span className="muted">{cap.status}…</span></div>}
            {cap.capture && (
              <div className="stack" style={{ gap: 7 }}>
                <CaptureChips capture={cap.capture} onChange={(c) => { cap.setCapture(c); pull() }} />
                <button className="btn ghost sm" onClick={() => cap.setCapture(null)}>Dismiss</button>
              </div>
            )}
          </div>
        </div>
      )}

      <Dock
        items={DOCK} hash={hash} counts={counts || {}}
        micLive={cap.live} micLevel={cap.level} onMic={cap.toggle}
        onAdd={() => setAdding(true)}
        onPalette={() => setPaletteOpen(true)}
        theme={theme} onTheme={toggleTheme}
      />

      {paletteOpen && <Palette items={paletteItems} onClose={() => setPaletteOpen(false)} />}
      {giving && <GiveAward onClose={() => setGiving(false)} onDone={pull} />}
      {adding && <QuickTask onClose={() => setAdding(false)} onDone={pull} />}
    </div>
  )
}

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
      {capture && <button className="btn wide" style={{ marginTop: 12 }} onClick={() => window.leadboard?.closeCapture()}>Done</button>}
    </div>
  )
}
