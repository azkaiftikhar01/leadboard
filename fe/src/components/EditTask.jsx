import { useEffect, useState } from 'react'
import { api } from '../lib/api.js'
import { Avatar, Modal, Field, Icon } from './ui.jsx'

/** A small, fixed palette. Free colour choice produces a board nobody can read;
 *  six distinguishable ones is enough to group by eye. */
export const TASK_COLORS = [
  { key: '', label: 'None' },
  { key: 'orange', label: 'Orange', hex: '#E57A44' },
  { key: 'rose', label: 'Rose', hex: '#C2536A' },
  { key: 'plum', label: 'Plum', hex: '#A8446F' },
  { key: 'indigo', label: 'Indigo', hex: '#4A2A8C' },
  { key: 'teal', label: 'Teal', hex: '#2E8C74' },
  { key: 'amber', label: 'Amber', hex: '#B5701F' },
]
export const colorOf = (key) => TASK_COLORS.find((c) => c.key === key)?.hex || null

const toLocal = (d) => {
  if (!d) return { date: '', time: '' }
  const x = new Date(d)
  const p = (n) => String(n).padStart(2, '0')
  return {
    date: `${x.getFullYear()}-${p(x.getMonth() + 1)}-${p(x.getDate())}`,
    time: `${p(x.getHours())}:${p(x.getMinutes())}`,
  }
}

/** Edit anything about a task without leaving where you are looking at it. */
export function EditTask({ task, onClose, onSaved, compact = false }) {
  const start = toLocal(task.dueDate)
  const [title, setTitle] = useState(task.title || '')
  const [color, setColor] = useState(task.color || '')
  const [priority, setPriority] = useState(task.priority || 'normal')
  const [project, setProject] = useState(task.project?._id || task.project || '')
  const [assignee, setAssignee] = useState(task.assignee?._id || task.assignee || '')
  const [waitingOn, setWaitingOn] = useState(task.waitingOnLabel || '')
  const [date, setDate] = useState(start.date)
  const [time, setTime] = useState(task.dueHasTime ? start.time : '')
  const [opts, setOpts] = useState({ projects: [], people: [] })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)

  useEffect(() => {
    Promise.all([api.projects(), api.people()])
      .then(([p, u]) => setOpts({ projects: p, people: u.filter((x) => x.role !== 'lead') }))
      .catch(() => {})
  }, [])

  const save = async () => {
    if (!title.trim()) return
    setBusy(true); setErr(null)
    try {
      await api.patchTask(task._id, {
        title: title.trim(),
        color,
        priority,
        project: project || undefined,
        assignee: task.track === 'team' ? assignee || '' : undefined,
        waitingOnLabel: task.track === 'team' ? undefined : waitingOn,
        dueDate: date ? (time ? new Date(`${date}T${time}`).toISOString() : date) : '',
        dueHasTime: Boolean(date && time),
      })
      onSaved?.()
      onClose()
    } catch (e) { setErr(e.message) } finally { setBusy(false) }
  }

  return (
    <Modal
      title="Edit task"
      sub={task.project?.name}
      onClose={onClose}
      foot={
        <>
          <button className="btn ghost" onClick={onClose}>Cancel</button>
          <button className="btn primary" disabled={!title.trim() || busy} onClick={save}>
            {busy ? <span className="spinner" /> : 'Save'}
          </button>
        </>
      }
    >
      {err && <div className="err">{err}</div>}

      <Field label="What">
        <input type="text" autoFocus value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && e.metaKey && save()} />
      </Field>

      <div className="field">
        <label>Colour</label>
        <div className="swatches">
          {TASK_COLORS.map((c) => (
            <button
              key={c.key}
              className={`swatch${color === c.key ? ' on' : ''}${c.key ? '' : ' none'}`}
              style={c.hex ? { background: c.hex } : undefined}
              title={c.label}
              onClick={() => setColor(c.key)}
            >
              {color === c.key && <Icon.check size={12} />}
            </button>
          ))}
        </div>
      </div>

      <div className="field">
        <label>Priority</label>
        <div className="seg" style={{ width: '100%' }}>
          {['low', 'normal', 'high', 'urgent'].map((p) => (
            <button key={p} style={{ flex: 1 }} className={priority === p ? 'on' : ''} onClick={() => setPriority(p)}>
              {p[0].toUpperCase() + p.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {!compact && (
        <Field label="Project">
          <select value={project} onChange={(e) => setProject(e.target.value)}>
            {opts.projects.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
          </select>
        </Field>
      )}

      {task.track === 'team' ? (
        <div className="field">
          <label>Who</label>
          <div className="who-row">
            <button className={`who${!assignee ? ' on' : ''}`} onClick={() => setAssignee('')}>
              <span className="widget-pip" /><span>Nobody</span>
            </button>
            {opts.people.map((u) => (
              <button key={u._id} className={`who${String(assignee) === String(u._id) ? ' on' : ''}`}
                onClick={() => setAssignee(u._id)}>
                <Avatar user={u} size={32} /><span>{u.name.split(' ')[0]}</span>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <Field label="For whom">
          <input type="text" value={waitingOn} onChange={(e) => setWaitingOn(e.target.value)} />
        </Field>
      )}

      <div className="field">
        <label>Due</label>
        <div className="due-inputs">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <input type="time" value={time} disabled={!date} onChange={(e) => setTime(e.target.value)} />
        </div>
        {(date || time) && (
          <button className="btn ghost sm" style={{ alignSelf: 'flex-start', marginTop: 6 }}
            onClick={() => { setDate(''); setTime('') }}>
            Clear the deadline
          </button>
        )}
      </div>
    </Modal>
  )
}
