import { useState } from 'react'
import { useEffect } from 'react'
import { useRecorder } from '../lib/useRecorder.js'
import { useTranscriber } from '../lib/useTranscriber.js'
import { api } from '../lib/api.js'

export function Mic({ source = 'popover', project, onCapture, hint }) {
  const { state, level, seconds, start, stop } = useRecorder()
  const { transcribe, warm, status: sttStatus, progress } = useTranscriber()
  const [status, setStatus] = useState(null)
  const [error, setError] = useState(null)

  // fetch the model on mount so his first capture is not the slow one
  useEffect(() => { warm() }, [warm])

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
    try {
      setStatus('transcribing…')
      const transcript = await transcribe(rec.blob)
      if (!transcript) {
        setError('Nothing heard — try again a bit closer to the mic.')
        setStatus(null)
        return
      }
      setStatus('sorting it out…')
      const capture = await api.capture(rec.blob, { ...rec, transcript, source, project })
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
          <div className="mic-hint">
          {status ||
            (sttStatus === 'loading'
              ? `Getting the speech model ready… ${progress || 0}%`
              : hint || 'Talk. It sorts itself out.')}
        </div>
      )}
    </div>
  )
}
