import { useEffect, useState } from 'react'
import { api } from '../lib/api.js'
import { Avatar, Tag, Empty, EmptyArt, Modal, Field, Spinner, Icon } from '../components/ui.jsx'
import { QuickTask } from '../components/QuickTask.jsx'
import { useConfirm } from '../components/Confirm.jsx'

/**
 * Mode is the important control here. It decides how much of a dev's week the
 * project actually eats — a support project at 100% allocation only spends 45%
 * of them — so it is set at creation and changeable in one click afterwards.
 */
export function Projects() {
  const [projects, setProjects] = useState(null)
  const [modes, setModes] = useState([])
  const [people, setPeople] = useState([])
  const [creating, setCreating] = useState(false)
  const [open, setOpen] = useState(null)
  const [addingTo, setAddingTo] = useState(null)

  const load = async () => {
    const [p, m, u] = await Promise.all([api.projects(), api.projectModes(), api.people()])
    setProjects(p)
    setModes(m)
    setPeople(u.filter((x) => x.role === 'dev'))
    if (open) setOpen(p.find((x) => x._id === open._id) || null)
  }
  useEffect(() => { load() }, [])

  if (!projects) return <Spinner />

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Projects</h1>
          <div className="sub">{projects.length} active · mode decides how much of a week each one costs</div>
        </div>
        <button className="btn primary" onClick={() => setCreating(true)}><Icon.plus size={15} /> New project</button>
      </div>

      {projects.length === 0 ? (
        <div className="panel">
          <EmptyArt kind="projects" action={<button className="btn primary" onClick={() => setCreating(true)}><Icon.plus size={15} /> Create a project</button>}>
            No projects yet. Create one, set its mode, then put people on it — the mode
            decides how much of their week it actually costs.
          </EmptyArt>
        </div>
      ) : (
        <div className="grid c2">
          {projects.map((p) => {
            const mode = modes.find((m) => m.key === p.mode)
            return (
              <div key={p._id} className="card hover" style={{ cursor: 'pointer' }} onClick={() => setOpen(p)}>
                <div className="row-between" style={{ marginBottom: 10 }}>
                  <div className="inline" style={{ gap: 9 }}>
                    <span style={{ width: 10, height: 10, borderRadius: 3, background: p.color }} />
                    <div>
                      <div style={{ fontWeight: 620, fontSize: 14.5 }}>{p.name}</div>
                      <div className="dim" style={{ fontSize: 12 }}>{p.client || 'internal'}</div>
                    </div>
                  </div>
                  <Tag tone={p.mode === 'development' ? 'violet' : p.mode === 'support' ? 'green' : ''}>
                    {mode?.label || p.mode}
                  </Tag>
                </div>

                <div className="row-between">
                  <div className="stack-av">
                    {p.members?.length ? (
                      p.members.map((m) => <Avatar key={m.user?._id} user={m.user} />)
                    ) : (
                      <span className="dim" style={{ fontSize: 12 }}>nobody assigned</span>
                    )}
                  </div>
                  <span className="dim" style={{ fontSize: 11.5 }}>
                    costs ×{mode?.weight ?? 1} per person
                  </span>
                </div>

                <div className="card-actions">
                  <button
                    className="btn sm"
                    onClick={(e) => { e.stopPropagation(); setAddingTo(p._id) }}
                  >
                    <Icon.plus size={13} /> Task
                  </button>
                  <button
                    className="btn ghost sm"
                    onClick={(e) => { e.stopPropagation(); setOpen(p) }}
                  >
                    People & mode
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {creating && <NewProject modes={modes} onClose={() => setCreating(false)} onSaved={() => { setCreating(false); load() }} />}
      {addingTo && <QuickTask project={addingTo} onClose={() => setAddingTo(null)} onDone={load} />}
      {open && (
        <ProjectDetail
          project={open} modes={modes} people={people}
          onClose={() => setOpen(null)} onChanged={load}
          onAddTask={(id) => { setOpen(null); setAddingTo(id) }}
        />
      )}
    </>
  )
}

function NewProject({ modes, onClose, onSaved }) {
  const [name, setName] = useState('')
  const [client, setClient] = useState('')
  const [mode, setMode] = useState('development')
  const [busy, setBusy] = useState(false)

  const save = async () => {
    if (!name.trim()) return
    setBusy(true)
    try {
      await api.addProject({ name: name.trim(), client: client.trim(), mode })
      onSaved()
    } finally { setBusy(false) }
  }

  return (
    <Modal
      title="New project"
      sub="You can put people on it next."
      onClose={onClose}
      foot={
        <>
          <button className="btn ghost" onClick={onClose}>Cancel</button>
          <button className="btn primary" disabled={!name.trim() || busy} onClick={save}>
            {busy ? <span className="spinner" /> : 'Create'}
          </button>
        </>
      }
    >
      <Field label="Name">
        <input type="text" autoFocus value={name} placeholder="Widespaces" onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && save()} />
      </Field>
      <Field label="Client">
        <input type="text" value={client} placeholder="Northwind" onChange={(e) => setClient(e.target.value)} />
      </Field>
      <Field label="Mode">
        <div className="seg" style={{ width: '100%' }}>
          {modes.map((m) => (
            <button key={m.key} className={mode === m.key ? 'on' : ''} style={{ flex: 1 }} onClick={() => setMode(m.key)}>
              {m.label}
            </button>
          ))}
        </div>
        <div className="dim" style={{ fontSize: 11.5 }}>
          {mode === 'development' && 'Full weight — someone on this is properly spent.'}
          {mode === 'support' && 'Weighted at 45% — they stay available for real delivery work.'}
          {mode === 'maintenance' && 'Weighted at 25% — barely touches their week.'}
        </div>
      </Field>
    </Modal>
  )
}

function ProjectDetail({ project, modes, people, onClose, onChanged, onAddTask }) {
  const confirm = useConfirm()
  const [busy, setBusy] = useState(null)

  const removeProject = async () => {
    const impact = await api.projectImpact(project._id).catch(() => ({ tasks: 0, open: 0 }))
    const ok = await confirm({
      title: `Delete ${project.name}?`,
      body: impact.tasks
        ? `This project has ${impact.tasks} task${impact.tasks === 1 ? '' : 's'}${impact.open ? `, ${impact.open} still open` : ''}.`
        : 'This project has no tasks on it.',
      danger: 'Delete permanently',
      consequences: [
        { text: `${impact.tasks} task${impact.tasks === 1 ? '' : 's'} deleted with it`, kept: false },
        { text: 'Scores and rework already recorded stay on people’s records', kept: true },
      ],
      // archiving is the safer default and it is reversible, so offer it here
      alternative: {
        label: 'Archive instead',
        run: async () => { await api.archiveProject(project._id); onChanged(); onClose() },
      },
      onConfirm: async () => { await api.deleteProject(project._id); onChanged(); onClose() },
    })
    if (ok) onClose()
  }
  const memberIds = new Set(project.members?.map((m) => String(m.user?._id)))
  const available = people.filter((p) => !memberIds.has(String(p._id)))
  const mode = modes.find((m) => m.key === project.mode)

  const setMode = async (key) => { await api.patchProject(project._id, { mode: key }); onChanged() }
  const put = async (userId, body) => {
    setBusy(userId)
    try { await api.setMember(project._id, userId, body); onChanged() } finally { setBusy(null) }
  }
  const drop = async (userId) => { await api.removeMember(project._id, userId); onChanged() }

  return (
    <Modal
      title={project.name}
      sub={`${project.client || 'internal'} · each person here costs ×${mode?.weight ?? 1} of their week`}
      onClose={onClose}
      wide
      foot={
        <>
          <button className="btn danger" onClick={removeProject}>
            <Icon.trash size={14} /> Delete
          </button>
          <button className="btn" onClick={() => onAddTask(project._id)}>
            <Icon.plus size={14} /> Add a task
          </button>
          <button className="btn primary" onClick={onClose}>Done</button>
        </>
      }
    >
      <Field label="Mode">
        <div className="seg" style={{ width: '100%' }}>
          {modes.map((m) => (
            <button key={m.key} className={project.mode === m.key ? 'on' : ''} style={{ flex: 1 }} onClick={() => setMode(m.key)}>
              {m.label} <span className="dim">×{m.weight}</span>
            </button>
          ))}
        </div>
      </Field>

      <div className="divider" />

      <div>
        <div className="eyebrow" style={{ marginBottom: 9 }}>Who's on it</div>
        {!project.members?.length ? (
          <Empty icon="team">Nobody yet.</Empty>
        ) : (
          <div className="stack" style={{ gap: 10 }}>
            {project.members.map((m) => (
              <div key={m.user?._id} className="row-between">
                <div className="inline" style={{ gap: 9, minWidth: 150 }}>
                  <Avatar user={m.user} />
                  <div>
                    <div style={{ fontSize: 13.5, fontWeight: 550 }}>{m.user?.name}</div>
                    <div className="dim" style={{ fontSize: 11.5 }}>
                      {m.allocation}% × {mode?.weight ?? 1} = {Math.round(m.allocation * (mode?.weight ?? 1))} of their week
                    </div>
                  </div>
                </div>
                <div className="inline" style={{ gap: 9 }}>
                  <input
                    className="range" type="range" min="10" max="100" step="10"
                    style={{ width: 130 }} defaultValue={m.allocation}
                    disabled={busy === m.user?._id}
                    onChange={(e) => put(m.user._id, { allocation: Number(e.target.value) })}
                  />
                  <button className="btn ghost sm" onClick={() => drop(m.user._id)}><Icon.x size={14} /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {available.length > 0 && (
        <div>
          <div className="eyebrow" style={{ marginBottom: 8 }}>Add someone</div>
          <div className="inline" style={{ gap: 6 }}>
            {available.map((p) => (
              <button key={p._id} className="btn sm" onClick={() => put(p._id, { allocation: 100 })}>
                <><Icon.plus size={13} /> {p.name}</>
              </button>
            ))}
          </div>
        </div>
      )}
    </Modal>
  )
}
