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

const app = express()

app.use(cors({ origin: process.env.CORS_ORIGIN?.split(',') ?? true }))
app.use(express.json({ limit: '2mb' }))
app.use(morgan('dev'))

app.get('/api/health', (_req, res) => res.json({ ok: true }))
app.use('/api/people', people)
app.use('/api/projects', projects)
app.use('/api/tasks', tasks)
app.use('/api/captures', captures)
app.use('/api/standup', standup)
app.use('/api/blockers', blockers)
app.use('/api/today', today)

app.use((err, _req, res, _next) => {
  console.error(err)
  res.status(err.status || 500).json({ error: err.message })
})

// a bad request must never take the API down - he will be mid-thought when it
// happens and a dead server reads to him as "the app lost what I said"
process.on('unhandledRejection', (err) => console.error('unhandled rejection:', err))
process.on('uncaughtException', (err) => console.error('uncaught exception:', err))

const port = process.env.PORT || 4000
connectDb()
  .then(() => app.listen(port, () => console.log(`leadboard api on :${port}`)))
  .catch((err) => {
    console.error('failed to start:', err.message)
    process.exit(1)
  })
