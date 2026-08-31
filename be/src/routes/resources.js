import { Router } from 'express'
import Resource, { RESOURCE_KINDS } from '../models/Resource.js'
import User from '../models/User.js'
import { seal, open, canEncrypt } from '../lib/secretbox.js'

const r = Router()

/** Shape sent to the client. The secret is never in here — only whether one exists. */
const shape = (d) => ({
  _id: d._id,
  project: d.project,
  kind: d.kind,
  label: d.label,
  url: d.url,
  username: d.username,
  notes: d.notes,
  hasSecret: Boolean(d.secret),
  lastRevealedAt: d.lastRevealedAt,
  createdAt: d.createdAt,
})

r.get('/kinds', (_req, res) =>
  res.json({
    kinds: Object.entries(RESOURCE_KINDS).map(([key, v]) => ({ key, ...v })),
    // so the form can say up front that credentials cannot be stored yet
    canStoreSecrets: canEncrypt(),
  })
)

r.get('/', async (req, res) => {
  const q = {}
  if (req.query.project) q.project = req.query.project
  if (req.query.q) {
    const rx = new RegExp(String(req.query.q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
    q.$or = [{ label: rx }, { url: rx }, { notes: rx }, { username: rx }]
  }
  const rows = await Resource.find(q).sort('kind label').lean()
  res.json(rows.map(shape))
})

r.post('/', async (req, res) => {
  const { project, kind, label, url, username, secret, notes } = req.body || {}
  if (!project || !label?.trim()) return res.status(400).json({ error: 'project and label are required' })

  let sealed = ''
  if (secret) {
    if (!canEncrypt()) {
      return res.status(400).json({
        error: 'Set RESOURCE_KEY in the environment before storing credentials — refusing to save it unencrypted.',
      })
    }
    try { sealed = seal(secret) } catch (e) { return res.status(400).json({ error: e.message }) }
  }

  const lead = await User.findOne({ role: 'lead' }).lean()
  const created = await Resource.create({
    project, kind: kind || 'link', label: label.trim(),
    url: url || '', username: username || '', secret: sealed, notes: notes || '',
    addedBy: lead?._id,
  })
  res.status(201).json(shape(created.toObject()))
})

r.patch('/:id', async (req, res) => {
  const patch = {}
  for (const k of ['kind', 'label', 'url', 'username', 'notes']) {
    if (req.body[k] !== undefined) patch[k] = req.body[k]
  }
  if (req.body.secret !== undefined) {
    if (req.body.secret === '') patch.secret = ''
    else {
      if (!canEncrypt()) return res.status(400).json({ error: 'RESOURCE_KEY is not set' })
      patch.secret = seal(req.body.secret)
    }
  }
  const doc = await Resource.findByIdAndUpdate(req.params.id, patch, { new: true }).lean()
  res.json(shape(doc))
})

/**
 * The one endpoint that returns a secret, one at a time and only when asked.
 * The reveal is stamped, so there is at least a record that it happened.
 */
r.post('/:id/reveal', async (req, res) => {
  const doc = await Resource.findById(req.params.id)
  if (!doc) return res.status(404).json({ error: 'not found' })
  if (!doc.secret) return res.json({ secret: null })
  try {
    const secret = open(doc.secret)
    doc.lastRevealedAt = new Date()
    await doc.save()
    res.json({ secret })
  } catch {
    // the key changed, or the row was tampered with. Say which rather than
    // returning something that looks like a password and is not.
    res.status(409).json({
      error: 'Could not decrypt this — RESOURCE_KEY has changed since it was saved.',
    })
  }
})

r.delete('/:id', async (req, res) => {
  await Resource.findByIdAndDelete(req.params.id)
  res.json({ ok: true })
})

export default r
