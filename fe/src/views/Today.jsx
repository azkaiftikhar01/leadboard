import { useEffect, useState } from 'react'
import { api } from '../lib/api.js'
import { Mic } from '../components/Mic.jsx'
import { CaptureChips } from '../components/CaptureChips.jsx'
import { Avatar, Tag, Empty, Streak, Modal, Field, Spinner, Dial, Icon, dueLabel } from '../components/ui.jsx'

const TRACKS = [
  { key: 'lead', label: 'On me', hint: 'needs your interference' },
  { key: 'team', label: 'Team', hint: 'assigned to a dev' },
  { key: 'client', label: 'Client', hint: 'pending from them' },
]

/**
 * The day board — the three columns his paper page always had. One list, one
 * tick, one place to look. Voice sits at the top because capture has to be the
 * cheapest thing on the screen.
 */
export function Today() {
  const [data, setData] = useState(null)
  const [capture, setCapture] = useState(null)
  const [adding, setAdding] = useState(null)
  const [err, setErr] = useState(null)

  const load = () => api.today().then(setData).catch((e) => setErr(e.message))
  useEffect(() => { load() }, [])

  const tick = async (task) => {
    // optimistic — a tick that lags feels broken, and this happens all day
    setData((d) => ({
      ...d,
      tracks: Object.fromEntries(
        Object.entries(d.tracks).map(([k, list]) => [k, list.filter((t) => t._id !== task._id)])
      ),
      doneToday: d.doneToday + 1,
    }))
    await api.toggleTask(task._id)
    load()
  }

  if (err) return <div className="err">{err} — is the API running on :4000?</div>
  if (!data) return <Spinner />

  const total = TRACKS.reduce((n, t) => n + data.tracks[t.key].length, 0)

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Today</h1>
          <div className="sub">
            {total} open · {data.doneToday} cleared today
            {data.dueSoon.length > 0 && <> · <span style={{ color: 'var(--warn)' }}>{data.dueSoon.length} due soon</span></>}
          </div>
        </div>
        <div className="inline">
          <Streak count={data.streak} />
          {!data.standupDone && <a href="#/standup" className="btn primary">Start standup <Icon.arrow size={15} /></a>}
        </div>
      </div>

      {/* capture first — it has to be the cheapest thing on the page */}
      <div className="panel" style={{ marginBottom: 16 }}>
        <div className="panel-body" style={{ padding: '12px 16px' }}>
          <Mic source="window" onCapture={setCapture} hint="Say what changed. Tasks, blockers, what you owe — all at once." />
          {capture && (
            <div className="stack" style={{ gap: 6, marginTop: 12 }}>
              <CaptureChips capture={capture} onChange={(c) => { setCapture(c); load() }} />
            </div>
          )}
        </div>
      </div>

      <div className="tracks">
        {TRACKS.map((tr) => {
          const list = data.tracks[tr.key]
          return (
            <section className="track" data-t={tr.key} key={tr.key}>
              <header className="track-head">
                <span className="spine" />
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 620 }}>{tr.label}</div>
                  <div className="dim" style={{ fontSize: 11 }}>{tr.hint}</div>
                </div>
                <span className="n">{list.length}</span>
              </header>

              <div className="track-body">
                {list.length === 0 ? (
                  <Empty icon="check">Clear.</Empty>
                ) : (
                  list.map((t) => <TaskRow key={t._id} task={t} track={tr.key} onTick={() => tick(t)} />)
                )}
                <button className="btn ghost sm" style={{ justifyContent: 'flex-start' }} onClick={() => setAdding(tr.key)}>
                  <Icon.plus size={14} /> Add
                </button>
              </div>
            </section>
          )
        })}
      </div>

      {data.load.length > 0 && (
        <div className="panel" style={{ marginTop: 16 }}>
          <div className="panel-head">
            <h2>Who has room</h2>
            <a href="#/team" className="btn ghost sm">Team <Icon.arrow size={13} /></a>
          </div>
          <div className="panel-body">
            <div className="inline" style={{ gap: 8, padding: '8px 0' }}>
              {[...data.load].sort((a, b) => b.headroom - a.headroom).map((l) => (
                <div key={l.user._id} className="dial-wrap" style={{ marginRight: 14 }}>
                  <Dial pct={l.loadPercent} />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{l.user.name}</div>
                    <div className="dim" style={{ fontSize: 11.5 }}>
                      {l.headroom > 0 ? `${l.headroom}% free` : 'no room'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {adding && <AddTask track={adding} onClose={() => setAdding(null)} onSaved={() => { setAdding(null); load() }} />}
    </>
  )
}

function TaskRow({ task, track, onTick }) {
  const due = dueLabel(task.dueDate)
  return (
    <div className="task">
      <button className="tick" onClick={onTick} title="Mark done"><Icon.check size={13} /></button>
      <div className="body">
        <div className="t">{task.title}</div>
        <div className="m">
          {track === 'team' && task.assignee && (
            <span className="inline" style={{ gap: 4 }}>
              <Avatar user={task.assignee} />
              {task.assignee.name}
            </span>
          )}
          {track !== 'team' && task.waitingOnLabel && <span>{task.waitingOnLabel}</span>}
          {task.project && <span>· {task.project.name}</span>}
          {task.daysOnTask >= 3 && <Tag tone="amber">day {task.daysOnTask}</Tag>}
          {due && <Tag tone={due.tone}>{due.text}</Tag>}
          {task.reopenCount > 0 && <Tag tone="red">back ×{task.reopenCount}</Tag>}
        </div>
      </div>
    </div>
  )
}

function AddTask({ track, onClose, onSaved }) {
  const [title, setTitle] = useState('')
  const [project, setProject] = useState('')
  const [assignee, setAssignee] = useState('')
  const [waitingOn, setWaitingOn] = useState('')
  const [due, setDue] = useState('')
  const [opts, setOpts] = useState({ projects: [], people: [] })
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    Promise.all([api.projects(), api.people()]).then(([p, u]) => {
      setOpts({ projects: p, people: u.filter((x) => x.role === 'dev') })
      setProject(p[0]?._id || '')
    })
  }, [])

  const save = async () => {
    if (!title.trim() || !project) return
    setBusy(true)
    try {
      await api.addTask({
        title: title.trim(), project, track,
        assignee: track === 'team' ? assignee || undefined : undefined,
        waitingOnLabel: track !== 'team' ? waitingOn : '',
        dueDate: due || undefined,
      })
      onSaved()
    } finally { setBusy(false) }
  }

  const label = { lead: 'On me', team: 'Team', client: 'Client' }[track]

  return (
    <Modal
      title={`Add to ${label}`}
      sub={track === 'lead' ? 'Something only you can unblock.' : track === 'client' ? 'Something you are waiting on them for.' : 'Work for a dev.'}
      onClose={onClose}
      foot={
        <>
          <button className="btn ghost" onClick={onClose}>Cancel</button>
          <button className="btn primary" disabled={!title.trim() || !project || busy} onClick={save}>
            {busy ? <span className="spinner" /> : 'Add'}
          </button>
        </>
      }
    >
      <Field label="What">
        <input type="text" autoFocus value={title} placeholder="Send Asad the staging key"
          onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && save()} />
      </Field>
      <Field label="Project">
        <select value={project} onChange={(e) => setProject(e.target.value)}>
          {opts.projects.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
        </select>
      </Field>
      {track === 'team' ? (
        <Field label="Who">
          <select value={assignee} onChange={(e) => setAssignee(e.target.value)}>
            <option value="">unassigned</option>
            {opts.people.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
          </select>
        </Field>
      ) : (
        <Field label={track === 'client' ? 'Waiting on' : 'For whom'}>
          <input type="text" value={waitingOn} placeholder={track === 'client' ? 'Northwind' : 'Asad'}
            onChange={(e) => setWaitingOn(e.target.value)} />
        </Field>
      )}
      <Field label="Due">
        <input type="date" value={due} onChange={(e) => setDue(e.target.value)} />
      </Field>
    </Modal>
  )
}
