import mongoose from 'mongoose'

export async function connectDb() {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/leadboard'
  mongoose.set('strictQuery', true)
  await mongoose.connect(uri)
  console.log(`mongo connected: ${uri.replace(/\/\/.*@/, '//')}`)
}
