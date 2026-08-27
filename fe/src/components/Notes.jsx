import { useEffect, useRef, useState } from 'react'
import { api } from '../lib/api.js'
import { Icon } from './ui.jsx'
import { useSpeech, speechAvailable } from '../lib/useSpeech.js'
import { useConfirm } from './Confirm.jsx'

const title = (body) => (body || '').split('\n')[0].trim() || 'Untitled'
const preview = (body) => (body || '').split('\n').slice(1).join(' ').trim()
const when = (d) => {
  const day = new Date(d)
  const today = new Date().toDateString() === day.toDateString()
  return today
    ? day.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    : day.toLocaleDateString([], { day: 'numeric', month: 'short' })
}

/**
 * Notes, collapsed by default.
 *
 * The board is for work with an owner and a date. This is for everything else —
 * the half-thought he would otherwise put on paper and lose. It stays shut until
 * he opens it so it never competes with the day's actual state, and it takes
 * dictation because most of these arrive mid-sentence.
 */
export function Notes({ open, onClose }) {
  const confirm = useConfirm()
  const [notes, setNotes] = useState([])
  const [editing, setEditing] = useState(null)   // note object or 'new'
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const speech = useSpeech()
  const [listening, setListening] = useState(false)
  const box = useRef(null)

  const load = () => api.notes('?limit=60').then(setNotes).catch(() => {})
  useEffect(() => { if (open) load() }, [open])
  useEffect(() => { if (editing) box.current?.focus() }, [editing])
  useEffect(() => {
    if (!open) return
    const k = (e) => { if (e.key === 'Escape' && !editing) onClose() }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [open, editing, onClose])

  const start = (note) => {
    setEditing(note || 'new')
    setDraft(note?.body || '')
  }

  const save = async () => {
    const body = draft.trim()
    if (!body) return close()
    setSaving(true)
    try {
      if (editing === 'new') await api.addNote({ body, source: listening ? 'voice' : 'typed' })
      else await api.patchNote(editing._id, { body })
      await load()
      close()
    } finally { setSaving(false) }
  }

  const close = () => { setEditing(null); setDraft(''); setListening(false) }

  const dictate = async () => {
    if (!listening) {
      try { speech.start(); setListening(true) } catch { /* no recogniser here */ }
      return
    }
    setListening(false)
    const out = await speech.stop()
    if (out?.text) setDraft((d) => (d ? `${d} ${out.text}` : out.text))
  }

  const remove = async (note) => {
    const ok = await confirm({
      title: 'Delete this note?',
      body: `“${title(note.body).slice(0, 60)}”`,
      danger: 'Delete',
      onConfirm: () => api.deleteNote(note._id),
    })
    if (ok) { load(); close() }
  }

  const pin = async (note) => {
    await api.patchNote(note._id, { pinned: !note.pinned })
    load()
  }

  if (!open) return null

  return (
    <>
      <div className="notes-scrim" onClick={onClose} />
      <aside className="notes-drawer">
        <header className="notes-bar">
          <span className="notes-ico"><Icon.note size={16} /></span>
          <b>Notes</b>
          {notes.length > 0 && <span className="notes-n">{notes.length}</span>}
          <span className="grow" />
          <button className="btn primary sm" onClick={() => start(null)}>
            <Icon.plus size={13} /> New
          </button>
          <button className="sheet-x" onClick={onClose} title="Close — Esc"><Icon.x size={16} /></button>
        </header>

        <div className="notes-body">
          {editing ? (
            <div className="note-editor">
              <textarea
                ref={box} value={draft} rows={7}
                placeholder={'First line becomes the title\n\nThen whatever else you need.'}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') close()
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) save()
                }}
              />
              {listening && speech.interim && <div className="note-interim">{speech.interim}</div>}
              <div className="note-acts">
                {speechAvailable && (
                  <button className={`btn sm${listening ? ' warm' : ''}`} onClick={dictate}>
                    {listening ? <><Icon.stop size={13} /> Stop</> : <><Icon.mic size={14} /> Dictate</>}
                  </button>
                )}
                {editing !== 'new' && (
                  <button className="btn sm danger" onClick={() => remove(editing)}>
                    <Icon.trash size={13} />
                  </button>
                )}
                <span className="grow" />
                <button className="btn sm" onClick={close}>Cancel</button>
                <button className="btn primary sm" disabled={!draft.trim() || saving} onClick={save}>
                  {saving ? <span className="spinner" /> : 'Save'}
                </button>
              </div>
            </div>
          ) : notes.length === 0 ? (
            <button className="note-empty" onClick={() => start(null)}>
              <Icon.plus size={18} />
              Nothing yet — write or dictate the first one.
            </button>
          ) : (
            <div className="note-grid">
              {notes.map((n) => (
                <article key={n._id} className={`note${n.pinned ? ' pinned' : ''}`} onClick={() => start(n)}>
                  <button
                    className="note-pin" title={n.pinned ? 'Unpin' : 'Pin'}
                    onClick={(e) => { e.stopPropagation(); pin(n) }}
                  >
                    <Icon.spark size={13} />
                  </button>
                  <b>{title(n.body)}</b>
                  <p>{preview(n.body) || 'No extra text'}</p>
                  <time>{when(n.updatedAt || n.createdAt)}{n.source === 'voice' ? ' · dictated' : ''}</time>
                </article>
              ))}
            </div>
          )}
        </div>
      </aside>
    </>
  )
}
