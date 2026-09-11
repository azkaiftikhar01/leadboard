import { useCallback, useEffect, useState } from 'react'
import { api } from '../lib/api.js'
import { Avatar, Tag, Icon, Spinner, dueLabel } from '../components/ui.jsx'
import { Focus } from '../components/Focus.jsx'
import { Notes } from '../components/Notes.jsx'
import { EditTask, colorOf } from '../components/EditTask.jsx'

const shell = () => (typeof window !== 'undefined' ? window.leadboard : null)

/**
 * A widget is one feature, small enough to leave open beside real work.
 *
 * Everything here assumes it is sitting on top of something else the reader
 * actually cares about: no navigation, no chrome beyond a title bar to drag by,
 * and only the rows that would make him do something.
 */
export function Widget({ kind }) {
  const [pinned, setPinned] = useState(true)

  const togglePin = () => {
    const next = !pinned
    setPinned(next)
    shell()?.pinWidget(next)
  }

  const Body = { tasks: TaskWidget, focus: FocusWidget, notes: NotesWidget }[kind] || TaskWidget
  const title = { tasks: 'On me', focus: 'Focus', notes: 'Notes' }[kind] || 'LeadBoard'

  return (
    <div className="widget">
      <header className="widget-bar drag">
        <span className="widget-dot" />
        <b>{title}</b>
        <span className="grow" />
        <button
          className={`widget-btn no-drag${pinned ? ' on' : ''}`}
          title={pinned ? 'Stays on top — click to let it fall behind' : 'Keep on top'}
          onClick={togglePin}
        >
          <Icon.spark size={13} />
        </button>
        <button className="widget-btn no-drag" title="Open the full board"
          onClick={() => shell()?.openMain('#/')}>
          <Icon.arrow size={13} />
        </button>
        <button className="widget-btn no-drag close" title="Close" onClick={() => shell()?.closeWidget()}>
          <Icon.x size={14} />
        </button>
      </header>

      <div className="widget-body"><Body /></div>
    </div>
  )
}

/* ---------------- tasks ---------------- */

function TaskWidget() {
  const [data, setData] = useState(null)
  const [err, setErr] = useState(null)
  const [editing, setEditing] = useState(null)

  const load = useCallback(() => {
    api.today().then(setData).catch((e) => setErr(e.unauthorized ? 'auth' : e.message))
  }, [])

  useEffect(() => {
    load()
    const t = setInterval(load, 30_000)
    return () => clearInterval(t)
  }, [load])

  const tick = async (task) => {
    setData((d) => ({ ...d, tracks: { ...d.tracks, lead: d.tracks.lead.filter((t) => t._id !== task._id) } }))
    await api.toggleTask(task._id).catch(() => {})
    load()
  }

  if (err === 'auth') {
    return (
      <div className="widget-empty">
        <p>Not signed in.</p>
        <button className="btn primary sm" onClick={() => shell()?.openMain('#/')}>Open the board</button>
      </div>
    )
  }
  if (err) return <div className="widget-empty"><p>{err}</p></div>
  if (!data) return <Spinner />

  // Only this person's work. dueSoon spans the whole org, which is right for a
  // board that oversees everyone and wrong for a widget called "On me".
  const onMe = data.tracks.lead
  const assigned = (data.mine ?? []).filter((t) => t.track !== 'lead')

  return (
    <>
      <AddTask onAdded={load} />

      {onMe.length === 0 && assigned.length === 0 ? (
        <div className="widget-empty" style={{ height: 'auto', padding: '28px 20px' }}>
          <Icon.check size={22} />
          <p>Nothing waiting on you.</p>
        </div>
      ) : (
        <>
          {onMe.map((t) => <Row key={t._id} t={t} onTick={tick} onEdit={setEditing} />)}

          {assigned.length > 0 && (
            <>
              <div className="widget-head">Assigned to me</div>
              {assigned.map((t) => <Row key={t._id} t={t} onTick={tick} onEdit={setEditing} />)}
            </>
          )}
        </>
      )}

      {editing && (
        <EditTask task={editing} compact onClose={() => setEditing(null)} onSaved={load} />
      )}
    </>
  )
}

