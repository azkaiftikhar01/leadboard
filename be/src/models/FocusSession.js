import mongoose from 'mongoose'

/**
 * A block of protected time.
 *
 * Recorded rather than just counted down, because "I did four focus blocks this
 * week" is the kind of evidence that keeps a habit alive - and an abandoned
 * block is worth knowing about too, so `completed` is false when he stops early
 * rather than the row simply not existing.
 */
const focusSessionSchema = new mongoose.Schema(
  {
    minutes: { type: Number, required: true },
    label: { type: String, default: '' },
    task: { type: mongoose.Schema.Types.ObjectId, ref: 'Task' },
    project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project' },
    startedAt: { type: Date, default: Date.now },
    endedAt: Date,
    completed: { type: Boolean, default: false },
    /** how much of it he actually sat through, in seconds */
    elapsedSec: Number,
  },
  { timestamps: true }
)

focusSessionSchema.index({ startedAt: -1 })

export default mongoose.model('FocusSession', focusSessionSchema)
