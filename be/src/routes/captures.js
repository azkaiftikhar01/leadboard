import { Router } from 'express'
import multer from 'multer'
import path from 'node:path'
import Capture from '../models/Capture.js'
import User from '../models/User.js'
import { transcribe } from '../services/stt/index.js'
import { parseTranscript } from '../services/parse.js'
import { buildResolver, toCards } from '../services/resolve.js'
import { applyCard } from '../lib/apply.js'

const r = Router()

const upload = multer({
  dest: path.resolve('uploads'),
  limits: { fileSize: 25 * 1024 * 1024 },
})

const todayStr = () => new Date().toISOString().slice(0, 10)

/**
 * The whole capture spine in one request: audio in, confirm-cards out.
 * Kept as a single round trip so the popover shows one spinner, not three.
 */
r.post('/', upload.single('audio'), async (req, res) => {
  const capture = await Capture.create({
    audioPath: req.file?.path,
    durationSec: Number(req.body.durationSec) || undefined,
    source: req.body.source || 'popover',
    project: req.body.project || undefined,
    transcript: req.body.transcript || '',
    status: 'transcribing',
  })

  try {
    if (!capture.transcript && capture.audioPath) {
      const { text, provider } = await transcribe(capture.audioPath)
      capture.transcript = text
      capture.sttProvider = provider
    }
    if (!capture.transcript.trim()) {
      capture.status = 'failed'
      capture.error = 'nothing heard'
      await capture.save()
      return res.status(422).json(capture)
    }

    capture.status = 'parsing'
    await capture.save()

    const resolver = await buildResolver()
    const parsed = await parseTranscript(capture.transcript, {
      people: resolver.people,
      projects: resolver.projects,
      today: todayStr(),
    })

    capture.parsed = toCards(parsed, resolver)
    capture.status = 'pending'
    await capture.save()
    res.status(201).json(capture)
  } catch (err) {
    capture.status = 'failed'
    capture.error = err.message
    await capture.save()
    // transcript survives a failed parse, so nothing he said is ever lost
    res.status(500).json({ error: err.message, capture })
  }
})

r.get('/inbox', async (_req, res) => {
  const captures = await Capture.find({ status: { $in: ['pending', 'partial', 'failed'] } })
    .sort('-createdAt')
    .lean()
  res.json(captures)
})

r.get('/:id', async (req, res) => {
  res.json(await Capture.findById(req.params.id).lean())
})

/** Accept one card. Payload may carry edits the lead made on the chip. */
r.post('/:id/cards/:cardId/apply', async (req, res) => {
  const capture = await Capture.findById(req.params.id)
  const card = capture?.parsed.id(req.params.cardId)
  if (!card) return res.status(404).json({ error: 'card not found' })

  const lead = await User.findOne({ role: 'lead' }).lean()
  const merged = { kind: card.kind, payload: { ...card.payload, ...(req.body.payload || {}) } }

  try {
    const { ref } = await applyCard(merged, { leadId: lead?._id, captureId: capture._id })
    card.status = 'applied'
    card.appliedRef = ref
    capture.status = capture.parsed.every((c) => c.status !== 'pending') ? 'applied' : 'partial'
    await capture.save()
    res.json({ card, capture })
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
})

r.post('/:id/cards/:cardId/discard', async (req, res) => {
  const capture = await Capture.findById(req.params.id)
  const card = capture?.parsed.id(req.params.cardId)
  if (!card) return res.status(404).json({ error: 'card not found' })
  card.status = 'discarded'
  capture.status = capture.parsed.every((c) => c.status !== 'pending') ? 'applied' : 'partial'
  await capture.save()
  res.json({ card, capture })
})

export default r
