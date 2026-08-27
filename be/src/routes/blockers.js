import { Router } from 'express'
import Blocker from '../models/Blocker.js'

const r = Router()

r.get('/', async (req, res) => {
  const q = { clearedAt: null }
  if (req.query.type) q.type = req.query.type
  res.json(
    await Blocker.find(q).populate('waitingOn', 'name').populate('project', 'name color').sort('openedAt').lean({ virtuals: true })
  )
})

r.post('/', async (req, res) => {
  res.status(201).json(await Blocker.create(req.body))
})

r.post('/:id/clear', async (req, res) => {
  res.json(await Blocker.findByIdAndUpdate(req.params.id, { clearedAt: new Date() }, { new: true }))
})

export default r
