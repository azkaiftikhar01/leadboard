import mongoose from 'mongoose'

export const TASK_STATES = ['assigned', 'in_progress', 'submitted', 'in_review', 'done', 'dropped']

/**
 * Three tracks, because his morning page has always had three columns: what the
 * team owes, what the client owes, and what he owes. Keeping them as one task
 * list with a track - rather than separate concepts - means one place to look
 * and one thing to tick.
 */
export const TASK_TRACKS = {
  team: { label: 'Team', hint: 'assigned to a dev' },
  client: { label: 'Client', hint: 'pending from the client' },
  lead: { label: 'On me', hint: 'needs my intervention' },
}

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
    track: { type: String, enum: Object.keys(TASK_TRACKS), default: 'team', index: true },
    state: { type: String, enum: TASK_STATES, default: 'assigned', index: true },
    // who or what we are waiting on, when it is not a dev on the team
    waitingOnLabel: { type: String, default: '' },
    priority: { type: String, enum: ['low', 'normal', 'high', 'urgent'], default: 'normal' },
    estimateHours: Number,
    dueDate: Date,
    /** whether the due date names a moment or just a day. A task due "Friday"
     *  is not late at 00:01 on Friday; one due at 15:00 is late at 15:01. */
    dueHasTime: { type: Boolean, default: false },
    /** set once we have told him it is due, so a reload does not re-alarm */
    dueNotifiedAt: Date,
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
