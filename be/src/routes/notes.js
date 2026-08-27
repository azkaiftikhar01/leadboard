import { Router } from 'express'
import Note from '../models/Note.js'

const r = Router()

/** Pinned first, then newest. */
r.get('/', async (req, res) => {
  const q = {}
  if (req.query.refType) q.refType = req.query.refType
  if (req.query.refId) q.refId = req.query.refId
  if (req.query.q) q.$text = { $search: req.query.q }
  res.json(
    await Note.find(q)
      .sort({ pinned: -1, updatedAt: -1 })
      .limit(Number(req.query.limit) || 100)
      .lean()
  )
})

r.post('/', async (req, res) => {
  const { body, source, refType, refId, tags } = req.body
  if (!body?.trim()) return res.status(400).json({ error: 'a note needs something in it' })
  res.status(201).json(
    await Note.create({
      body: body.trim(),
      source: source || 'typed',
      refType: refType || 'none',
      refId: refId || undefined,
      tags: tags || [],
    })
  )
})

r.patch('/:id', async (req, res) => {
  const patch = {}
  for (const k of ['body', 'pinned', 'refType', 'refId', 'tags']) {
    if (req.body[k] !== undefined) patch[k] = req.body[k]
  }
  res.json(await Note.findByIdAndUpdate(req.params.id, patch, { new: true }))
})

r.delete('/:id', async (req, res) => {
  await Note.findByIdAndDelete(req.params.id)
  res.json({ ok: true })
})

export default r