/** One row, tickable and editable — a list you cannot correct is a list you
 *  stop trusting the moment something in it is wrong. */
function Row({ t, onTick, onEdit }) {
  const d = dueLabel(t.dueDate, t.dueHasTime)
  const hex = colorOf(t.color)
  return (
    <div
      className="widget-row" data-color={t.color || undefined}
      style={hex ? { '--task-color': hex } : undefined}
    >
      <button className="tick" onClick={() => onTick(t)}><Icon.check size={12} /></button>
      <button className="body" onClick={() => onEdit(t)} title="Edit">
        <div className="t">{t.title}</div>
        <div className="m">
          {t.assignee?.name && <span className="inline" style={{ gap: 4 }}><Avatar user={t.assignee} size={14} />{t.assignee.name}</span>}
          {t.waitingOnLabel && <span>{t.waitingOnLabel}</span>}
          {t.project?.name && <span>· {t.project.name}</span>}
          {t.priority === 'urgent' && <Tag tone="red">urgent</Tag>}
          {d && <Tag tone={d.tone}>{d.text}</Tag>}
        </div>
      </button>
    </div>
  )
}

/* ---------------- adding, without leaving the widget ---------------- */

/**
 * A task he thought of while the widget was the only LeadBoard on screen.
 * The full sheet asks who it is pending on; here the answer is always "me",
 * because that is what a widget titled "On me" is for. Everything else is
 * one keystroke away in the full board.
 */
function AddTask({ onAdded }) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [project, setProject] = useState('')
  const [due, setDue] = useState('')
  const [projects, setProjects] = useState([])
  const [me, setMe] = useState(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)

  useEffect(() => {
    if (!open) return
    api.projects().then((p) => {
      setProjects(p)
      setProject((cur) => cur || p[0]?._id || '')
    }).catch((e) => setErr(e.message))
    api.boards().then((b) => setMe(b.me ?? null)).catch(() => {})
  }, [open])

  const reset = () => { setTitle(''); setDue(''); setErr(null) }
  const close = () => { setOpen(false); reset() }

  const save = async () => {
    if (!title.trim() || !project || busy) return
    setBusy(true)
    setErr(null)
    try {
      await api.addTask({
        title: title.trim(),
        project,
        track: 'lead',
        owner: me ?? null,
        // datetime-local has no zone; Date reads it as local, which is the
        // only reading that makes "17:30" mean half five to the person typing
        dueDate: due ? new Date(due).toISOString() : undefined,
        dueHasTime: Boolean(due),
      })
      reset()
      onAdded?.()
      setOpen(false)
    } catch (e) { setErr(e.message) } finally { setBusy(false) }
  }

  if (!open) {
    return (
      <button className="widget-add-open" onClick={() => setOpen(true)}>
        <Icon.plus size={13} /> Add a task
      </button>
    )
  }

  return (
    <div className="widget-add">
      <input
        type="text" autoFocus value={title} placeholder="What needs doing?"
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') save()
          if (e.key === 'Escape') close()
        }}
      />
      <div className="widget-add-row">
        <select value={project} onChange={(e) => setProject(e.target.value)}>
          {projects.length === 0 && <option value="">No projects yet</option>}
          {projects.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
        </select>
        <input
          type="datetime-local" value={due} title="Due (optional)"
          onChange={(e) => setDue(e.target.value)}
        />
      </div>
      {err && <div className="widget-add-err">{err}</div>}
      <div className="widget-add-row">
        <button className="btn ghost sm" onClick={close}>Cancel</button>
        <button className="btn primary sm grow" disabled={!title.trim() || !project || busy} onClick={save}>
          {busy ? <span className="spinner" /> : 'Add'}
        </button>
      </div>
    </div>
  )
}

/* ---------------- focus ---------------- */

function FocusWidget() {
  // Focus is already a full-screen surface; inside a widget it simply fills it
  return <Focus open embedded onClose={() => shell()?.closeWidget()} />
}

/* ---------------- notes ---------------- */

function NotesWidget() {
  return <Notes open embedded onClose={() => shell()?.closeWidget()} />
}
