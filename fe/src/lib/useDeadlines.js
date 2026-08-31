import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from './api.js'

const POLL_MS = 20_000

/**
 * An alert that reaches him when the app is not what he is looking at.
 *
 * Three channels, because each one fails in a different situation: a system
 * notification carries when the tab is buried or the browser is behind another
 * window, a sound carries when he is looking away from the screen entirely, and
 * the edge glow carries when the tab is visible and a notification would be a
 * duplicate of something already on screen.
 *
 * The honest limit: a web page cannot wake a browser that is closed. Everything
 * here works while a tab is open, anywhere, including hidden. Anything more
 * would need a service worker and a push service.
 */
export function useDeadlines({ enabled }) {
  const [due, setDue] = useState([])
  const [glow, setGlow] = useState(false)
  const [permission, setPermission] = useState(
    typeof Notification === 'undefined' ? 'unsupported' : Notification.permission
  )
  const audio = useRef(null)
  const seen = useRef(new Set())

  /** Kept alive across alerts: a context created cold after a timer fires is
   *  often blocked, where one warmed by an earlier click is not. */
  const alarm = useCallback(() => {
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext
      if (!Ctx) return
      audio.current ??= new Ctx()
      const ctx = audio.current
      if (ctx.state === 'suspended') ctx.resume()
      const now = ctx.currentTime
      // two rising pairs — urgent enough to turn a head, short enough not to nag
      ;[0, 0.42].forEach((offset) => {
        ;[880, 1174.7].forEach((freq, i) => {
          const osc = ctx.createOscillator()
          const gain = ctx.createGain()
          osc.type = 'triangle'
          osc.frequency.value = freq
          const t = now + offset + i * 0.16
          gain.gain.setValueAtTime(0, t)
          gain.gain.linearRampToValueAtTime(0.28, t + 0.02)
          gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.42)
          osc.connect(gain).connect(ctx.destination)
          osc.start(t)
          osc.stop(t + 0.45)
        })
      })
    } catch { /* silence beats a thrown alarm */ }
  }, [])

  const ask = useCallback(async () => {
    if (typeof Notification === 'undefined') return 'unsupported'
    const p = await Notification.requestPermission()
    setPermission(p)
    return p
  }, [])

  const announce = useCallback((tasks) => {
    setDue((cur) => {
      const merged = [...cur]
      for (const t of tasks) if (!merged.some((x) => x._id === t._id)) merged.push(t)
      return merged
    })
    setGlow(true)
    alarm()

    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      for (const t of tasks) {
        const n = new Notification(tasks.length > 1 ? `${tasks.length} tasks are due` : 'Task due now', {
          body: `${t.title}${t.project?.name ? ` · ${t.project.name}` : ''}`,
          tag: `lb-due-${t._id}`,
          requireInteraction: true,
          silent: true, // our own sound already played; two at once is a mess
        })
        n.onclick = () => { window.focus(); n.close() }
        if (tasks.length > 1) break // one summary rather than a stack
      }
    }
  }, [alarm])

  const check = useCallback(async () => {
    if (!enabled) return
    try {
      const tasks = await api.dueTasks()
      const fresh = tasks.filter((t) => !seen.current.has(t._id))
      if (!fresh.length) return
      fresh.forEach((t) => seen.current.add(t._id))
      // tell the server before showing it, so a second tab stays quiet
      await Promise.all(fresh.map((t) => api.markNotified(t._id).catch(() => {})))
      announce(fresh)
    } catch { /* offline or signed out; try again next tick */ }
  }, [enabled, announce])

  useEffect(() => {
    if (!enabled) return
    check()
    const id = setInterval(check, POLL_MS)
    // coming back to the tab is the most likely moment to have missed one
    const onVis = () => { if (!document.hidden) check() }
    document.addEventListener('visibilitychange', onVis)
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', onVis) }
  }, [enabled, check])

  const dismiss = useCallback((id) => {
    setDue((cur) => {
      const rest = cur.filter((t) => t._id !== id)
      if (!rest.length) setGlow(false)
      return rest
    })
  }, [])

  const dismissAll = useCallback(() => { setDue([]); setGlow(false) }, [])

  const snooze = useCallback(async (task, minutes) => {
    await api.snoozeTask(task._id, minutes).catch(() => {})
    seen.current.delete(task._id)
    dismiss(task._id)
  }, [dismiss])

  const complete = useCallback(async (task) => {
    await api.toggleTask(task._id).catch(() => {})
    dismiss(task._id)
  }, [dismiss])

  return { due, glow, permission, ask, dismiss, dismissAll, snooze, complete }
}
