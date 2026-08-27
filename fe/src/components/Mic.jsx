import { useEffect } from 'react'
import { useCapture } from '../lib/useCapture.js'
import { CaptureChips } from './CaptureChips.jsx'
import { Icon } from './ui.jsx'

/** Inline mic, used by the desktop popover and the hotkey overlay. The main app
 *  drives the same hook from the dock instead. */
export function Mic({ source = 'popover', project, onCapture, hint }) {
  const c = useCapture({ source, project })

  useEffect(() => { if (c.modelLoading) c.warmLocal() }, [c])
  useEffect(() => { if (c.capture) onCapture?.(c.capture) }, [c.capture, onCapture])

  return (
    <div className="mic-wrap">
      {c.error && <div className="err">{c.error}</div>}
      <button className={`mic${c.live ? ' live' : ''}`} onClick={c.toggle} disabled={Boolean(c.status)}
        style={{ '--pulse': `${8 + c.level * 26}px` }}>
        {c.live ? <Icon.stop size={20} /> : <Icon.mic size={22} />}
      </button>

      {c.live ? (
        <>
          <div className="mic-timer num">
            {String(Math.floor(c.seconds / 60)).padStart(2, '0')}:{String(c.seconds % 60).padStart(2, '0')}
          </div>
          {c.interim && <div className="mic-live-text">{c.interim}</div>}
        </>
      ) : (
        <div className="mic-hint">
          {c.status ? `${c.status}…`
            : c.modelLoading ? `Getting the speech model ready… ${c.modelProgress || 0}%`
            : hint || 'Talk. It sorts itself out.'}
        </div>
      )}

      {c.capture && (
        <div className="stack" style={{ gap: 7, width: '100%', marginTop: 6 }}>
          <CaptureChips capture={c.capture} onChange={c.setCapture} />
        </div>
      )}
    </div>
  )
}
