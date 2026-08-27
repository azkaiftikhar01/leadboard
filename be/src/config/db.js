import mongoose from 'mongoose'
import mongooseLeanVirtuals from 'mongoose-lean-virtuals'

// without this, .lean({ virtuals: true }) silently drops every virtual - which
// is how daysOnTask and ageHours ended up rendering as NaN
mongoose.plugin(mongooseLeanVirtuals)

/**
 * Serverless calls this on every request. Caching the promise on globalThis
 * survives module re-evaluation within a warm container, so one container holds
 * one connection instead of opening one per invocation and exhausting the
 * Atlas connection limit.
 */
const cache = (globalThis.__leadboardMongo ??= { conn: null, promise: null })

export async function connectDb() {
  if (cache.conn) return cache.conn

  const uri = process.env.MONGODB_URI?.trim()
  if (!uri) {
    throw new Error(
      'MONGODB_URI is empty. Put your connection string in be/.env:\n' +
        '  MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/leadboard'
    )
  }

  if (!cache.promise) {
    mongoose.set('strictQuery', true)
    cache.promise = mongoose
      .connect(uri, {
        serverSelectionTimeoutMS: 8000,
        // one socket per warm container is plenty and keeps Atlas happy
        maxPoolSize: 5,
      })
      .then((m) => {
        console.log(`mongo connected: ${uri.replace(/\/\/[^@]*@/, '//****@')}`)
        return m
      })
      .catch((err) => { cache.promise = null; throw err })
  }

  cache.conn = await cache.promise
  return cache.conn
}
