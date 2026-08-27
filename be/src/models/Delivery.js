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
    this.varianceDays = Math.round((this.actualDate - this.promisedDate) / 86_400_000)
  }
  next()
})

export default mongoose.model('Delivery', deliverySchema)
