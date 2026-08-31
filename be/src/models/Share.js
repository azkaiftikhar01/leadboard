import mongoose from 'mongoose'
import crypto from 'node:crypto'

/**
 * A public, unguessable link to somebody's task list.
 *
 * The point is that a dev should not need an account to see what he owes. The
 * token is the only credential, so it is 24 random bytes and it is revocable -
 * and the board it opens is deliberately narrow: one person's open tasks, with
 * nothing about anyone else's scores, load, or rework on it.
 */
const shareSchema = new mongoose.Schema(
  {
    token: { type: String, unique: true, index: true, default: () => crypto.randomBytes(18).toString('base64url') },
    kind: { type: String, enum: ['person', 'project', 'mine'], required: true },
    /** absent for a 'mine' share, which has no subject other than the owner */
    refId: { type: mongoose.Schema.Types.ObjectId },
    label: { type: String, default: '' },
    /** whether whoever holds the link may tick things off */
    canComplete: { type: Boolean, default: true },
    revoked: { type: Boolean, default: false },
    expiresAt: Date,
    views: { type: Number, default: 0 },
    lastViewedAt: Date,
  },
  { timestamps: true }
)

export default mongoose.model('Share', shareSchema)
