import { useEffect, useState } from 'react'
import { api } from '../lib/api.js'
import { Modal, Field, Icon, Tag } from './ui.jsx'
import { useConfirm } from './Confirm.jsx'

const KIND_TONE = { credential: 'amber', board: 'violet', repo: '', design: 'blue', note: '', link: '' }

const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, '') } catch { return u } }

/**
 * Everything a project needs that is not a task.
 *
 * Secrets are never in the list payload — the row only knows that one exists.
 * Revealing fetches it on its own, one at a time, so a screenshot of this panel
 * hands over nothing, and it re-hides itself rather than sitting on screen.
 */
export function Resources({ project, onClose }) {
  const confirm = useConfirm()
  const [rows, setRows] = useState(null)
  const [meta, setMeta] = useState({ kinds: [], canStoreSecrets: true })
  const [adding, setAdding] = useState(false)
  const [shown, setShown] = useState({})
  const [copied, setCopied] = useState(null)

  const load = () => api.resources(project._id).then(setRows).catch(() => setRows([]))
  useEffect(() => { load(); api.resourceKinds().then(setMeta).catch(() => {}) }, [project._id])

  const reveal = async (r) => {
    if (shown[r._id]) return setShown((s) => ({ ...s, [r._id]: null }))
    try {
      const { secret } = await api.revealResource(r._id)
      setShown((s) => ({ ...s, [r._id]: secret }))
      // put it away again rather than leaving it on screen
      setTimeout(() => setShown((s) => ({ ...s, [r._id]: null })), 30_000)
    } catch (e) {
      setShown((s) => ({ ...s, [r._id]: `⚠ ${e.message}` }))
    }
  }

  const copy = async (r) => {
    const { secret } = await api.revealResource(r._id)
    await navigator.clipboard.writeText(secret ?? '')
    setCopied(r._id)
    setTimeout(() => setCopied(null), 1600)
  }

  const remove = async (r) => {
    const ok = await confirm({
      title: `Delete “${r.label}”?`,
      body: r.hasSecret ? 'The stored credential goes with it and cannot be recovered.' : undefined,
      danger: 'Delete',
      onConfirm: () => api.deleteResource(r._id),
    })
    if (ok) load()
  }

  return (
    <Modal
      title={`${project.name} — resources`}
      sub="Links, boards and logins that belong to this project."
      onClose={onClose}
      wide
      foot={
        <>
          <button className="btn primary" onClick={() => setAdding(true)}>
            <Icon.plus size={14} /> Add
          </button>
          <button className="btn" onClick={onClose}>Close</button>
        </>
      }
    >
      {!meta.canStoreSecrets && (
        <div className="note-interim" style={{ margin: 0 }}>
          <b>RESOURCE_KEY isn’t set.</b> Links and notes save fine, but credentials are
          refused rather than written in plaintext. Add it in your deployment settings.
        </div>
      )}

      {rows === null ? (
        <div className="empty"><span className="spinner" /></div>
      ) : rows.length === 0 ? (
        <div className="empty" style={{ padding: '26px 12px' }}>
          Nothing here yet — the staging URL, the Figma board, the shared login.
        </div>
      ) : (
        <div className="res-list">
          {rows.map((r) => (
            <div className="res" key={r._id}>
              <div className="res-main">
                <div className="res-top">
                  <b>{r.label}</b>
                  <Tag tone={KIND_TONE[r.kind]}>{meta.kinds.find((k) => k.key === r.kind)?.label || r.kind}</Tag>
                </div>

                {r.url && (
                  <a className="res-url" href={r.url} target="_blank" rel="noreferrer noopener">
                    {host(r.url)} <Icon.arrow size={12} />
                  </a>
                )}
                {r.username && <div className="res-user">{r.username}</div>}
                {r.notes && <div className="res-notes">{r.notes}</div>}

                {r.hasSecret && (
                  <div className="res-secret">
                    <code>{shown[r._id] ?? '••••••••••••'}</code>
                    <button className="btn ghost sm" onClick={() => reveal(r)}>
                      {shown[r._id] ? 'Hide' : 'Reveal'}
                    </button>
                    <button className="btn ghost sm" onClick={() => copy(r)}>
                      {copied === r._id ? <><Icon.check size={13} /> Copied</> : 'Copy'}
                    </button>
                  </div>
                )}
              </div>

              <button className="row-del" style={{ opacity: 1 }} onClick={() => remove(r)}>
                <Icon.trash size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      {adding && (
        <AddResource
          project={project} meta={meta}
          onClose={() => setAdding(false)}
          onSaved={() => { setAdding(false); load() }}
        />
      )}
    </Modal>
  )
}

function AddResource({ project, meta, onClose, onSaved }) {
  const [kind, setKind] = useState('link')
  const [label, setLabel] = useState('')
  const [url, setUrl] = useState('')
  const [username, setUsername] = useState('')
  const [secret, setSecret] = useState('')
  const [notes, setNotes] = useState('')
  const [err, setErr] = useState(null)
  const [busy, setBusy] = useState(false)

  const isCred = kind === 'credential'

  const save = async () => {
    if (!label.trim()) return
    setBusy(true); setErr(null)
    try {
      await api.addResource({ project: project._id, kind, label, url, username, secret, notes })
      onSaved()
    } catch (e) { setErr(e.message) } finally { setBusy(false) }
  }

  return (
    <Modal
      title="Add a resource"
      sub={isCred ? 'The password is encrypted before it is stored.' : 'A link, a board, or a note.'}
      onClose={onClose}
      foot={
        <>
          <button className="btn ghost" onClick={onClose}>Cancel</button>
          <button className="btn primary" disabled={!label.trim() || busy} onClick={save}>
            {busy ? <span className="spinner" /> : 'Save'}
          </button>
        </>
      }
    >
      {err && <div className="err">{err}</div>}

      <div className="field">
        <label>What is it</label>
        <div className="res-kinds">
          {meta.kinds.map((k) => (
            <button key={k.key} className={kind === k.key ? 'on' : ''} onClick={() => setKind(k.key)}>
              {k.label}
            </button>
          ))}
        </div>
      </div>

      <Field label="Name it">
        <input type="text" autoFocus value={label} placeholder={isCred ? 'Staging admin login' : 'Figma board'}
          onChange={(e) => setLabel(e.target.value)} />
      </Field>

      {kind !== 'note' && (
        <Field label="URL">
          <input type="text" value={url} placeholder="https://…" onChange={(e) => setUrl(e.target.value)} />
        </Field>
      )}

      {isCred && (
        <>
          <Field label="Username">
            <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} />
          </Field>
          <Field label="Password or key">
            <input type="password" value={secret} placeholder="Encrypted before it is saved"
              disabled={!meta.canStoreSecrets}
              onChange={(e) => setSecret(e.target.value)} />
            {!meta.canStoreSecrets && (
              <div className="dim" style={{ fontSize: 11.5 }}>
                Needs RESOURCE_KEY set on the server.
              </div>
            )}
          </Field>
        </>
      )}

      <Field label="Notes">
        <textarea rows={2} value={notes} placeholder="Anything worth remembering"
          onChange={(e) => setNotes(e.target.value)} />
      </Field>
    </Modal>
  )
}
