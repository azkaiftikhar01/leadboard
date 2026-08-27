/**
 * Speech-to-text is an adapter because the right answer depends on what he has.
 *
 *   client    the renderer already transcribed it with Whisper running locally
 *             on his own GPU - free, offline, private            (default)
 *   whisper   OpenAI Whisper API, needs a paid key
 *   deepgram  lower latency, needs a paid key
 *
 * Web Speech API is deliberately absent: Electron's Chromium ships without
 * Google's speech keys, so webkitSpeechRecognition is dead in a packaged build.
 */
export async function transcribe(filePath, { transcript } = {}) {
  const provider = process.env.STT_PROVIDER || 'client'

  if (provider === 'client') {
    if (!transcript?.trim()) throw new Error('no transcript from client (local Whisper still loading?)')
    return { text: transcript.trim(), provider: 'client-whisper' }
  }

  if (provider === 'whisper') {
    const { transcribeWhisper } = await import('./whisper.js')
    return { text: (await transcribeWhisper(filePath))?.trim() || '', provider }
  }

  if (provider === 'deepgram') {
    const { transcribeDeepgram } = await import('./deepgram.js')
    return { text: (await transcribeDeepgram(filePath))?.trim() || '', provider }
  }

  throw new Error(`unknown STT_PROVIDER: ${provider}`)
}
