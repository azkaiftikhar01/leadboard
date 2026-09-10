/**
 * Tomatoes, thrown at the screen.
 *
 * Confetti recoloured red would still read as celebration - the meaning is in
 * the motion, not the colour. So these fly in from off-screen toward a point,
 * spin on the way, and burst into a splat that spreads, drips and fades. Drawn
 * by hand on a canvas because that arc-and-impact is exactly what a particle
 * library will not do.
 */
/** Each tomato is shaded from its own ramp, so a crowd of them is not a crowd
 *  of identical stickers. */
const TINTS = [
  { hi: '#FF9A80', mid: '#E5432C', base: '#C4231A', dark: '#7C1109', splat: '#C4231A' },
  { hi: '#FF8C6E', mid: '#D93826', base: '#B01C14', dark: '#6E0E08', splat: '#B01C14' },
  { hi: '#FFB08F', mid: '#EE5533', base: '#D0331F', dark: '#8A1A0C', splat: '#D0331F' },
  { hi: '#FF8262', mid: '#CE2F22', base: '#A31810', dark: '#630C06', splat: '#A31810' },
  { hi: '#FFA88C', mid: '#E64A2E', base: '#BE2417', dark: '#75100A', splat: '#BE2417' },
]
const rand = (a, b) => a + Math.random() * (b - a)
const pick = (xs) => xs[Math.floor(Math.random() * xs.length)]

