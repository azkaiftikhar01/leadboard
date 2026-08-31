import { useCallback, useEffect, useState } from 'react'
import { Today } from './views/Today.jsx'
import { Team } from './views/Team.jsx'
import { Projects } from './views/Projects.jsx'
import { Review } from './views/Review.jsx'
import { Standup } from './views/Standup.jsx'
import { Scoreboard } from './views/Scoreboard.jsx'
import { History } from './views/History.jsx'
import { Inbox } from './views/Inbox.jsx'
import { Start } from './views/Start.jsx'
import { Lock } from './views/Lock.jsx'
import { PublicBoard } from './views/PublicBoard.jsx'
import { Mic } from './components/Mic.jsx'
import { Dock } from './components/Dock.jsx'
import { Palette } from './components/Palette.jsx'
import { CaptureChips } from './components/CaptureChips.jsx'
import { Icon, Aura } from './components/ui.jsx'
import { GiveAward } from './components/GiveAward.jsx'
import { ConfirmProvider } from './components/Confirm.jsx'
import { QuickTask } from './components/QuickTask.jsx'
import { Notes } from './components/Notes.jsx'
import { Settings } from './components/Settings.jsx'
import { Focus } from './components/Focus.jsx'
import { DueAlert, EdgeGlow } from './components/DueAlert.jsx'
import { useDeadlines } from './lib/useDeadlines.js'
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
  { side: 'r', to: '#/inbox', label: 'Inbox', icon: 'inbox', badge: 'inbox' },
  { side: 'r', to: '#/projects', label: 'Projects', icon: 'projects', sec: true },
  { side: 'r', to: '#/team', label: 'Team', icon: 'team', sec: true },
  { side: 'r', to: '#/score', label: 'Scoreboard', icon: 'chart', sec: true },
  { side: 'r', to: '#/history', label: 'History', icon: 'history', sec: true },
]

const ROUTES = {
  '#/standup': Standup, '#/review': Review, '#/inbox': Inbox,
  '#/team': Team, '#/projects': Projects, '#/score': Scoreboard, '#/history': History,
}

