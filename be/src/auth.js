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
 * inside the app. APP_PASSWORD stays valid as a recovery key, because there is
 * no email on this account and no way to prove who you are - a forgotten
 * passphrase with no fallback is a permanently bricked board. That is a real
 * trade: anyone who can read the deployment config can get in. They can also
 * read the database directly, so it is not the weakest link.
 */
const COOKIE = 'lb_session'
const KEY = 'passphrase'
const DAYS = 30

const stored = async () => (await Setting.findOne({ key: KEY }).lean())?.value || null

/**
 * The cookie secret folds in the current passphrase hash, so changing the
 * passphrase invalidates every session signed under the old one. Without that,
 * "everyone else is signed out" would be a claim the code did not honour.
 */
const secretFor = async () => {
  const rec = await stored()
  return `${process.env.AUTH_SECRET || process.env.APP_PASSWORD || 'dev-only'}|${rec?.hash ?? 'bootstrap'}`
}

const sign = async (exp) => {
  const mac = crypto.createHmac('sha256', await secretFor()).update(String(exp)).digest('hex')
  return `${exp}.${mac}`
}

const validCookie = async (token) => {
  const [exp, mac] = String(token || '').split('.')
  if (!exp || !mac || Number(exp) < Date.now()) return false
  const expected = crypto.createHmac('sha256', await secretFor()).update(exp).digest('hex')
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

/* ---------------- passphrase ---------------- */

const hash = (plain, salt) => crypto.scryptSync(plain, salt, 64).toString('hex')

const same = (a, b) => {
  const x = Buffer.from(a)
  const y = Buffer.from(b)
  return x.length === y.length && crypto.timingSafeEqual(x, y)
}

const store = async (plain) => {
  const salt = crypto.randomBytes(16).toString('hex')
  await Setting.findOneAndUpdate(
    { key: KEY },
    { key: KEY, value: { salt, hash: hash(plain, salt) } },
    { upsert: true }
  )
}

/** Their passphrase, or the recovery key from the deployment config. */
const matches = async (plain) => {
  if (!plain) return { ok: false, viaRecovery: false }
  const rec = await stored()
  if (rec && same(hash(plain, rec.salt), rec.hash)) return { ok: true, viaRecovery: false }
  const env = process.env.APP_PASSWORD || ''
  if (env && same(plain, env)) return { ok: true, viaRecovery: Boolean(rec) }
  return { ok: false, viaRecovery: false }
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
  if (await validCookie(readCookie(req))) return next()
  res.status(401).json({ error: 'unauthorized' })
}

const issue = async (res) => {
  const exp = Date.now() + DAYS * 86_400_000
  res.setHeader(
    'Set-Cookie',
    `${COOKIE}=${await sign(exp)}; Path=/; Max-Age=${DAYS * 86400}; HttpOnly; SameSite=Lax${
      process.env.NODE_ENV === 'production' ? '; Secure' : ''
    }`
  )
}

export const authRoutes = Router()

authRoutes.get('/state', async (req, res) => {
  const on = await gateOn()
  const rec = await stored()
  res.json({
    required: on,
    authed: !on || (await validCookie(readCookie(req))),
    // still on the deployment passphrase, so the UI can nudge him to set his own
    usingBootstrap: !rec && Boolean(process.env.APP_PASSWORD),
    // whether a recovery key exists at all, so the lock screen can say so honestly
    hasRecovery: Boolean(process.env.APP_PASSWORD),
  })
})

authRoutes.post('/login', async (req, res) => {
  const { ok, viaRecovery } = await matches(String(req.body?.password || ''))
  if (!ok) return res.status(401).json({ error: 'Wrong passphrase' })
  await issue(res)
  res.json({ ok: true, viaRecovery })
})

/** Change it from inside the board. Requires the current one, or the recovery key. */
authRoutes.post('/change', async (req, res) => {
  const { current, next } = req.body || {}
  if (!next || String(next).length < 6) {
    return res.status(400).json({ error: 'New passphrase needs at least 6 characters' })
  }
  if (await gateOn()) {
    if (!(await validCookie(readCookie(req)))) return res.status(401).json({ error: 'unauthorized' })
    const { ok } = await matches(String(current || ''))
    if (!ok) return res.status(401).json({ error: 'Current passphrase is wrong' })
  }
  await store(String(next))
  // the secret just changed, so every existing cookie is now void - re-issue
  // this one so he is not signed out by his own change
  await issue(res)
  res.json({ ok: true })
})

authRoutes.post('/logout', (_req, res) => {
  res.setHeader(
    'Set-Cookie',
    `${COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax${
      process.env.NODE_ENV === 'production' ? '; Secure' : ''
    }`
  )
  res.json({ ok: true })
})