function drawTomato(ctx, x, y, r, spin, tint) {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(spin)

  // A flat fill reads as a red dot. The volume comes from a radial gradient
  // offset toward the light, a dark rim, and lobe shading down the body.
  const body = ctx.createRadialGradient(-r * 0.32, -r * 0.38, r * 0.08, 0, 0, r * 1.12)
  body.addColorStop(0, tint.hi)
  body.addColorStop(0.42, tint.mid)
  body.addColorStop(0.82, tint.base)
  body.addColorStop(1, tint.dark)

  ctx.beginPath()
  ctx.ellipse(0, r * 0.04, r, r * 0.9, 0, 0, Math.PI * 2)
  ctx.fillStyle = body
  ctx.fill()

  // the seam lines a real tomato has, running pole to pole
  ctx.save()
  ctx.clip()
  ctx.globalAlpha = 0.16
  ctx.fillStyle = tint.dark
  for (const off of [-0.52, 0.04, 0.58]) {
    ctx.beginPath()
    ctx.ellipse(r * off, r * 0.04, r * 0.15, r * 0.9, 0, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()

  // contact shadow under the shoulder, so it does not float
  ctx.globalAlpha = 0.22
  ctx.fillStyle = tint.dark
  ctx.beginPath()
  ctx.ellipse(r * 0.12, r * 0.42, r * 0.72, r * 0.4, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.globalAlpha = 1

  // two highlights: a soft sheen and a tight specular, which is what sells wet skin
  ctx.fillStyle = 'rgba(255,255,255,.30)'
  ctx.beginPath()
  ctx.ellipse(-r * 0.34, -r * 0.36, r * 0.30, r * 0.19, -0.55, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = 'rgba(255,255,255,.85)'
  ctx.beginPath()
  ctx.ellipse(-r * 0.40, -r * 0.44, r * 0.11, r * 0.07, -0.55, 0, Math.PI * 2)
  ctx.fill()

  // Calyx: a rosette of tapered sepals around a point at the top, squashed
  // vertically so it reads as seen from slightly above rather than head-on.
  // Sweeping them around the whole fruit put green down one side of it.
  const cx = 0
  const cy = -r * 0.66
  const green = ctx.createLinearGradient(0, cy - r * 0.5, 0, cy + r * 0.2)
  green.addColorStop(0, '#6FBF47')
  green.addColorStop(1, '#2E6B23')
  ctx.fillStyle = green
  for (let i = 0; i < 6; i++) {
    const a2 = (i / 6) * Math.PI * 2 + 0.3
    const len = r * (0.46 + (i % 2) * 0.12)
    const tipX = cx + Math.cos(a2) * len
    const tipY = cy + Math.sin(a2) * len * 0.42     // flattened = viewed from above
    const nx = -Math.sin(a2) * r * 0.11
    const ny = Math.cos(a2) * r * 0.11 * 0.42
    ctx.beginPath()
    ctx.moveTo(cx + nx, cy + ny)
    ctx.quadraticCurveTo(cx + Math.cos(a2) * len * 0.55 + nx, cy + Math.sin(a2) * len * 0.42 * 0.55 + ny, tipX, tipY)
    ctx.quadraticCurveTo(cx + Math.cos(a2) * len * 0.55 - nx, cy + Math.sin(a2) * len * 0.42 * 0.55 - ny, cx - nx, cy - ny)
    ctx.fill()
  }
  // the stub of stem, sitting in the middle of the rosette
  ctx.fillStyle = '#3F7A2E'
  ctx.beginPath()
  ctx.ellipse(cx, cy - r * 0.06, r * 0.1, r * 0.13, 0, 0, Math.PI * 2)
  ctx.fill()

  ctx.restore()
}

function makeSplat(x, y, r, color) {
  // irregular, because a circular splat looks like a sticker
  return {
    x, y, r, color, born: performance.now(),
    lobes: Array.from({ length: 11 }, (_, i) => ({
      a: (i / 11) * Math.PI * 2 + rand(-0.14, 0.14), d: r * rand(0.6, 1.45),
    })),
    spray: Array.from({ length: Math.round(rand(5, 10)) }, () => ({
      a: rand(0, Math.PI * 2), d: r * rand(1.3, 2.4), s: r * rand(0.06, 0.16),
    })),
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
  // Curve through the lobes rather than joining them with straight lines —
  // a polygon reads as a torn sticker, not as something wet that landed.
  const pts = s.lobes.map((l) => {
    const d = l.d * settle
    return [Math.cos(l.a) * d, Math.sin(l.a) * d * 0.86]
  })
  ctx.beginPath()
  const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
  let m = mid(pts[pts.length - 1], pts[0])
  ctx.moveTo(m[0], m[1])
  for (let i = 0; i < pts.length; i++) {
    const next = mid(pts[i], pts[(i + 1) % pts.length])
    ctx.quadraticCurveTo(pts[i][0], pts[i][1], next[0], next[1])
  }
  ctx.closePath()
  ctx.fill()

  // droplets flung clear of the impact — the part that sells the burst
  for (const d of s.spray) {
    const t = Math.min(1, age / 0.22)
    ctx.beginPath()
    ctx.ellipse(Math.cos(d.a) * d.d * t, Math.sin(d.a) * d.d * t * 0.8,
      d.s, d.s * 1.15, d.a, 0, Math.PI * 2)
    ctx.fill()
  }

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

export function throwTomatoes({ count = 42, duration = 2600, onDone } = {}) {
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
      t: 0, speed: rand(0.013, 0.026), r: rand(18, 38),
      spin: rand(0, Math.PI * 2), dspin: rand(-0.35, 0.35), tint: pick(TINTS),
    })
  }

  const cleanup = () => {
    cancelAnimationFrame(raf)
    window.removeEventListener('resize', size)
    canvas.remove()
  }

  const frame = (now) => {
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    // several per frame, or thirty-eight of them trickle in one at a time
    if (thrown < count && now - start < duration) {
      const n = Math.random() < 0.5 ? 2 : 1
      for (let k = 0; k < n && thrown < count; k++) { launch(); thrown++ }
    }

    for (let i = flying.length - 1; i >= 0; i--) {
      const f = flying[i]
      f.t = Math.min(1, f.t + f.speed)
      const e = f.t * f.t * (3 - 2 * f.t)   // decelerates into the impact
      const x = f.sx + (f.tx - f.sx) * e
      // a shallow arc: a straight line reads as a laser, not a throw
      const y = f.sy + (f.ty - f.sy) * e - Math.sin(f.t * Math.PI) * 70
      f.spin += f.dspin
      drawTomato(ctx, x, y, f.r * (0.62 + f.t * 0.6), f.spin, f.tint)
      if (f.t >= 1) {
        splats.push(makeSplat(f.tx, f.ty, f.r * 1.3, f.tint.splat))
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
