import { useCallback, useRef, useState } from 'react'

/**
 * Chrome's SpeechRecognition. Free, no key, no account, no download, and it
 * streams words as he talks so he can see it heard him.
 *
 * The catch is narrow and worth stating: this is backed by Google's speech
 * service, and Electron's Chromium ships without the keys for it. So it works
 * in the browser and dies in the packaged app - which is exactly why the local
 * Whisper path still exists as a fallback. `isAvailable` picks between them.
 */
const SR = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition)

export const speechAvailable = Boolean(SR)

export function useSpeech() {
  const [interim, setInterim] = useState('')
  const ref = useRef({})

  const start = useCallback(() => {
    if (!SR) throw new Error('SpeechRecognition unavailable')
    const rec = new SR()
    rec.continuous = true
    rec.interimResults = true
    rec.lang = 'en-US'

    let final = ''
    rec.onresult = (e) => {
      let live = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const chunk = e.results[i][0].transcript
        if (e.results[i].isFinal) final += chunk + ' '
        else live += chunk
      }
      ref.current.final = final
      setInterim(live)
    }
    rec.onerror = (e) => { ref.current.error = e.error }
    rec.start()
    ref.current = { rec, final: '' }
  }, [])

  const stop = useCallback(
    () =>
      new Promise((resolve) => {
        const { rec } = ref.current
        if (!rec) return resolve('')
        rec.onend = () => {
          setInterim('')
          const { final, error } = ref.current
          if (error === 'not-allowed') return resolve({ error: 'Microphone blocked for this site.' })
          if (error === 'network') return resolve({ error: 'network' })
          resolve({ text: (final || '').trim() })
        }
        rec.stop()
      }),
    []
  )

  return { start, stop, interim }
}
