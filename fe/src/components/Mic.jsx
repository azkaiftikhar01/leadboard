import { useState } from 'react'
import { useRecorder } from '../lib/useRecorder.js'
import { api } from '../lib/api.js'

export function Mic({ source = 'popover', project, onCapture, hint }) {
  const { state, level, seconds, start, stop } = useRecorder()
  const [status, setStatus] = useState(null)
  const [error, setError] = useState(null)

  const toggle = async () => {
    setError(null)
    if (state === 'idle') {
      try {
        await start()
      } catch {
        setError('Microphone blocked — allow access in System Settings › Privacy.')
      }
      return
    }
    const rec = await stop()
    if (!rec) return
    setStatus('transcribing…')
    try {
      const capture = await api.capture(rec.blob, { ...rec, source, project })
      onCapture?.(capture)
      setStatus(null)
    } catch (err) {
      setError(err.message)
      setStatus(null)
    }
  }

  const live = state === 'recording'

  return (
    <div className="mic-wrap">
      {error && <div className="err">{error}</div>}
      <button
        className={`mic${live ? ' live' : ''}`}
        onClick={toggle}
        disabled={Boolean(status)}
        style={{ '--ring': `${8 + level * 26}px` }}
      >
        {live ? '■' : '🎙'}
      </button>
      {live ? (
        <div className="mic-timer">
          {String(Math.floor(seconds / 60)).padStart(2, '0')}:{String(seconds % 60).padStart(2, '0')}
        </div>
      ) : (
        <div className="mic-hint">{status || hint || 'Talk. It sorts itself out.'}</div>
      )}
    </div>
  )
}
