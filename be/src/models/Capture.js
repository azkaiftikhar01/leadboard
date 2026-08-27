import mongoose from 'mongoose'

/**
 * One press of the mic. The raw transcript is kept forever so a bad parse is
 * always recoverable, and so switching STT provider later never costs history.
 */
const parsedItemSchema = new mongoose.Schema(
  {
    kind: { type: String, enum: ['task', 'blocker', 'owed', 'note', 'status', 'deadline'] },
    payload: mongoose.Schema.Types.Mixed,
    confidence: Number,
    // unresolved items land in Inbox rather than being guessed at
    unresolved: [String],
    status: { type: String, enum: ['pending', 'applied', 'discarded'], default: 'pending' },
    appliedRef: { type: mongoose.Schema.Types.ObjectId },
  },
  { _id: true }
)

const captureSchema = new mongoose.Schema(
  {
    audioBytes: Number,
    durationSec: Number,
    transcript: { type: String, default: '' },
    sttProvider: String,
    parser: String,
    parsed: [parsedItemSchema],
    status: {
      type: String,
      enum: ['recording', 'transcribing', 'parsing', 'pending', 'applied', 'partial', 'discarded', 'failed'],
      default: 'recording',
      index: true,
    },
    error: String,
    source: { type: String, enum: ['hotkey', 'popover', 'standup', 'window', 'typed'], default: 'popover' },
    standupSession: { type: mongoose.Schema.Types.ObjectId, ref: 'StandupSession' },
    project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project' },
  },
  { timestamps: true }
)

export default mongoose.model('Capture', captureSchema)
