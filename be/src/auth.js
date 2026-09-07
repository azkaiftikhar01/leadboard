import { Router } from 'express'
import crypto from 'node:crypto'
import Setting from './models/Setting.js'
import User from './models/User.js'

/**
 * Sign-in, and which board you land on.
 *
 * There is more than one board now: the lead has one, and anyone made second in
 * command gets their own. So a code no longer just opens the door - it says who
 * you are, and the session carries that through every request.
 *
 * Three ways in, in order:
 *   1. a board owner's own code (their board)
 *   2. the shared passphrase        (the lead's board)
 *   3. APP_PASSWORD                 (recovery, always accepted)
 *
 * The recovery key stays because there is no email on any of these accounts and
 * no way to prove who you are. A forgotten code with no fallback is a board
 * nobody can ever open again.
 */
const COOKIE = 'lb_session'
const KEY = 'passphrase'
const DAYS = 30

const stored = async () => (await Setting.findOne({ key: KEY }).lean())?.value || null

const hash = (plain, salt) => crypto.scryptSync(plain, salt, 64).toString('hex')

const same = (a, b) => {
  const x = Buffer.from(String(a))
  const y = Buffer.from(String(b))
  return x.length === y.length && crypto.timingSafeEqual(x, y)
}

const secretFor = async () => {
  const rec = await stored()
  return `${process.env.AUTH_SECRET || process.env.APP_PASSWORD || 'dev-only'}|${rec?.hash ?? 'bootstrap'}`
}

/** The session names the board, so switching passphrases switches board. */
const sign = async (exp, uid) => {
  const payload = `${exp}.${uid || ''}`
  const mac = crypto.createHmac('sha256', await secretFor()).update(payload).digest('hex')
  return `${payload}.${mac}`
}

const readSession = async (req) => {
  const raw = Object.fromEntries(
    (req.headers.cookie || '').split(';').map((c) => {
      const [k, ...v] = c.trim().split('=')
      return [k, v.join('=')]
    })
  )[COOKIE]
  const [exp, uid, mac] = String(raw || '').split('.')
  if (!exp || !mac || Number(exp) < Date.now()) return null
  const expected = crypto.createHmac('sha256', await secretFor()).update(`${exp}.${uid}`).digest('hex')
  if (!same(mac, expected)) return null
  return { uid: uid || null }
}

const setSession = async (res, uid) => {
  const exp = Date.now() + DAYS * 86_400_000
  res.setHeader(
    'Set-Cookie',
    `${COOKIE}=${await sign(exp, uid)}; Path=/; Max-Age=${DAYS * 86400}; HttpOnly; SameSite=Lax${
      process.env.NODE_ENV === 'production' ? '; Secure' : ''
    }`
  )
}

/* ---------------- passphrase storage ---------------- */

export const setBoardCode = async (userId, code) => {
  const salt = crypto.randomBytes(16).toString('hex')
  await User.findByIdAndUpdate(userId, { passSalt: salt, passHash: hash(code, salt), hasBoard: true })
}

export const clearBoardCode = async (userId) =>
  User.findByIdAndUpdate(userId, { $unset: { passSalt: '', passHash: '' }, hasBoard: false })

const storeShared = async (plain) => {
  const salt = crypto.randomBytes(16).toString('hex')
  await Setting.findOneAndUpdate(
    { key: KEY },
    { key: KEY, value: { salt, hash: hash(plain, salt) } },
    { upsert: true }
  )
}

/** Who does this code belong to? Returns the user, or null for the lead's board. */
const resolve = async (plain) => {
  if (!plain) return { ok: false }

  const owners = await User.find({ hasBoard: true, active: true }).select('+passSalt +passHash').lean()
  for (const u of owners) {
    if (u.passSalt && u.passHash && same(hash(plain, u.passSalt), u.passHash)) {
      return { ok: true, user: u }
    }
  }

  const rec = await stored()
  if (rec && same(hash(plain, rec.salt), rec.hash)) return { ok: true, user: null }

  const env = process.env.APP_PASSWORD || ''
  if (env && same(plain, env)) return { ok: true, user: null, viaRecovery: Boolean(rec) }

  return { ok: false }
}

const gateOn = async () =>
  Boolean(process.env.APP_PASSWORD || (await stored()) || (await User.exists({ hasBoard: true })))

/* ---------------- middleware ---------------- */

export async function requireAuth(req, res, next) {
  if (!(await gateOn())) {
    if (process.env.NODE_ENV === 'production') {
      return res.status(500).json({ error: 'APP_PASSWORD is not set — refusing to serve team data unprotected' })
    }
    req.board = { uid: null, isLead: true }
    return next()
  }
  const session = await readSession(req)
  if (!session) return res.status(401).json({ error: 'unauthorized' })

  // No uid means the shared passphrase, which is the lead's board. Resolve it
  // to the lead account when there is one, so handed-off work can say who it
  // came from rather than arriving anonymously.
  const me = session.uid
    ? await User.findById(session.uid).lean()
    : await User.findOne({ role: 'lead', active: true }).lean()

  req.board = {
    // the lead's board is still keyed on null, so tasks written before boards
    // existed stay where they are
    uid: session.uid ? String(session.uid) : null,
    me,
    isLead: !session.uid || me?.role === 'lead',
  }
  next()
}

export const authRoutes = Router()

authRoutes.get('/state', async (req, res) => {
  const on = await gateOn()
  const session = await readSession(req)
  const me = session?.uid ? await User.findById(session.uid).lean() : null
  res.json({
    required: on,
    authed: !on || Boolean(session),
    usingBootstrap: !(await stored()) && Boolean(process.env.APP_PASSWORD),
    hasRecovery: Boolean(process.env.APP_PASSWORD),
    board: session
      ? { name: me?.name ?? 'Lead board', role: me?.role ?? 'lead', userId: me?._id ?? null }
      : null,
  })
})

authRoutes.post('/login', async (req, res) => {
  const r = await resolve(String(req.body?.password || ''))
  if (!r.ok) return res.status(401).json({ error: 'Wrong passphrase' })
  await setSession(res, r.user?._id ? String(r.user._id) : '')
  res.json({
    ok: true,
    viaRecovery: Boolean(r.viaRecovery),
    board: { name: r.user?.name ?? 'Lead board', role: r.user?.role ?? 'lead' },
  })
})

/** Change your own code — the shared one if you are on the lead board, your own otherwise. */
authRoutes.post('/change', async (req, res) => {
  const { current, next } = req.body || {}
  if (!next || String(next).length < 6) {
    return res.status(400).json({ error: 'New passphrase needs at least 6 characters' })
  }
  const session = await readSession(req)
  if (await gateOn()) {
    if (!session) return res.status(401).json({ error: 'unauthorized' })
    const r = await resolve(String(current || ''))
    if (!r.ok) return res.status(401).json({ error: 'Current passphrase is wrong' })
  }
  if (session?.uid) await setBoardCode(session.uid, String(next))
  else await storeShared(String(next))
  await setSession(res, session?.uid || '')
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
