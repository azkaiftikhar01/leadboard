import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import morgan from 'morgan'
import { connectDb } from './config/db.js'

import people from './routes/people.js'
import projects from './routes/projects.js'
import tasks from './routes/tasks.js'
import captures from './routes/captures.js'
import standup from './routes/standup.js'
import blockers from './routes/blockers.js'
import today from './routes/today.js'
import awards from './routes/awards.js'
import notes from './routes/notes.js'
import { requireAuth, authRoutes } from './auth.js'

const app = express()

app.use(cors({ origin: process.env.CORS_ORIGIN?.split(',') ?? true, credentials: true }))
app.use(express.json({ limit: '2mb' }))
if (process.env.NODE_ENV !== 'production') app.use(morgan('dev'))

/**
 * Serverless runs this per request, so the database connection has to be
 * established inside the request path. connectDb caches the promise, so a warm
 * container reuses the socket instead of opening one per invocation - which
 * would exhaust an Atlas connection limit within minutes.
 */
app.use(async (_req, _res, next) => {
  try { await connectDb(); next() } catch (err) { next(err) }
})

app.get('/api/health', (_req, res) => res.json({ ok: true }))
app.use('/api/auth', authRoutes)

// everything past here is the team's performance record - it does not go out
// to whoever finds the URL
app.use('/api', requireAuth)

app.use('/api/people', people)
app.use('/api/projects', projects)
app.use('/api/tasks', tasks)
app.use('/api/captures', captures)
app.use('/api/standup', standup)
app.use('/api/blockers', blockers)
app.use('/api/today', today)
app.use('/api/awards', awards)
app.use('/api/notes', notes)

app.use((err, _req, res, _next) => {
  console.error(err)
  res.status(err.status || 500).json({ error: err.message })
})

export default app
