import mongoose from 'mongoose'

/**
 * A one-row store for things that must outlive a deploy.
 *
 * The passphrase started as an environment variable, which meant changing it
 * required a redeploy - so it lives here instead, hashed. The env var stays as
 * the bootstrap: it is what gets you in before a passphrase has ever been set.
 */
const settingSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true },
    value: mongoose.Schema.Types.Mixed,
  },
  { timestamps: true }
)

export default mongoose.model('Setting', settingSchema)
