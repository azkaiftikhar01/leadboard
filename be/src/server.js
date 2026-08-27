import 'dotenv/config'
import app from './app.js'
import { connectDb } from './config/db.js'

// a bad request must never take the API down - he will be mid-thought when it
// happens, and a dead server reads to him as "the app lost what I said"
process.on('unhandledRejection', (err) => console.error('unhandled rejection:', err))
process.on('uncaughtException', (err) => console.error('uncaught exception:', err))

const port = process.env.PORT || 4000
connectDb()
  .then(() => app.listen(port, () => console.log(`leadboard api on :${port}`)))
  .catch((err) => {
    console.error('failed to start:', err.message)
    process.exit(1)
  })
