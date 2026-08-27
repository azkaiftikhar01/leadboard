import { useCallback, useRef, useState } from 'react'

/**
 * Whisper running locally, in the app, on his own machine. No key, no account,
 * no audio leaving the laptop.
 *
 * Web Speech API is not an option - Electron's Chromium ships without Google's
 * speech keys, so webkitSpeechRecognition is dead in a packaged build. This runs
 * the model itself instead, on WebGPU where available (fast on Apple silicon)
 * and WASM otherwise. The model downloads once, then caches forever.
 */
const MODEL = 'onnx-community/whisper-base.en'

let pipe = null
let loading = null

async function getPipeline(onProgress) {
  if (pipe) return pipe
  if (!loading) {
    loading = (async () => {
      const { pipeline } = await import('@huggingface/transformers')
      const device = 'gpu' in navigator ? 'webgpu' : 'wasm'
      pipe = await pipeline('automatic-speech-recognition', MODEL, {
        device,
        dtype: device === 'webgpu' ? 'fp32' : 'q8',
        progress_callback: onProgress,
      })
      return pipe
    })()
  }
  return loading
}

/** Whisper wants mono float32 at 16kHz; the recorder gives us webm at 48k. */
async function toPcm16k(blob) {
  const raw = await blob.arrayBuffer()
  const ctx = new AudioContext()
  const decoded = await ctx.decodeAudioData(raw)
  await ctx.close()

  const offline = new OfflineAudioContext(1, Math.ceil(decoded.duration * 16000), 16000)
  const src = offline.createBufferSource()
  src.buffer = decoded
  src.connect(offline.destination)
  src.start()
  return (await offline.startRendering()).getChannelData(0)
}

export function useTranscriber() {
  const [status, setStatus] = useState('idle') // idle | loading | working
  const [progress, setProgress] = useState(0)
  const warmed = useRef(false)

  /** Pull the model down before he ever presses the mic, so the first capture
   *  is not the one that makes him wait. */
  const warm = useCallback(async () => {
    if (warmed.current) return
    warmed.current = true
    setStatus('loading')
    try {
      await getPipeline((p) => p.progress && setProgress(Math.round(p.progress)))
    } finally {
      setStatus('idle')
    }
  }, [])

  const transcribe = useCallback(async (blob) => {
    setStatus(pipe ? 'working' : 'loading')
    try {
      const asr = await getPipeline((p) => p.progress && setProgress(Math.round(p.progress)))
      setStatus('working')
      const audio = await toPcm16k(blob)
      const out = await asr(audio, { chunk_length_s: 30, stride_length_s: 5 })
      return (out?.text || '').trim()
    } finally {
      setStatus('idle')
    }
  }, [])

  return { transcribe, warm, status, progress }
}
