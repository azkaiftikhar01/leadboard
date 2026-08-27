import { useEffect, useState } from 'react'
import { Today } from './views/Today.jsx'
import { Standup } from './views/Standup.jsx'
import { Board } from './views/Board.jsx'
import { People } from './views/People.jsx'
import { Inbox } from './views/Inbox.jsx'
import { Mic } from './components/Mic.jsx'
import { CaptureChips } from './components/CaptureChips.jsx'

const useHash = () => {
  const [hash, setHash] = useState(location.hash || '#/')
  useEffect(() => {
    const on = () => setHash(location.hash || '#/')
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  return hash
}

const ROUTES = {
  '#/': Today,
  '#/standup': Standup,
  '#/board': Board,
  '#/people': People,
  '#/inbox': Inbox,
}

export default function App() {
  const view = new URLSearchParams(location.search).get('view')
  const hash = useHash()

  // three shells, one bundle: tray popover, hotkey overlay, main window
  if (view === 'popover') return <div className="popover"><Today compact /></div>
  if (view === 'capture') return <CaptureOverlay />

  const View = ROUTES[hash] || Today
  return (
    <div className="window">
      <nav className="nav" style={{ marginBottom: 18 }}>
        {[['#/', 'Today'], ['#/standup', 'Standup'], ['#/board', 'Board'], ['#/people', 'People'], ['#/inbox', 'Inbox']].map(
          ([to, label]) => (
            <a key={to} href={to} className={hash === to ? 'on' : ''}>{label}</a>
          )
        )}
      </nav>
      <View compact={false} />
    </div>
  )
}

/** ⌥Space from anywhere. Speak, confirm, gone — no context switch. */
function CaptureOverlay() {
  const [capture, setCapture] = useState(null)

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && window.leadboard?.closeCapture()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="popover" style={{ minHeight: 0 }}>
      <Mic source="hotkey" onCapture={setCapture} hint="⌥Space anywhere. Esc to dismiss." />
      {capture && <CaptureChips capture={capture} onChange={setCapture} />}
      {capture && (
        <button className="btn wide" style={{ marginTop: 10 }} onClick={() => window.leadboard?.closeCapture()}>
          Done
        </button>
      )}
    </div>
  )
}
