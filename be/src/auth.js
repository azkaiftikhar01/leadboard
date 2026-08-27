import { Router } from 'express'
import crypto from 'node:crypto'

/**
 * A single shared passphrase, signed into a cookie.
 *
 * Deliberately minimal - this is one lead's private board, not a multi-tenant
 * product. But it is not optional: the moment this has a public URL, an
 * unprotected deployment hands anyone who finds it a page ranking the team by
 * performance, with names attached.
 *
 * Set APP_PASSWORD and AUTH_SECRET in the environment. With no APP_PASSWORD the
 * gate stays open, which is fine on localhost and is refused in production.
 */
const COOKIE = 'lb_session'
const DAYS = 30

const secret = () => process.env.AUTH_SECRET || process.env.APP_PASSWORD || 'dev-only'

const sign = (exp) =>
  `${exp}.${crypto.createHmac('sha256', secret()).update(String(exp)).digest('hex')}`

const valid = (token) => {
  const [exp, mac] = String(token || '').split('.')
  if (!exp || !mac || Number(exp) < Date.now()) return false
  const expected = crypto.createHmac('sha256', secret()).update(exp).digest('hex')
  // timing-safe, and length-guarded so compare cannot throw on a malformed cookie
  const a = Buffer.from(mac)
  const b = Buffer.from(expected)
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}

const readCookie = (req) =>
  Object.fromEntries(
    (req.headers.cookie || '').split(';').map((c) => {
      const [k, ...v] = c.trim().split('=')
      return [k, v.join('=')]
    })
  )[COOKIE]

export function requireAuth(req, res, next) {
  if (!process.env.APP_PASSWORD) {
    if (process.env.NODE_ENV === 'production') {
      return res.status(500).json({ error: 'APP_PASSWORD is not set — refusing to serve team data unprotected' })
    }
    return next()
  }
  if (valid(readCookie(req))) return next()
  res.status(401).json({ error: 'unauthorized' })
}

export const authRoutes = Router()

authRoutes.get('/state', (req, res) => {
  res.json({
    required: Boolean(process.env.APP_PASSWORD),
    authed: !process.env.APP_PASSWORD || valid(readCookie(req)),
  })
})

authRoutes.post('/login', (req, res) => {
  const given = String(req.body?.password || '')
  const real = process.env.APP_PASSWORD || ''
  const ok =
    real.length > 0 &&
    given.length === real.length &&
    crypto.timingSafeEqual(Buffer.from(given), Buffer.from(real))

  if (!ok) return res.status(401).json({ error: 'Wrong passphrase' })

  const exp = Date.now() + DAYS * 86_400_000
  res.setHeader(
    'Set-Cookie',
    `${COOKIE}=${sign(exp)}; Path=/; Max-Age=${DAYS * 86400}; HttpOnly; SameSite=Lax${
      process.env.NODE_ENV === 'production' ? '; Secure' : ''
    }`
  )
  res.json({ ok: true })
})

authRoutes.post('/logout', (_req, res) => {
  res.setHeader('Set-Cookie', `${COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`)
  res.json({ ok: true })
})
