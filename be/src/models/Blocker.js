import mongoose from 'mongoose'

const blockerSchema = new mongoose.Schema(
  {
    task: { type: mongoose.Schema.Types.ObjectId, ref: 'Task', index: true },
    project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', index: true },
    // waiting_on_me is the most valuable lane in the product: a lead's unblock
    // latency gates the whole team, and it is the thing leads forget
    type: {
      type: String,
      enum: ['waiting_on_dev', 'waiting_on_client', 'waiting_on_me'],
      required: true,
      index: true,
    },
    waitingOn: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    waitingOnLabel: String,
    item: { type: String, required: true },
    raisedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    openedAt: { type: Date, default: Date.now, index: true },
    clearedAt: Date,
  },
  { timestamps: true }
)

blockerSchema.virtual('ageHours').get(function () {
  return Math.floor(((this.clearedAt || Date.now()) - this.openedAt) / 3_600_000)
})

blockerSchema.set('toJSON', { virtuals: true })

export default mongoose.model('Blocker', blockerSchema)
