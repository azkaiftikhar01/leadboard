import mongoose from 'mongoose'

const deliverySchema = new mongoose.Schema(
  {
    task: { type: mongoose.Schema.Types.ObjectId, ref: 'Task', index: true },
    project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', index: true },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    title: String,
    promisedDate: Date,
    actualDate: Date,
    varianceDays: Number,
    accepted: { type: Boolean, default: true },
  },
  { timestamps: true }
)

deliverySchema.pre('save', function (next) {
  if (this.promisedDate && this.actualDate) {
    // a promised date is a day: delivering at any point during it is on time,
    // so measure from the end of that day rather than from its midnight
    const due = new Date(this.promisedDate)
    due.setHours(23, 59, 59, 999)
    this.varianceDays = Math.ceil((this.actualDate - due) / 86_400_000)
  }
  next()
})

export default mongoose.model('Delivery', deliverySchema)
