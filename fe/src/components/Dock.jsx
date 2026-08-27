import { Icon } from './ui.jsx'

/**
 * The dock replaces the sidebar.
 *
 * Two reasons it is the right shape here. Capture is the product's whole thesis
 * — it has to be cheaper than paper — so the mic sits at the physical centre and
 * is the biggest target on screen. And a lead reads a wide board of three
 * columns; a 236px rail was eating that width to show seven words he already
 * knows by heart.
 */
export function Dock({ items, hash, counts, micLive, micLevel, onMic, onPalette, theme, onTheme }) {
  const Btn = ({ to, label, icon, badge, calm }) => {
    const I = Icon[icon]
    const n = badge ? counts[badge] : 0
    return (
      <a href={to} className={`dock-btn${hash === to ? ' on' : ''}`} aria-label={label}>
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

        <button
          className={`dock-mic${micLive ? ' live' : ''}`}
          onClick={onMic}
          aria-label={micLive ? 'Stop and file it' : 'Capture'}
          style={{ '--pulse': `${6 + micLevel * 22}px` }}
        >
          {micLive ? <Icon.stop size={24} /> : <Icon.mic size={30} />}
        </button>

        <div className="dock-group">
          {right.map((i) => <Btn key={i.to} {...i} />)}
          <span className="dock-sep" />
          <button className="dock-btn" onClick={onTheme} aria-label="Toggle theme">
            {theme === 'light' ? <Icon.moon size={19} /> : <Icon.sun size={19} />}
            <span className="tip">{theme === 'light' ? 'Dark' : 'Light'}</span>
          </button>
        </div>
      </div>
    </div>
  )
}
