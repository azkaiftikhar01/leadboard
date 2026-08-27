import mongoose from 'mongoose'

const standupSessionSchema = new mongoose.Schema(
  {
    date: { type: String, required: true, unique: true }, // YYYY-MM-DD, local
    projectsCovered: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Project' }],
    captures: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Capture' }],
    digest: {
      askFrom: [{ who: String, item: String, project: String }],
      iOwe: [{ who: String, item: String, project: String }],
      atRisk: [{ what: String, project: String, dueDate: Date, why: String }],
      text: String,
    },
    durationSec: Number,
    completed: { type: Boolean, default: false },
    completedAt: Date,
  },
  { timestamps: true }
)

export default mongoose.model('StandupSession', standupSessionSchema)
