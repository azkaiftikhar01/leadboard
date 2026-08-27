import mongoose from 'mongoose'

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    // aliases let the capture parser resolve "asad", "Asad K", "@asad" to one person
    aliases: [{ type: String, lowercase: true, trim: true }],
    role: { type: String, enum: ['lead', 'dev'], default: 'dev' },
    avatarColor: { type: String, default: '#6b7cff' },
    weeklyCapacityHours: { type: Number, default: 40 },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
)

userSchema.index({ aliases: 1 })

export default mongoose.model('User', userSchema)
