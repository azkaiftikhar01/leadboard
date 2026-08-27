import mongoose from 'mongoose'

const noteSchema = new mongoose.Schema(
  {
    body: { type: String, required: true },
    summary: String,
    source: { type: String, enum: ['voice', 'typed'], default: 'typed' },
    refType: { type: String, enum: ['project', 'user', 'task', 'none'], default: 'none' },
    refId: { type: mongoose.Schema.Types.ObjectId },
    tags: [String],
    capture: { type: mongoose.Schema.Types.ObjectId, ref: 'Capture' },
    pinned: { type: Boolean, default: false },
  },
  { timestamps: true }
)

noteSchema.index({ body: 'text', summary: 'text', tags: 'text' })

export default mongoose.model('Note', noteSchema)
