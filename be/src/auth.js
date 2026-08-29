import { Router } from 'express'
import crypto from 'node:crypto'
import Setting from './models/Setting.js'

/**
 * A single shared passphrase, signed into a cookie.
 *
 * Deliberately minimal - this is one lead's private board, not a multi-tenant
 * product. But it is not optional: the moment this has a public URL, an
 * unprotected deployment hands anyone who finds it a page ranking the team by
 * performance, with names attached.
 *
 * The live passphrase is stored hashed in the database so it can be changed from
 * inside the app. APP_PASSWORD is the bootstrap - it works until a passphrase is
 * set, and is ignored afterwards.
 */
const COOKIE = 'lb_session'
const KEY = 'passphrase'
const DAYS = 30

const secret = () => process.env.AUTH_SECRET || process.env.APP_PASSWORD || 'dev-only'

const sign = (exp) =>
  `${exp}.${crypto.createHmac('sha256', secret()).update(String(exp)).digest('hex')}`

const validCookie = (token) => {
  const [exp, mac] = String(token || '').split('.')
  if (!exp || !mac || Number(exp) < Date.now()) return false
  const expected = crypto.createHmac('sha256', secret()).update(exp).digest('hex')
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

/* ---------------- passphrase storage ---------------- */

const hash = (plain, salt) =>
  crypto.scryptSync(plain, salt, 64).toString('hex')

const store = async (plain) => {
  const salt = crypto.randomBytes(16).toString('hex')
  await Setting.findOneAndUpdate(
    { key: KEY },
    { key: KEY, value: { salt, hash: hash(plain, salt) } },
    { upsert: true }
  )
}

const stored = async () => (await Setting.findOne({ key: KEY }).lean())?.value || null

const matches = async (plain) => {
  const rec = await stored()
  if (rec) {
    const a = Buffer.from(hash(plain, rec.salt))
    const b = Buffer.from(rec.hash)
    return a.length === b.length && crypto.timingSafeEqual(a, b)
  }
  // no passphrase set yet - fall back to the bootstrap env var
  const env = process.env.APP_PASSWORD || ''
  if (!env) return false
  const a = Buffer.from(plain)
  const b = Buffer.from(env)
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}

const gateOn = async () => Boolean(process.env.APP_PASSWORD || (await stored()))

/* ---------------- middleware ---------------- */

export async function requireAuth(req, res, next) {
  if (!(await gateOn())) {
    if (process.env.NODE_ENV === 'production') {
      return res.status(500).json({ error: 'APP_PASSWORD is not set — refusing to serve team data unprotected' })
    }
    return next()
  }
  if (validCookie(readCookie(req))) return next()
  res.status(401).json({ error: 'unauthorized' })
}

const setCookie = (res) => {
  const exp = Date.now() + DAYS * 86_400_000
  res.setHeader(
    'Set-Cookie',
    `${COOKIE}=${sign(exp)}; Path=/; Max-Age=${DAYS * 86400}; HttpOnly; SameSite=Lax${
      process.env.NODE_ENV === 'production' ? '; Secure' : ''
    }`
  )
}

export const authRoutes = Router()

authRoutes.get('/state', async (req, res) => {
  const on = await gateOn()
  res.json({
    required: on,
    authed: !on || validCookie(readCookie(req)),
    // true while still on the env var, so the UI can nudge him to set his own
    usingBootstrap: !(await stored()) && Boolean(process.env.APP_PASSWORD),
  })
})

authRoutes.post('/login', async (req, res) => {
  const given = String(req.body?.password || '')
  if (!given || !(await matches(given))) return res.status(401).json({ error: 'Wrong passphrase' })
  setCookie(res)
  res.json({ ok: true })
})

/** Change it from inside the board. Requires the current one. */
authRoutes.post('/change', async (req, res) => {
  const { current, next } = req.body || {}
  if (!next || String(next).length < 6) {
    return res.status(400).json({ error: 'New passphrase needs at least 6 characters' })
  }
  if (await gateOn()) {
    if (!validCookie(readCookie(req))) return res.status(401).json({ error: 'unauthorized' })
    if (!(await matches(String(current || '')))) {
      return res.status(401).json({ error: 'Current passphrase is wrong' })
    }
  }
  await store(String(next))
  // re-sign so the session survives the change
  setCookie(res)
  res.json({ ok: true })
})

authRoutes.post('/logout', (_req, res) => {
  res.setHeader('Set-Cookie', `${COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`)
  res.json({ ok: true })
})
