/**
 * Tomatoes, thrown at the screen.
 *
 * Confetti recoloured red would still read as celebration - the meaning is in
 * the motion, not the colour. So these fly in from off-screen toward a point,
 * spin on the way, and burst into a splat that spreads, drips and fades. Drawn
 * by hand on a canvas because that arc-and-impact is exactly what a particle
 * library will not do.
 */
const REDS = ['#C42B1C', '#D6372A', '#A81F12', '#E04434', '#B52516']
const rand = (a, b) => a + Math.random() * (b - a)
const pick = (xs) => xs[Math.floor(Math.random() * xs.length)]

function drawTomato(ctx, x, y, r, spin, color) {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(spin)
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.ellipse(0, 0, r, r * 0.92, 0, 0, Math.PI * 2)
  ctx.fill()
  // the highlight is most of what makes it read as round rather than flat
  ctx.fillStyle = 'rgba(255,255,255,.28)'
  ctx.beginPath()
  ctx.ellipse(-r * 0.3, -r * 0.34, r * 0.3, r * 0.2, -0.5, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#3E7D32'
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2
    ctx.beginPath()
    ctx.ellipse(Math.cos(a) * r * 0.3, -r * 0.72 + Math.sin(a) * r * 0.1,
      r * 0.26, r * 0.1, a, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
}

function makeSplat(x, y, r, color) {
  // irregular, because a circular splat looks like a sticker
  return {
    x, y, r, color, born: performance.now(),
    lobes: Array.from({ length: 11 }, (_, i) => ({ a: (i / 11) * Math.PI * 2, d: r * rand(0.7, 1.5) })),
    drips: Array.from({ length: Math.round(rand(3, 6)) }, () => ({
      a: rand(Math.PI * 0.15, Math.PI * 0.85), d: r * rand(1, 1.5),
      len: r * rand(0.4, 1.5), w: r * rand(0.1, 0.24), grow: rand(0.4, 1),
    })),
    seeds: Array.from({ length: Math.round(rand(4, 8)) }, () => ({
      a: rand(0, Math.PI * 2), d: r * rand(0.2, 1.1), s: r * rand(0.05, 0.1),
    })),
  }
}

function drawSplat(ctx, s, now) {
  const age = (now - s.born) / 1000
  const fade = Math.max(0, 1 - Math.max(0, age - 1.1) / 1.6)
  if (fade <= 0) return false
  const settle = Math.min(1, age / 0.14)

  ctx.save()
  ctx.globalAlpha = fade
  ctx.translate(s.x, s.y)
  ctx.fillStyle = s.color
  ctx.beginPath()
  s.lobes.forEach((l, i) => {
    const d = l.d * settle
    const px = Math.cos(l.a) * d
    const py = Math.sin(l.a) * d * 0.86
    i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py)
  })
  ctx.closePath()
  ctx.fill()

  // drips keep running after the blob has finished spreading
  for (const d of s.drips) {
    const run = d.len * Math.min(1, age * d.grow)
    ctx.beginPath()
    ctx.ellipse(Math.cos(d.a) * d.d * settle, Math.sin(d.a) * d.d * settle * 0.7 + run,
      d.w, d.w * 1.5, 0, 0, Math.PI * 2)
    ctx.fill()
  }

  ctx.fillStyle = 'rgba(255,240,200,.55)'
  for (const sd of s.seeds) {
    ctx.beginPath()
    ctx.ellipse(Math.cos(sd.a) * sd.d * settle, Math.sin(sd.a) * sd.d * settle * 0.8,
      sd.s, sd.s * 1.4, sd.a, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
  return true
}

export function throwTomatoes({ count = 14, duration = 1600, onDone } = {}) {
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) { onDone?.(); return () => {} }

  const canvas = document.createElement('canvas')
  canvas.style.cssText =
    'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:99'
  document.body.appendChild(canvas)
  const ctx = canvas.getContext('2d')

  const size = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = window.innerWidth * dpr
    canvas.height = window.innerHeight * dpr
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  }
  size()
  window.addEventListener('resize', size)

  const W = () => window.innerWidth
  const H = () => window.innerHeight
  const flying = []
  const splats = []
  let thrown = 0
  let raf
  const start = performance.now()

  const launch = () => {
    const from = pick([
      { x: -80, y: rand(0, H()) },
      { x: W() + 80, y: rand(0, H()) },
      { x: rand(0, W()), y: -80 },
      { x: rand(0, W()), y: H() + 80 },
    ])
    flying.push({
      sx: from.x, sy: from.y,
      tx: rand(W() * 0.2, W() * 0.8), ty: rand(H() * 0.18, H() * 0.82),
      t: 0, speed: rand(0.028, 0.05), r: rand(16, 30),
      spin: rand(0, Math.PI * 2), dspin: rand(-0.3, 0.3), color: pick(REDS),
    })
  }

  const cleanup = () => {
    cancelAnimationFrame(raf)
    window.removeEventListener('resize', size)
    canvas.remove()
  }

  const frame = (now) => {
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    if (thrown < count && now - start < duration && Math.random() < 0.45) { launch(); thrown++ }

    for (let i = flying.length - 1; i >= 0; i--) {
      const f = flying[i]
      f.t = Math.min(1, f.t + f.speed)
      const e = f.t * f.t * (3 - 2 * f.t)   // decelerates into the impact
      const x = f.sx + (f.tx - f.sx) * e
      // a shallow arc: a straight line reads as a laser, not a throw
      const y = f.sy + (f.ty - f.sy) * e - Math.sin(f.t * Math.PI) * 70
      f.spin += f.dspin
      drawTomato(ctx, x, y, f.r * (0.7 + f.t * 0.5), f.spin, f.color)
      if (f.t >= 1) {
        splats.push(makeSplat(f.tx, f.ty, f.r * 1.25, f.color))
        flying.splice(i, 1)
      }
    }

    for (let i = splats.length - 1; i >= 0; i--) {
      if (!drawSplat(ctx, splats[i], now)) splats.splice(i, 1)
    }

    if (flying.length || splats.length || thrown < count) raf = requestAnimationFrame(frame)
    else { cleanup(); onDone?.() }
  }

  raf = requestAnimationFrame(frame)
  return cleanup
}
