import { useEffect, useState } from 'react'
import { useRecorder } from '../lib/useRecorder.js'
import { useSpeech, speechAvailable } from '../lib/useSpeech.js'
import { useTranscriber } from '../lib/useTranscriber.js'
import { api } from '../lib/api.js'

/**
 * Two transcription paths, picked automatically:
 *
 *   browser   Chrome's SpeechRecognition - free, no key, no download, streams
 *             live as he talks. Used whenever it exists.
 *   local     Whisper running in-app on his own GPU. Used in packaged Electron,
 *             where Chromium ships without Google's speech keys. Costs a one-off
 *             model download, so it is never pulled unless it is actually needed.
 */
export function Mic({ source = 'popover', project, onCapture, hint }) {
  const recorder = useRecorder()
  const speech = useSpeech()
  const whisper = useTranscriber()

  const [status, setStatus] = useState(null)
  const [error, setError] = useState(null)
  const [fallback, setFallback] = useState(false)

  const useBrowser = speechAvailable && !fallback

  // only warm the heavy local model when it is the path we are actually on
  useEffect(() => { if (!useBrowser) whisper.warm() }, [useBrowser, whisper])

  const send = async (transcript, rec) => {
    if (!transcript) {
      setError('Nothing heard — try again a bit closer to the mic.')
      setStatus(null)
      return
    }
    setStatus('sorting it out…')
    try {
      const capture = await api.capture(rec?.blob, { ...rec, transcript, source, project })
      onCapture?.(capture)
      setStatus(null)
    } catch (err) {
      setError(err.message)
      setStatus(null)
    }
  }

  const toggle = async () => {
    setError(null)

    if (recorder.state === 'idle') {
      try {
        // record either way - the audio is the backup that makes a bad
        // transcript recoverable and a provider swap free
        await recorder.start()
        if (useBrowser) speech.start()
      } catch {
        setError('Microphone blocked — allow access for this site.')
      }
      return
    }

    const rec = await recorder.stop()
    if (!rec) return

    if (useBrowser) {
      const out = await speech.stop()

      // permission is the one failure worth surfacing - he has to go fix it
      if (out?.error === 'permission') {
        setError('Microphone blocked — allow it for this site and try again.')
        return
      }

      // anything else (recognizer lost the device to the recorder, offline,
      // nothing heard) is recoverable, because we always kept the audio.
      // Falling back beats telling him the thing he just said is gone.
      if (out?.error || !out?.text) {
        setStatus('finishing locally…')
        try {
          return await send(await whisper.transcribe(rec.blob), rec)
        } catch (e) {
          setError(`Could not transcribe: ${e.message}`)
          setStatus(null)
          return
        }
      }
      return send(out.text, rec)
    }

    setStatus('transcribing…')
    try {
      return await send(await whisper.transcribe(rec.blob), rec)
    } catch (e) {
      setError(e.message)
      setStatus(null)
    }
  }

  const live = recorder.state === 'recording'
  const loadingModel = !useBrowser && whisper.status === 'loading'

  return (
    <div className="mic-wrap">
      {error && <div className="err">{error}</div>}
      <button
        className={`mic${live ? ' live' : ''}`}
        onClick={toggle}
        disabled={Boolean(status)}
        style={{ '--ring': `${8 + recorder.level * 26}px` }}
      >
        {live ? '■' : '🎙'}
      </button>

      {live ? (
        <>
          <div className="mic-timer">
            {String(Math.floor(recorder.seconds / 60)).padStart(2, '0')}:
            {String(recorder.seconds % 60).padStart(2, '0')}
          </div>
          {/* seeing the words appear is the cheapest possible "yes, it heard you" */}
          {speech.interim && <div className="mic-hint" style={{ maxWidth: 320 }}>{speech.interim}</div>}
        </>
      ) : (
        <div className="mic-hint">
          {status ||
            (loadingModel
              ? `Getting the speech model ready… ${whisper.progress || 0}%`
              : hint || 'Talk. It sorts itself out.')}
        </div>
      )}
    </div>
  )
}
