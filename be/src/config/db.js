import mongoose from 'mongoose'
import mongooseLeanVirtuals from 'mongoose-lean-virtuals'

// without this, .lean({ virtuals: true }) silently drops every virtual - which
// is how daysOnTask and ageHours were arriving as undefined and rendering NaN
mongoose.plugin(mongooseLeanVirtuals)

export async function connectDb() {
  const uri = process.env.MONGODB_URI?.trim()
  if (!uri) {
    throw new Error(
      'MONGODB_URI is empty. Put your connection string in be/.env:\n' +
        '  MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/leadboard'
    )
  }
  mongoose.set('strictQuery', true)
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 8000 })
  console.log(`mongo connected: ${uri.replace(/\/\/[^@]*@/, '//****@')}`)
}
