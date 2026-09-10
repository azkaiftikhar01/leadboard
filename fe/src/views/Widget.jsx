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
      {onMe.length === 0 && assigned.length === 0 ? (
        <div className="widget-empty">
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

/* ---------------- focus ---------------- */

function FocusWidget() {
  // Focus is already a full-screen surface; inside a widget it simply fills it
  return <Focus open embedded onClose={() => shell()?.closeWidget()} />
}

/* ---------------- notes ---------------- */

function NotesWidget() {
  return <Notes open embedded onClose={() => shell()?.closeWidget()} />
}
