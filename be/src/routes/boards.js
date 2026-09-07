import { Router } from 'express'
import crypto from 'node:crypto'
import User from '../models/User.js'
import Task from '../models/Task.js'
import { setBoardCode, clearBoardCode } from '../auth.js'

const r = Router()

/** Everyone who has a board of their own, plus the lead's. */
r.get('/', async (req, res) => {
  const owners = await User.find({ hasBoard: true, active: true })
    .select('name title role')
    .sort('role name')
    .lean()

  const counts = await Task.aggregate([
    { $match: { track: 'lead', state: { $nin: ['done', 'dropped'] } } },
    { $group: { _id: '$owner', n: { $sum: 1 } } },
  ])
  const open = Object.fromEntries(counts.map((c) => [String(c._id), c.n]))

  res.json({
    me: req.board?.uid ?? null,
    isLead: Boolean(req.board?.isLead),
    boards: [
      { userId: null, name: 'Lead board', role: 'lead', open: (open.null ?? 0) + (open.undefined ?? 0) },
      ...owners
        .filter((u) => u.role !== 'lead')
        .map((u) => ({ userId: u._id, name: u.name, role: u.role, title: u.title, open: open[String(u._id)] ?? 0 })),
    ],
  })
})

/**
 * Give somebody a board, and a code to open it with.
 *
 * The code is returned exactly once, here, because it is stored hashed and
 * cannot be read back. Rotating issues a new one and invalidates the old.
 */
r.post('/:userId/enable', async (req, res) => {
  if (!req.board?.isLead) return res.status(403).json({ error: 'Only the lead can hand out boards.' })

  const user = await User.findById(req.params.userId)
  if (!user) return res.status(404).json({ error: 'not found' })

  const code = String(req.body?.code || '').trim() || crypto.randomBytes(6).toString('base64url')
  if (code.length < 6) return res.status(400).json({ error: 'A board code needs at least 6 characters' })

  if (user.role === 'dev' || user.role === 'manager') user.role = 'second'
  await user.save()
  await setBoardCode(user._id, code)

  res.json({ ok: true, name: user.name, role: user.role, code })
})

r.post('/:userId/disable', async (req, res) => {
  if (!req.board?.isLead) return res.status(403).json({ error: 'Only the lead can do that.' })
  await clearBoardCode(req.params.userId)
  res.json({ ok: true })
})

export default r
