import crypto from 'node:crypto'

/**
 * Authenticated encryption for stored secrets.
 *
 * AES-256-GCM, so a tampered ciphertext fails to decrypt rather than returning
 * plausible rubbish. Each secret gets its own random IV; the auth tag is stored
 * alongside it.
 *
 * What this protects against, honestly: a leaked database, a stolen backup, an
 * Atlas snapshot in the wrong hands. What it does NOT protect against: anyone
 * who has the board's passphrase, because the whole point is that they can read
 * these. It is encryption at rest, not a vault with its own lock.
 *
 * The key comes from RESOURCE_KEY, falling back to AUTH_SECRET. If neither is
 * set we refuse to store a secret rather than quietly writing it in plaintext -
 * a credential store that silently is not one is worse than no credential store.
 */
const rawKey = () => process.env.RESOURCE_KEY || process.env.AUTH_SECRET || ''

export const canEncrypt = () => rawKey().length >= 16

/** Stretch whatever they set into a real 32-byte key. */
const key = () => crypto.scryptSync(rawKey(), 'leadboard.resources.v1', 32)

export function seal(plain) {
  if (!canEncrypt()) {
    throw new Error(
      'RESOURCE_KEY is not set (or is too short) — refusing to store a credential unencrypted'
    )
  }
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', key(), iv)
  const body = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `v1.${iv.toString('base64url')}.${tag.toString('base64url')}.${body.toString('base64url')}`
}

export function open(packed) {
  if (!packed) return null
  const [v, ivB, tagB, bodyB] = String(packed).split('.')
  if (v !== 'v1' || !ivB || !tagB || !bodyB) throw new Error('stored secret is malformed')
  const decipher = crypto.createDecipheriv('aes-256-gcm', key(), Buffer.from(ivB, 'base64url'))
  decipher.setAuthTag(Buffer.from(tagB, 'base64url'))
  return Buffer.concat([decipher.update(Buffer.from(bodyB, 'base64url')), decipher.final()]).toString('utf8')
}
