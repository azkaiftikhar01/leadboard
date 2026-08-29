import mongoose from 'mongoose'

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    // aliases let the capture parser resolve "asad", "Asad K", "@asad" to one person
    aliases: [{ type: String, lowercase: true, trim: true }],
    role: { type: String, enum: ['lead', 'dev', 'manager'], default: 'dev' },
    avatarColor: { type: String, default: '#6b7cff' },
    title: { type: String, default: '', trim: true },
    weeklyCapacityHours: { type: Number, default: 40 },
    // 100 = a full week available. Drop it for part-timers or anyone the lead
    // knows is half-gone to something else.
    capacityPercent: { type: Number, default: 100, min: 0, max: 200 },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
)

userSchema.index({ aliases: 1 })

export default mongoose.model('User', userSchema)
