import { Icon } from './ui.jsx'

/**
 * The dock replaces the sidebar.
 *
 * A lead reads a wide three-column board, and a 236px rail was eating that width
 * to show seven words he knows by heart.
 *
 * The centre is "add", because typing a task is what he actually does forty
 * times a day. Voice sits beside it as one button among many - it is a shortcut
 * for the times his hands are busy, not the main way in.
 */
export function Dock({ items, hash, counts, micLive, micLevel, onMic, onAdd, onNotes, notesOpen, onSettings, onPalette, theme, onTheme }) {
  const Btn = ({ to, label, icon, badge, calm, sec }) => {
    const I = Icon[icon]
    const n = badge ? counts[badge] : 0
    return (
      <a href={to} className={`dock-btn${hash === to ? ' on' : ''}${sec ? ' sec' : ''}`} aria-label={label}>
        <I size={20} />
        {n > 0 && <span className={`badge${calm ? ' calm' : ''}`}>{n > 99 ? '99+' : n}</span>}
        <span className="tip">{label}</span>
      </a>
    )
  }

  const left = items.filter((i) => i.side === 'l')
  const right = items.filter((i) => i.side === 'r')

  // one utility button on each end and equal nav counts either side, so the
  // mic lands on the true centre line rather than just near it
  return (
    <div className="dock-wrap">
      <div className="dock">
        <div className="dock-group">
          <button className="dock-btn" onClick={onPalette} aria-label="Search">
            <Icon.spark size={19} />
            <span className="tip">Search — ⌘K</span>
          </button>
          <span className="dock-sep" />
          {left.map((i) => <Btn key={i.to} {...i} />)}
        </div>

        <button className="dock-add" onClick={onAdd} aria-label="Add a task">
          <Icon.plus size={26} />
          <span className="tip">Add a task</span>
        </button>

        <div className="dock-group">
          {right.map((i) => <Btn key={i.to} {...i} />)}
          <span className="dock-sep" />
          <button
            className={`dock-btn${notesOpen ? ' on' : ''}`}
            onClick={onNotes}
            aria-label="Notes"
          >
            <Icon.note size={19} />
            <span className="tip">Notes — ⌘J</span>
          </button>
          <button
            className={`dock-btn${micLive ? ' mic-live' : ''}`}
            onClick={onMic}
            aria-label={micLive ? 'Stop and file it' : 'Dictate'}
            style={{ '--pulse': `${4 + micLevel * 14}px` }}
          >
            {micLive ? <Icon.stop size={17} /> : <Icon.mic size={19} />}
            <span className="tip">{micLive ? 'Stop' : 'Dictate — ⌘⇧Space'}</span>
          </button>
          <button className="dock-btn sec" onClick={onSettings} aria-label="Settings">
            <Icon.gear size={19} />
            <span className="tip">Settings</span>
          </button>
          <button className="dock-btn sec" onClick={onTheme} aria-label="Toggle theme">
            {theme === 'light' ? <Icon.moon size={19} /> : <Icon.sun size={19} />}
            <span className="tip">{theme === 'light' ? 'Dark' : 'Light'}</span>
          </button>
        </div>
      </div>
    </div>
  )
}
