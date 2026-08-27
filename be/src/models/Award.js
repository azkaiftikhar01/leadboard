import mongoose from 'mongoose'

/**
 * The manual half of the record: what the lead saw with his own eyes.
 *
 * The automatic half (rework attribution, on-time deliveries) already exists.
 * This is for everything a state machine cannot see - somebody covering for a
 * teammate, a genuinely good call, or work that came back that they had the
 * time and the information to get right the first time.
 *
 * Kept deliberately coarse. A five-point scale invites deliberation; a short
 * list of named moments takes one tap and still says something true.
 */
export const AWARDS = {
  // --- praise ---
  clean_run:     { label: 'Clean run',        blurb: 'Landed it with no rework',        points: 2,  tone: 'praise', icon: 'spark' },
  shipped_early: { label: 'Shipped early',    blurb: 'In before the date',              points: 2,  tone: 'praise', icon: 'clock' },
  saved_it:      { label: 'Saved it',         blurb: 'Pulled something out of the fire', points: 3, tone: 'praise', icon: 'flame' },
  ate_the_churn: { label: 'Ate the churn',    blurb: 'Absorbed client changes without fuss', points: 2, tone: 'praise', icon: 'undo' },
  unblocked:     { label: 'Unblocked someone', blurb: 'Cleared a teammate’s path',      points: 1,  tone: 'praise', icon: 'team' },
  good_call:     { label: 'Good call',        blurb: 'Caught something before it bit',   points: 1,  tone: 'praise', icon: 'check' },

  // --- dings ---
  avoidable:     { label: 'Avoidable rework', blurb: 'Had the time and the brief to get it right', points: -2, tone: 'ding', icon: 'undo' },
  missed_date:   { label: 'Missed the date',  blurb: 'Late, without a heads-up',        points: -2, tone: 'ding', icon: 'clock' },
  went_dark:     { label: 'Went dark',        blurb: 'No update, had to chase',         points: -1, tone: 'ding', icon: 'warn' },
  careless:      { label: 'Careless',         blurb: 'Shipped without checking it',     points: -2, tone: 'ding', icon: 'warn' },
}

const awardSchema = new mongoose.Schema(
  {
    subject: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    kind: { type: String, enum: Object.keys(AWARDS), required: true },
    tone: { type: String, enum: ['praise', 'ding'], required: true },
    points: { type: Number, required: true },
    note: { type: String, default: '' },
    project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project' },
    task: { type: mongoose.Schema.Types.ObjectId, ref: 'Task' },
    givenBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    givenAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true }
)

export default mongoose.model('Award', awardSchema)
