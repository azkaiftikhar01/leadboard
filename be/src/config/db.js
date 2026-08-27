import mongoose from 'mongoose'

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
