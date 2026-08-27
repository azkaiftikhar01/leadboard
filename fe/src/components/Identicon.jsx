/**
 * Deterministic avatars, GitHub-style: a symmetric block pattern over a gradient,
 * derived from the name. Same person always gets the same face, no upload, no
 * placeholder photo, and a team of eight is instantly distinguishable at a glance.
 */
function hash(str = '') {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

// every pair travels somewhere along the #E57A44 → #251351 axis, so a wall of
// avatars reads as one family while staying distinguishable side by side
const PAIRS = [
  ['#F0954F', '#C2536A'], ['#E57A44', '#7A3B7E'], ['#A8446F', '#251351'],
  ['#F5A65C', '#A8446F'], ['#C2536A', '#4A2A8C'], ['#E5A044', '#D4525F'],
  ['#7A3B7E', '#251351'], ['#F0954F', '#8C3F6E'], ['#D4525F', '#5C2A7A'],
  ['#4A2A8C', '#8E4A8C'], ['#E57A44', '#B5493F'], ['#B06A9E', '#3B1E6E'],
]

export function gradientFor(name) {
  return PAIRS[hash(name) % PAIRS.length]
}

export function Identicon({ name = '?', size = 34, rounded = 10 }) {
  const h = hash(name)
  const [a, b] = gradientFor(name)
  const id = `g${h.toString(36)}`

  // 5 columns mirrored into a 5x5 grid, so the pattern reads as a face-ish mark
  const cells = []
  for (let x = 0; x < 3; x++) {
    for (let y = 0; y < 5; y++) {
      if ((h >> (x * 5 + y)) & 1) {
        cells.push([x, y])
        if (x < 2) cells.push([4 - x, y])
      }
    }
  }

  return (
    <svg width={size} height={size} viewBox="0 0 5 5" style={{ borderRadius: rounded, flex: 'none', display: 'block' }} aria-label={name}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={a} />
          <stop offset="100%" stopColor={b} />
        </linearGradient>
      </defs>
      <rect width="5" height="5" fill={`url(#${id})`} />
      <g fill="rgba(255,255,255,.82)">
        {cells.map(([x, y], i) => <rect key={i} x={x} y={y} width="1" height="1" />)}
      </g>
    </svg>
  )
}
