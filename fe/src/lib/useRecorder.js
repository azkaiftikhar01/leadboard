import { useCallback, useRef, useState } from 'react'

/**
 * MediaRecorder rather than the Web Speech API: Electron's Chromium ships without
 * Google's speech keys, so webkitSpeechRecognition is dead in a packaged build.
 * We record here and transcribe server-side behind the STT adapter.
 */
export function useRecorder() {
  const [state, setState] = useState('idle') // idle | recording | stopping
  const [level, setLevel] = useState(0)
  const [seconds, setSeconds] = useState(0)
  const ref = useRef({})

  const start = useCallback(async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    const rec = new MediaRecorder(stream, { mimeType: 'audio/webm' })
    const chunks = []
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data)
    rec.start()

    // a live level meter is the cheapest possible "yes, it heard you"
    const ctx = new AudioContext()
    const analyser = ctx.createAnalyser()
    analyser.fftSize = 512
    ctx.createMediaStreamSource(stream).connect(analyser)
    const buf = new Uint8Array(analyser.frequencyBinCount)
    const tick = () => {
      analyser.getByteTimeDomainData(buf)
      let peak = 0
      for (const v of buf) peak = Math.max(peak, Math.abs(v - 128) / 128)
      setLevel(peak)
      ref.current.raf = requestAnimationFrame(tick)
    }
    tick()

    const started = Date.now()
    ref.current = {
      ...ref.current,
      rec, stream, ctx, chunks, started,
      timer: setInterval(() => setSeconds(Math.floor((Date.now() - started) / 1000)), 250),
    }
    setState('recording')
  }, [])

  const stop = useCallback(
    () =>
      new Promise((resolve) => {
        const { rec, stream, ctx, chunks, started, timer, raf } = ref.current
        if (!rec) return resolve(null)
        setState('stopping')
        rec.onstop = () => {
          clearInterval(timer)
          cancelAnimationFrame(raf)
          stream.getTracks().forEach((t) => t.stop())
          ctx.close()
          setState('idle')
          setLevel(0)
          setSeconds(0)
          resolve({
            blob: new Blob(chunks, { type: 'audio/webm' }),
            durationSec: Math.round((Date.now() - started) / 1000),
          })
        }
        rec.stop()
      }),
    []
  )

  return { state, level, seconds, start, stop }
}
