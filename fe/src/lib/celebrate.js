import confetti from 'canvas-confetti'

export const WIN = ['#3DDC97', '#2E8C74', '#4FC2A3', '#12A37C', '#A7F3D0', '#FFFFFF']
export const LOSE = ['#8E8A97', '#6F6B7A', '#B9B4C2', '#D4525F', '#4A4550']

/**
 * Bursts from every edge of the screen, firing inward.
 *
 * A burst from the centre reads as a page effect - you look at it. Launching
 * from all four sides at once fills the periphery, which is what makes it feel
 * like the room reacted rather than the window did.
 */
export function edgeBurst({ duration = 2600, colors = WIN, onDone } = {}) {
  const end = Date.now() + duration
  const rand = (a, b) => a + Math.random() * (b - a)

  const volley = () => {
    const shared = {
      colors,
      ticks: 160,
      gravity: 0.75,
      scalar: 1,
      disableForReducedMotion: true,
    }
    // angle: 0 points right, 90 up. Each edge fires toward the middle.
    const edges = [
      { origin: { x: -0.04, y: rand(0.15, 0.9) }, angle: rand(-15, 25) },   // left
      { origin: { x: 1.04, y: rand(0.15, 0.9) }, angle: rand(155, 195) },   // right
      { origin: { x: rand(0.1, 0.9), y: -0.04 }, angle: rand(255, 285) },   // top
      { origin: { x: rand(0.1, 0.9), y: 1.04 }, angle: rand(75, 105) },     // bottom
    ]
    for (const e of edges) {
      confetti({ ...shared, ...e, particleCount: 34, spread: 62, startVelocity: rand(48, 74) })
    }
    // corners, wider and slower, so the middle fills in behind the edges
    confetti({ ...shared, particleCount: 22, spread: 100, startVelocity: 52, origin: { x: 0, y: 1 }, angle: 55 })
    confetti({ ...shared, particleCount: 22, spread: 100, startVelocity: 52, origin: { x: 1, y: 1 }, angle: 125 })

    if (Date.now() < end) setTimeout(volley, 280)
    else onDone?.()
  }
  volley()
}

/* ---------------- sound ---------------- */

const ctxFor = (() => {
  let ctx
  return () => {
    const C = window.AudioContext || window.webkitAudioContext
    if (!C) return null
    ctx ??= new C()
    if (ctx.state === 'suspended') ctx.resume()
    return ctx
  }
})()

/** A pitch glide — up reads as a cheer, down as a groan. Cheap, and it lands
 *  before a speech voice has finished loading. */
function whoop({ from, to, dur = 0.5, type = 'sine', gain = 0.2, delay = 0 }) {
  try {
    const ctx = ctxFor()
    if (!ctx) return
    const t = ctx.currentTime + delay
    const osc = ctx.createOscillator()
    const g = ctx.createGain()
    osc.type = type
    osc.frequency.setValueAtTime(from, t)
    osc.frequency.exponentialRampToValueAtTime(to, t + dur)
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(gain, t + 0.05)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.15)
    osc.connect(g).connect(ctx.destination)
    osc.start(t)
    osc.stop(t + dur + 0.2)
  } catch { /* silence beats a thrown sound */ }
}

/**
 * A voice, not a sample: speechSynthesis is built in, so there is no audio file
 * to download, cache, or fail to load at the one moment it matters.
 */
function say(text, { pitch = 1, rate = 1, volume = 1, delay = 0 } = {}) {
  const speak = () => {
    try {
      const synth = window.speechSynthesis
      if (!synth) return
      synth.cancel()
      const u = new SpeechSynthesisUtterance(text)
      u.pitch = pitch
      u.rate = rate
      u.volume = volume
      const nice = synth.getVoices().find((v) => /samantha|karen|moira|daniel|google uk/i.test(v.name))
      if (nice) u.voice = nice
      synth.speak(u)
    } catch { /* ignore */ }
  }
  delay ? setTimeout(speak, delay) : speak()
}

/** Rising whoop, then the cheer on top of it. */
export function cheer() {
  whoop({ from: 420, to: 1150, dur: 0.42, gain: 0.22 })
  whoop({ from: 620, to: 1500, dur: 0.36, gain: 0.14, delay: 0.22 })
  say('Woo hoo! Nicely done.', { pitch: 1.6, rate: 1.05, delay: 380 })
}

/** The same shape inverted — a falling tone and a flat, low voice. */
export function boo() {
  whoop({ from: 380, to: 120, dur: 0.75, type: 'sawtooth', gain: 0.14 })
  whoop({ from: 300, to: 100, dur: 0.85, type: 'sawtooth', gain: 0.1, delay: 0.1 })
  say('Booo. Next time.', { pitch: 0.35, rate: 0.82, delay: 520 })
}

/** One call for both moods, so callers never have to remember which pairs with which. */
export function celebrateLocal(mood = 'win') {
  edgeBurst({ colors: mood === 'lose' ? LOSE : WIN, duration: mood === 'lose' ? 1500 : 2600 })
  mood === 'lose' ? boo() : cheer()
}
