import mongoose from 'mongoose'

/**
 * Written by the mandatory one-tap reason on reopen. This is the entire data
 * collection mechanism for the performance registry - there is no review form.
 *
 * Polarity is deliberate: rework caused by the client is not a mark against the
 * dev who absorbed it, and an unclear brief is charged to the lead. A registry
 * that only ever counts against people gets gamed, then ignored.
 */
export const REWORK_REASONS = {
  not_fixed: { label: "Wasn't actually fixed", attributedTo: 'dev', points: -2 },
  regression: { label: 'Broke something else', attributedTo: 'dev', points: -2 },
  missed_requirement: { label: 'Missed a stated requirement', attributedTo: 'dev', points: -1 },
  client_change: { label: 'Client changed their mind', attributedTo: 'client', points: 0.5 },
  scope_added: { label: 'Scope added after sign-off', attributedTo: 'client', points: 1 },
  unclear_brief: { label: 'My brief was unclear', attributedTo: 'lead', points: -1 },
  wrong_spec: { label: 'Spec or design was wrong', attributedTo: 'spec_owner', points: -1 },
}

const reworkEventSchema = new mongoose.Schema(
  {
    task: { type: mongoose.Schema.Types.ObjectId, ref: 'Task', required: true, index: true },
    project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', index: true },
    // who the rework lands on, which is not always the task's assignee
    subject: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    reason: { type: String, enum: Object.keys(REWORK_REASONS), required: true },
    attributedTo: { type: String, enum: ['dev', 'client', 'lead', 'spec_owner'], required: true },
    points: { type: Number, required: true },
    note: String,
    occurredAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true }
)

export default mongoose.model('ReworkEvent', reworkEventSchema)
