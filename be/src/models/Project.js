import mongoose from 'mongoose'

/**
 * A project's mode decides how much of a dev's week it actually eats.
 * Someone parked on a support project is not spent - they still have room for
 * real delivery work, and the load view has to show that or the lead will
 * over-protect people who are barely loaded.
 */
export const PROJECT_MODES = {
  development: { label: 'Development', weight: 1, color: '#6b7cff' },
  support: { label: 'Support', weight: 0.45, color: '#4cc38a' },
  maintenance: { label: 'Maintenance', weight: 0.25, color: '#8d93ad' },
}

const memberSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    // what share of their week the lead intends this project to take, before
    // the mode weight is applied
    allocation: { type: Number, default: 100, min: 0, max: 100 },
    role: { type: String, default: '' },
    // who runs this project day to day. More than one is allowed, because
    // co-leads happen and pretending otherwise just means it goes unrecorded.
    isManager: { type: Boolean, default: false },
  },
  { _id: false }
)

const projectSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    aliases: [{ type: String, lowercase: true, trim: true }],
    client: { type: String, trim: true },
    mode: { type: String, enum: Object.keys(PROJECT_MODES), default: 'development' },
    status: { type: String, enum: ['active', 'paused', 'shipped', 'archived'], default: 'active' },
    health: { type: String, enum: ['green', 'amber', 'red'], default: 'green' },
    members: [memberSchema],
    startDate: Date,
    targetDate: Date,
    color: { type: String, default: '#6b7cff' },
    leadNotes: { type: String, default: '' },
  },
  { timestamps: true }
)

projectSchema.index({ aliases: 1 })

projectSchema.virtual('modeMeta').get(function () {
  return PROJECT_MODES[this.mode] || PROJECT_MODES.development
})

projectSchema.set('toJSON', { virtuals: true })
projectSchema.set('toObject', { virtuals: true })

export default mongoose.model('Project', projectSchema)
