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
  const [speaking, setSpeaking] = useState(false)

  const useBrowser = speechAvailable && !fallback
  const live = recorder.state === 'recording' || speaking

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

    if (recorder.state === 'idle' && !speaking) {
      setCapture(null)
      try {
        // ONE mic consumer at a time. Running MediaRecorder alongside Chrome's
        // recogniser makes the recogniser fight for the device and come back
        // with nothing - which is exactly the "didn't catch that" on a sentence
        // that was clearly spoken. The audio backup is not worth losing the
        // primary path over, so the browser uses speech only.
        if (useBrowser) { speech.start(); setSpeaking(true) }
        else await recorder.start()
      } catch {
        setError('Microphone blocked — allow it for this site.')
        setSpeaking(false)
      }
      return
    }

    if (speaking) {
      setSpeaking(false)
      const out = await speech.stop()

      if (out?.error === 'permission') {
        setError('Microphone blocked — allow it for this site and try again.')
        return
      }
      if (out?.text?.trim()) return send(out.text, null)

      // the recogniser is unavailable, not merely quiet - retry the same words
      // through the offline model instead of telling him to say it all again
      if (['network', 'audio-capture', 'service-not-allowed'].includes(out?.error)) {
        setFallback(true)
        setError('Speech service unavailable — switched to offline mode. Try that again.')
        return
      }
      setError('Didn’t catch that — say it again, a bit closer to the mic.')
      return
    }

    const rec = await recorder.stop()
    if (!rec) return
    setStatus(whisper.ready ? 'transcribing' : 'getting the offline model')
    try { return await send(await whisper.transcribe(rec.blob), rec) }
    catch (e) { setError(e.message); setStatus(null) }
  }, [recorder, speech, whisper, useBrowser, speaking, send])

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
