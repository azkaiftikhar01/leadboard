import { useEffect, useState } from 'react'
import { api } from '../lib/api.js'
import { Avatar, Modal, Field, Icon } from './ui.jsx'

const TRACKS = [
  { key: 'team',   label: 'A dev',   hint: 'work you are assigning out' },
  { key: 'lead',   label: 'Me',      hint: 'only you can unblock it' },
  { key: 'client', label: 'Client',  hint: 'you are waiting on them' },
]

/**
 * One sheet for every task, wherever it comes from. The first question is who it
 * is pending on, because that is the only thing that decides which column it
 * lands in - and it is the distinction he was already making on paper.
 */
export function QuickTask({ project: fixedProject, onClose, onDone }) {
  const [title, setTitle] = useState('')
  const [track, setTrack] = useState('team')
  const [project, setProject] = useState(fixedProject || '')
  const [assignee, setAssignee] = useState('')
  const [waitingOn, setWaitingOn] = useState('')
  const [due, setDue] = useState('')
  const [opts, setOpts] = useState({ projects: [], people: [] })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)

  useEffect(() => {
    Promise.all([api.projects(), api.teamLoad()]).then(([p, load]) => {
      setOpts({ projects: p, people: load })
      if (!fixedProject) setProject((cur) => cur || p[0]?._id || '')
    })
  }, [fixedProject])

  const save = async () => {
    if (!title.trim() || !project) return
    setBusy(true)
    setErr(null)
    try {
      await api.addTask({
        title: title.trim(), project, track,
        assignee: track === 'team' ? assignee || undefined : undefined,
        waitingOnLabel: track !== 'team' ? waitingOn : '',
        dueDate: due || undefined,
      })
      onDone?.()
      onClose()
    } catch (e) { setErr(e.message) } finally { setBusy(false) }
  }

  return (
    <Modal
      title="Add a task"
      sub="Who is it pending on? That decides where it lands."
      onClose={onClose}
      wide
      foot={
        <>
          <button className="btn ghost" onClick={onClose}>Cancel</button>
          <button className="btn primary" disabled={!title.trim() || !project || busy} onClick={save}>
            {busy ? <span className="spinner" /> : <><Icon.plus size={15} /> Add</>}
          </button>
        </>
      }
    >
      {err && <div className="err">{err}</div>}

      <Field label="What">
        <input
          type="text" autoFocus value={title} placeholder="Send Asad the staging key"
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && e.metaKey && save()}
        />
      </Field>

      <div className="field">
        <label>Pending on</label>
        <div className="track-pick">
          {TRACKS.map((t) => (
            <button key={t.key} className={`tp ${t.key}${track === t.key ? ' on' : ''}`} onClick={() => setTrack(t.key)}>
              <b>{t.label}</b>
              <i>{t.hint}</i>
            </button>
          ))}
        </div>
      </div>

      {track === 'team' && (
        <div className="field">
          <label>Who — sorted by who has room</label>
          <div className="who-row">
            {[...opts.people].sort((a, b) => b.headroom - a.headroom).map((l) => (
              <button
                key={l.user._id}
                className={`who${String(assignee) === String(l.user._id) ? ' on' : ''}`}
                onClick={() => setAssignee(l.user._id)}
              >
                <Avatar user={l.user} size={36} />
                <span>{l.user.name}</span>
                <em className={`load-chip load-${l.band.key}`} style={{ fontStyle: 'normal', fontSize: 10 }}>
                  {l.loadPercent}%
                </em>
              </button>
            ))}
          </div>
        </div>
      )}

      {track !== 'team' && (
        <Field label={track === 'client' ? 'Which client or contact' : 'For whom'}>
          <input
            type="text" value={waitingOn}
            placeholder={track === 'client' ? 'Northwind' : 'Asad'}
            onChange={(e) => setWaitingOn(e.target.value)}
          />
        </Field>
      )}

      <div className="inline" style={{ gap: 12, alignItems: 'flex-end' }}>
        {!fixedProject && (
          <div className="field" style={{ flex: 1 }}>
            <label>Project</label>
            <select value={project} onChange={(e) => setProject(e.target.value)}>
              {opts.projects.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
            </select>
          </div>
        )}
        <div className="field" style={{ flex: 1 }}>
          <label>Due</label>
          <input type="date" value={due} onChange={(e) => setDue(e.target.value)} />
        </div>
      </div>
    </Modal>
  )
}
