import mongoose from 'mongoose'

/**
 * Everything a project needs that is not a task: the staging URL, the Figma
 * board, the shared login nobody can ever find when they need it.
 *
 * Secrets are stored sealed and are never included in a list response - they
 * come back only when explicitly asked for, one at a time, so a stray screenshot
 * of this page does not hand over the credentials.
 */
export const RESOURCE_KINDS = {
  link: { label: 'Link', icon: 'arrow' },
  board: { label: 'Board', icon: 'projects' },
  repo: { label: 'Repo', icon: 'projects' },
  design: { label: 'Design', icon: 'spark' },
  credential: { label: 'Credential', icon: 'gear' },
  note: { label: 'Note', icon: 'note' },
}

const resourceSchema = new mongoose.Schema(
  {
    project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    kind: { type: String, enum: Object.keys(RESOURCE_KINDS), default: 'link' },
    label: { type: String, required: true, trim: true },
    url: { type: String, default: '' },
    username: { type: String, default: '' },
    /** AES-256-GCM, never returned by the list endpoint */
    secret: { type: String, default: '' },
    notes: { type: String, default: '' },
    addedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    lastRevealedAt: Date,
  },
  { timestamps: true }
)

export default mongoose.model('Resource', resourceSchema)
