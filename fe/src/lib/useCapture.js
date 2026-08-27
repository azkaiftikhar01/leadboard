import { useCallback, useState } from 'react'
import { useRecorder } from './useRecorder.js'
import { useSpeech, speechAvailable } from './useSpeech.js'
import { useTranscriber } from './useTranscriber.js'
import { api } from './api.js'

/**
 * The whole capture spine as one hook, so the dock button and the popover mic
 * are the same machine rather than two copies of it.
 *
 * Two transcription paths, picked automatically: Chrome's recogniser (free, no
 * key, no download, streams live) wherever it exists, and local Whisper in
 * packaged Electron where Chromium ships without Google's speech keys. Audio is
 * recorded either way, so a mid-capture failure re-transcribes rather than
 * losing what he said.
 */
export function useCapture({ source = 'window', project } = {}) {
  const recorder = useRecorder()
  const speech = useSpeech()
  const whisper = useTranscriber()

  const [capture, setCapture] = useState(null)
  const [status, setStatus] = useState(null)
  const [error, setError] = useState(null)
  const [fallback, setFallback] = useState(false)

  const useBrowser = speechAvailable && !fallback
  const live = recorder.state === 'recording'

  const send = useCallback(async (transcript, rec) => {
    if (!transcript) {
      setError('Nothing heard — try again a bit closer to the mic.')
      setStatus(null)
      return null
    }
    setStatus('sorting it out')
    try {
      const c = await api.capture(rec?.blob, { ...rec, transcript, source, project })
      setCapture(c)
      setStatus(null)
      return c
    } catch (err) {
      setError(err.message)
      setStatus(null)
      return null
    }
  }, [source, project])

  const toggle = useCallback(async () => {
    setError(null)

    if (recorder.state === 'idle') {
      setCapture(null)
      try {
        await recorder.start()
        if (useBrowser) speech.start()
      } catch {
        setError('Microphone blocked — allow it for this site.')
      }
      return
    }

    const rec = await recorder.stop()
    if (!rec) return

    if (useBrowser) {
      const out = await speech.stop()
      if (out?.error === 'permission') {
        setError('Microphone blocked — allow it and try again.')
        return
      }
      // anything else is recoverable: we kept the audio
      if (out?.error || !out?.text) {
        setStatus('finishing locally')
        setFallback(Boolean(out?.error))
        try { return await send(await whisper.transcribe(rec.blob), rec) }
        catch (e) { setError(`Could not transcribe: ${e.message}`); setStatus(null); return }
      }
      return send(out.text, rec)
    }

    setStatus('transcribing')
    try { return await send(await whisper.transcribe(rec.blob), rec) }
    catch (e) { setError(e.message); setStatus(null) }
  }, [recorder, speech, whisper, useBrowser, send])

  return {
    toggle, live, error, status, capture, setCapture,
    level: recorder.level,
    seconds: recorder.seconds,
    interim: speech.interim,
    modelLoading: !useBrowser && whisper.status === 'loading',
    modelProgress: whisper.progress,
    warmLocal: whisper.warm,
  }
}
