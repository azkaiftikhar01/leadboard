import { transcribeWhisper } from './whisper.js'
import { transcribeDeepgram } from './deepgram.js'

/**
 * Web Speech API is deliberately not used. Electron's Chromium ships without
 * Google's speech service keys, so webkitSpeechRecognition does not work in a
 * packaged build - so the renderer records with MediaRecorder and we transcribe
 * here, behind this adapter. Swapping provider (or going local with whisper.cpp)
 * costs one env var and never loses history, because the audio is retained.
 */
const providers = {
  whisper: transcribeWhisper,
  deepgram: transcribeDeepgram,
}

export async function transcribe(filePath) {
  const name = process.env.STT_PROVIDER || 'whisper'
  const fn = providers[name]
  if (!fn) throw new Error(`unknown STT_PROVIDER: ${name}`)
  const text = await fn(filePath)
  return { text: (text || '').trim(), provider: name }
}
