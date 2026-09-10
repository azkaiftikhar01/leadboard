import { useEffect, useState } from 'react'
import { edgeBurst, WIN, LOSE } from '../lib/celebrate.js'

/**
 * The full-screen celebration layer, shown only in the desktop app.
 *
 * Its window is transparent and click-through, so this draws over whatever is
 * on screen without taking focus or swallowing a click. It closes itself — a
 * celebration you have to dismiss is a dialog.
 *
 * No sound here: the window is deliberately not focusable, and audio started
 * from an unfocused window is unreliable. The page that triggered it plays it.
 */
export function Celebrate({ mood = 'win' }) {
  const [gone, setGone] = useState(false)

  useEffect(() => {
    edgeBurst({
      colors: mood === 'lose' ? LOSE : WIN,
      duration: mood === 'lose' ? 1500 : 2600,
      onDone: () => {
        setGone(true)
        setTimeout(() => window.leadboard?.closeWidget?.(), 1500)
      },
    })
  }, [mood])

  return (
    <div className="celebrate">
      <div className={`celebrate-word ${mood}${gone ? ' out' : ''}`}>
        {mood === 'lose' ? 'Booo' : 'Done'}
      </div>
    </div>
  )
}
