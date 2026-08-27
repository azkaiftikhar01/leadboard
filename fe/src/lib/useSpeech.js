import { useCallback, useRef, useState } from 'react'

/**
 * Chrome's SpeechRecognition. Free, no key, no account, no download, and it
 * streams words as he talks so he can see it heard him.
 *
 * The catch is narrow and worth stating: this is backed by Google's speech
 * service, and Electron's Chromium ships without the keys for it. So it works
 * in the browser and dies in the packaged app - which is why the local Whisper
 * path still exists. `speechAvailable` picks between them.
 */
const SR = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition)

export const speechAvailable = Boolean(SR)

export function useSpeech() {
  const [interim, setInterim] = useState('')
  const ref = useRef({})

  const start = useCallback(() => {
    if (!SR) throw new Error('SpeechRecognition unavailable')

    const state = { final: '', error: null, stopping: false, dead: false }
    ref.current = state

    const spin = () => {
      const rec = new SR()
      rec.continuous = true
      rec.interimResults = true
      rec.lang = 'en-US'

      rec.onresult = (e) => {
        let live = ''
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const chunk = e.results[i][0].transcript
          if (e.results[i].isFinal) state.final += chunk + ' '
          else live += chunk
        }
        setInterim(live)
      }

      // 'no-speech' just means a quiet stretch; it must not kill the session
      rec.onerror = (e) => { if (e.error !== 'no-speech') state.error = e.error }

      rec.onend = () => {
        // Chrome ends recognition on its own after a pause. If he is still
        // talking, restart it - otherwise a long thought gets truncated at the
        // first breath, and stop() would wait forever on an end that never comes.
        if (state.stopping || state.error) {
          state.dead = true
          state.onDone?.()
          return
        }
        try { spin() } catch { state.dead = true; state.onDone?.() }
      }

      rec.start()
      state.rec = rec
    }

    spin()
  }, [])

  const stop = useCallback(
    () =>
      new Promise((resolve) => {
        const state = ref.current
        const done = () => {
          setInterim('')
          if (state.error === 'not-allowed' || state.error === 'service-not-allowed') {
            return resolve({ error: 'permission', text: '' })
          }
          resolve({ error: state.error || null, text: (state.final || '').trim() })
        }

        if (!state.rec || state.dead) return done()

        state.stopping = true
        state.onDone = done
        // whatever it has heard is already in state.final, so never hang on the
        // recogniser failing to emit a final 'end'
        setTimeout(() => { if (!state.dead) { state.dead = true; done() } }, 1200)
        try { state.rec.stop() } catch { done() }
      }),
    []
  )

  return { start, stop, interim }
}
