import mongoose from 'mongoose'

const projectSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    aliases: [{ type: String, lowercase: true, trim: true }],
    client: { type: String, trim: true },
    status: { type: String, enum: ['active', 'paused', 'shipped', 'archived'], default: 'active' },
    // health is set by the lead, not computed - it is his gut read, and the
    // registry is there to tell him when his gut and the data disagree
    health: { type: String, enum: ['green', 'amber', 'red'], default: 'green' },
    startDate: Date,
    targetDate: Date,
    color: { type: String, default: '#6b7cff' },
    leadNotes: { type: String, default: '' },
  },
  { timestamps: true }
)

projectSchema.index({ aliases: 1 })

export default mongoose.model('Project', projectSchema)
