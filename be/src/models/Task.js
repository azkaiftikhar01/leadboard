import mongoose from 'mongoose'

export const TASK_STATES = ['assigned', 'in_progress', 'submitted', 'in_review', 'done', 'dropped']

const transitionSchema = new mongoose.Schema(
  {
    from: String,
    to: String,
    at: { type: Date, default: Date.now },
    by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    note: String,
  },
  { _id: false }
)

const taskSchema = new mongoose.Schema(
  {
    project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    assignee: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    title: { type: String, required: true, trim: true },
    detail: { type: String, default: '' },
    state: { type: String, enum: TASK_STATES, default: 'assigned', index: true },
    priority: { type: String, enum: ['low', 'normal', 'high', 'urgent'], default: 'normal' },
    estimateHours: Number,
    dueDate: Date,
    assignedAt: { type: Date, default: Date.now },
    startedAt: Date,
    doneAt: Date,
    reopenCount: { type: Number, default: 0 },
    // everything the registry reports is replayable from this
    history: [transitionSchema],
    createdFromCapture: { type: mongoose.Schema.Types.ObjectId, ref: 'Capture' },
  },
  { timestamps: true }
)

// days-on-task drives the staleness nudge; cheap enough to derive on read
taskSchema.virtual('daysOnTask').get(function () {
  if (['done', 'dropped'].includes(this.state)) return null
  const from = this.startedAt || this.assignedAt || this.createdAt
  return Math.floor((Date.now() - from.getTime()) / 86_400_000)
})

taskSchema.set('toJSON', { virtuals: true })
taskSchema.set('toObject', { virtuals: true })

export default mongoose.model('Task', taskSchema)