export default function App() {
  const view = new URLSearchParams(location.search).get('view')
  const hash = useHash()
  const { theme, toggle: toggleTheme } = useTheme()
  const [counts, setCounts] = useState(null)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [giving, setGiving] = useState(false)
  const [adding, setAdding] = useState(false)
  const [notesOpen, setNotesOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [focusOpen, setFocusOpen] = useState(false)
  const [authed, setAuthed] = useState(null)

  useEffect(() => {
    api.authState().then((a) => setAuthed(a.authed)).catch(() => setAuthed(false))
  }, [])
  const cap = useCapture({ source: 'window' })
  const deadlines = useDeadlines({ enabled: authed === true })

  /** Back to the lock screen, and back to Today for whoever signs in next -
   *  landing a new session mid-way through someone else's page is disorienting. */
  const signOut = useCallback(async () => {
    await api.logout().catch(() => {})
    setSettingsOpen(false)
    setNotesOpen(false)
    setPaletteOpen(false)
    setCounts(null)
    location.hash = '#/'
    setAuthed(false)
  }, [])

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
    } catch (e) {
      if (e?.unauthorized) return setAuthed(false)
      setCounts((c) => c ?? {})
    }
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
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'j') { e.preventDefault(); setNotesOpen((v) => !v) }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'f' && e.shiftKey) { e.preventDefault(); setFocusOpen(true) }
      if (e.key === 'Escape' && (cap.live || cap.capture || cap.error)) cap.dismiss()
    }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [cap])

  // a shared link is its own front door: no passphrase, no dock, no board
  const shared = hash.match(/^#\/b\/(.+)$/)
  if (shared) return <PublicBoard token={decodeURIComponent(shared[1])} />

  if (authed === null) return <div className="lock"><span className="spinner" /></div>
  if (authed === false) return <Lock onIn={() => { setAuthed(true); pull() }} />

  if (view === 'popover') return <ConfirmProvider><div className="popover"><Today /></div></ConfirmProvider>
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
    { label: 'History — what already happened', icon: 'history', group: 'Go', run: () => go('#/history') },
    { label: 'Notes', icon: 'note', group: 'Go', run: () => setNotesOpen(true) },
    { label: 'Focus for a while', icon: 'focus', group: 'Do', run: () => setFocusOpen(true) },
    { label: 'Log what you saw', icon: 'spark', group: 'Do', run: () => setGiving(true) },
    { label: 'Change the passphrase', icon: 'gear', group: 'Do', run: () => setSettingsOpen(true) },
    { label: 'Sign out', icon: 'back', group: 'Do', run: signOut },
    { label: 'Add a task', icon: 'plus', group: 'Do', run: () => setAdding(true) },
    { label: 'Start a capture', icon: 'mic', group: 'Do', run: () => cap.toggle() },
    { label: theme === 'light' ? 'Switch to dark' : 'Switch to light', icon: theme === 'light' ? 'moon' : 'sun', group: 'Do', run: toggleTheme },
  ]

  return (
    <ConfirmProvider>
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
            {/* always closable: a sheet he cannot dismiss is a sheet that traps him */}
            <div className="sheet-head">
              {cap.live ? (
                <span className="inline" style={{ gap: 9, color: 'var(--c-warm)' }}>
                  <span className="rec-dot" />
                  <span style={{ fontWeight: 620 }}>Listening</span>
                  <span className="num dim">
                    {String(Math.floor(cap.seconds / 60)).padStart(2, '0')}:{String(cap.seconds % 60).padStart(2, '0')}
                  </span>
                </span>
              ) : (
                <span className="muted" style={{ fontWeight: 600, fontSize: 13 }}>
                  {cap.error ? 'Nothing recorded' : cap.status ? 'Working on it' : 'Confirm what to add'}
                </span>
              )}
              <span className="inline" style={{ gap: 6 }}>
                {cap.live && (
                  <button className="btn sm" onClick={cap.toggle}>
                    <Icon.stop size={13} /> Stop
                  </button>
                )}
                <button className="sheet-x" onClick={cap.dismiss} title="Close — Esc">
                  <Icon.x size={16} />
                </button>
              </span>
            </div>

            {cap.error && <div className="err" style={{ marginBottom: 10 }}>{cap.error}</div>}
            {cap.interim && <div className="mic-live-text" style={{ maxWidth: 'none', textAlign: 'left' }}>{cap.interim}</div>}
            {cap.status && <div className="inline" style={{ gap: 9 }}><span className="spinner" /><span className="muted">{cap.status}…</span></div>}
            {cap.capture && (
              <div className="stack" style={{ gap: 7 }}>
                <CaptureChips capture={cap.capture} onChange={(c) => { cap.setCapture(c); pull() }} />
              </div>
            )}
          </div>
        </div>
      )}

      <Dock
        items={DOCK} hash={hash} counts={counts || {}}
        micLive={cap.live} micLevel={cap.level} onMic={cap.toggle}
        onAdd={() => setAdding(true)}
        onNotes={() => setNotesOpen((v) => !v)} notesOpen={notesOpen}
        onFocus={() => setFocusOpen(true)}
        onSettings={() => setSettingsOpen(true)}
        onPalette={() => setPaletteOpen(true)}
        theme={theme} onTheme={toggleTheme}
      />

      {paletteOpen && <Palette items={paletteItems} onClose={() => setPaletteOpen(false)} />}
      {giving && <GiveAward onClose={() => setGiving(false)} onDone={pull} />}
      {adding && <QuickTask onClose={() => setAdding(false)} onDone={pull} />}
      <Notes open={notesOpen} onClose={() => setNotesOpen(false)} />
      <Focus open={focusOpen} onClose={() => setFocusOpen(false)} onFinished={pull} />

      <EdgeGlow on={deadlines.glow} />
      <DueAlert
        due={deadlines.due}
        permission={deadlines.permission}
        onAsk={deadlines.ask}
        onSnooze={(t, m) => { deadlines.snooze(t, m); pull() }}
        onComplete={(t) => { deadlines.complete(t); pull() }}
        onDismiss={deadlines.dismiss}
        onDismissAll={deadlines.dismissAll}
      />
      {settingsOpen && (
        <Settings onClose={() => setSettingsOpen(false)} onSignedOut={signOut} />
      )}
    </div>
    </ConfirmProvider>
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
