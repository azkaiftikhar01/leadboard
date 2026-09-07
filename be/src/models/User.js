import mongoose from 'mongoose'

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    // aliases let the capture parser resolve "asad", "Asad K", "@asad" to one person
    aliases: [{ type: String, lowercase: true, trim: true }],
    /**
     * lead    — runs the org, sees every board
     * second  — second in command: runs their own board, below the lead
     * manager / dev — no board of their own
     */
    role: { type: String, enum: ['lead', 'second', 'manager', 'dev'], default: 'dev' },
    /** whether they have a board of their own to sign in to */
    hasBoard: { type: Boolean, default: false },
    /** their own sign-in code, hashed. Never returned by any endpoint. */
    passSalt: { type: String, select: false },
    passHash: { type: String, select: false },
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
