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
    // trim before the guard: a whitespace-only result is not a transcript, and
    // sending one gets rejected by the server as an empty capture
    const text = (transcript || '').trim()
    if (!text) {
      setError('Didn’t catch that — try again, a bit closer to the mic.')
      setStatus(null)
      return null
    }
    setStatus('sorting it out')
    try {
      const c = await api.capture(rec?.blob, { ...rec, transcript: text, source, project })
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

    // stop the recogniser BEFORE the recorder. Stopping the recorder kills the
    // mic stream, and Chrome then ends recognition without ever emitting the
    // final result - which is exactly how a perfectly good sentence came back
    // as an empty transcript.
    const out = useBrowser ? await speech.stop() : null
    const rec = await recorder.stop()
    if (!rec) return

    if (useBrowser) {
      if (out?.error === 'permission') {
        setError('Microphone blocked — allow it for this site and try again.')
        return
      }

      if (out?.text?.trim()) return send(out.text, rec)

      // Only a *service* failure justifies the local model. Falling back on a
      // plain "heard nothing" would start a 150MB download every time he
      // fumbled a sentence.
      const serviceDown = ['network', 'audio-capture', 'service-not-allowed', 'aborted'].includes(out?.error)
      if (!serviceDown) {
        setError('Didn’t catch that — try again, a bit closer to the mic.')
        return
      }

      setFallback(true)
      setStatus(whisper.ready ? 'transcribing' : 'getting the offline model')
      try { return await send(await whisper.transcribe(rec.blob), rec) }
      catch (e) { setError(`Could not transcribe: ${e.message}`); setStatus(null); return }
    }

    setStatus(whisper.ready ? 'transcribing' : 'getting the offline model')
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
