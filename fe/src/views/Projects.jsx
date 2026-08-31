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
const SORTS = [
  { key: 'name', label: 'Name' },
  { key: 'recent', label: 'Recently touched' },
  { key: 'deadline', label: 'Deadline' },
  { key: 'mode', label: 'Mode' },
]
const STATUSES = [
  { key: '', label: 'Live' },
  { key: 'active', label: 'Active' },
  { key: 'shipped', label: 'Shipped' },
  { key: 'archived', label: 'Archived' },
]

export function Projects() {
  const [page, setPage] = useState(null)
  const [modes, setModes] = useState([])
  const [people, setPeople] = useState([])
  const [creating, setCreating] = useState(false)
  const [open, setOpen] = useState(null)
  const [addingTo, setAddingTo] = useState(null)

  const [q, setQ] = useState('')
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState('name')
  const [status, setStatus] = useState('')
  const [pageNo, setPageNo] = useState(1)

  // let him finish typing before asking the server
  useEffect(() => {
    const t = setTimeout(() => { setQuery(q); setPageNo(1) }, 260)
    return () => clearTimeout(t)
  }, [q])

  const load = async () => {
    const params = { page: String(pageNo), perPage: '12', sort }
    if (query) params.q = query
    if (status) params.status = status
    const [res, m, u] = await Promise.all([api.projectsPage(params), api.projectModes(), api.people()])
    setPage(res)
    setModes(m)
    setPeople(u.filter((x) => x.role !== 'lead'))
    if (open) setOpen(res.items.find((x) => x._id === open._id) || null)
  }
  useEffect(() => { load() }, [pageNo, sort, status, query])

  const projects = page?.items ?? []

  if (!page) return <Spinner />

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Projects</h1>
          <div className="sub">
            {page.total} {status ? STATUSES.find((x) => x.key === status)?.label.toLowerCase() : 'live'}
            {query ? ` matching “${query}”` : ''} · mode decides how much of a week each one costs
          </div>
        </div>
        <button className="btn primary" onClick={() => setCreating(true)}><Icon.plus size={15} /> New project</button>
      </div>

      <div className="proj-bar">
        <span className="proj-search">
          <Icon.spark size={15} />
          <input
            type="text" value={q} placeholder="Search projects or clients…"
            onChange={(e) => setQ(e.target.value)}
          />
          {q && <button className="proj-clear" onClick={() => setQ('')}><Icon.x size={13} /></button>}
        </span>

        <select value={sort} onChange={(e) => { setSort(e.target.value); setPageNo(1) }}>
          {SORTS.map((s2) => <option key={s2.key} value={s2.key}>Sort: {s2.label}</option>)}
        </select>

        <span className="seg">
          {STATUSES.map((s2) => (
            <button key={s2.key} className={status === s2.key ? 'on' : ''}
              onClick={() => { setStatus(s2.key); setPageNo(1) }}>
              {s2.label}
              {page.counts?.[s2.key] ? <span className="dim"> {page.counts[s2.key]}</span> : null}
            </button>
          ))}
        </span>
      </div>

      {projects.length === 0 ? (
        <div className="panel">
          <EmptyArt
            kind="projects"
            action={query
              ? <button className="btn" onClick={() => setQ('')}>Clear the search</button>
              : <button className="btn primary" onClick={() => setCreating(true)}><Icon.plus size={15} /> Create a project</button>}
          >
            {query
              ? `Nothing matches “${query}”.`
              : 'No projects yet. Create one, set its mode, then put people on it — the mode decides how much of their week it actually costs.'}
          </EmptyArt>
        </div>
      ) : (
        <div className="grid c2">
          {projects.map((p) => {
            const mode = modes.find((m) => m.key === p.mode)
            const managers = (p.members || []).filter((m) => m.isManager)
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
                  <div className="inline" style={{ gap: 6 }}>
                    {p.status !== 'active' && (
                      <Tag tone={p.status === 'shipped' ? 'green' : ''}>
                        {p.status === 'shipped' ? 'Shipped' : p.status}
                      </Tag>
                    )}
                    <Tag tone={p.mode === 'development' ? 'violet' : p.mode === 'support' ? 'green' : ''}>
                      {mode?.label || p.mode}
                    </Tag>
                  </div>
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

                {managers.length > 0 && (
                  <div className="pm-line">
                    <Icon.crown size={12} />
                    {managers.map((m) => m.user?.name).join(', ')}
                  </div>
                )}

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

      {page.pages > 1 && (
        <nav className="pager">
          <button className="btn sm" disabled={pageNo <= 1} onClick={() => setPageNo((n) => n - 1)}>
            <Icon.back size={14} /> Back
          </button>
          <span className="pager-n">Page {page.page} of {page.pages}</span>
          <button className="btn sm" disabled={pageNo >= page.pages} onClick={() => setPageNo((n) => n + 1)}>
            Next <Icon.arrow size={14} />
          </button>
        </nav>
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

  const endProject = async () => {
    const impact = await api.projectImpact(project._id).catch(() => ({ open: 0 }))
    const ok = await confirm({
      title: `Mark ${project.name} as shipped?`,
      body: impact.open
        ? `${impact.open} task${impact.open === 1 ? '' : 's'} still open on it.`
        : 'Everything on it is done.',
      danger: 'Mark it shipped',
      tone: 'warm',
      consequences: [
        { text: 'It leaves the day board and the load calculation', kept: false },
        { text: 'Every task, score and delivery on it is kept', kept: true },
        { text: 'You can reopen it from the Shipped tab', kept: true },
      ],
      onConfirm: async () => { await api.endProject(project._id); onChanged(); onClose() },
    })
    if (ok) onClose()
  }

  const reopen = async () => { await api.restoreProject(project._id); onChanged(); onClose() }

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
          {project.status === 'active' ? (
            <button className="btn" onClick={endProject}><Icon.check size={14} /> End project</button>
          ) : (
            <button className="btn" onClick={reopen}><Icon.undo size={14} /> Reopen</button>
          )}
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
                    <div className="dim inline" style={{ fontSize: 11.5, gap: 6 }}>
                      {m.isManager && <Tag tone="amber"><Icon.crown size={11} /> PM</Tag>}
                      <span>{m.allocation}% × {mode?.weight ?? 1} = {Math.round(m.allocation * (mode?.weight ?? 1))} of their week</span>
                    </div>
                  </div>
                </div>
                <div className="inline" style={{ gap: 9 }}>
                  <button
                    className={`pm-toggle${m.isManager ? ' on' : ''}`}
                    title={m.isManager ? 'Project manager — click to unset' : 'Make project manager'}
                    onClick={() => put(m.user._id, { isManager: !m.isManager })}
                  >
                    <Icon.crown size={14} />
                  </button>
                  <input
                    className="range" type="range" min="10" max="100" step="10"
                    style={{ width: 110 }} defaultValue={m.allocation}
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
            {available.map((u) => (
              <span key={u._id} className="add-person">
                <button className="btn sm" onClick={() => put(u._id, { allocation: 100 })}>
                  <Icon.plus size={13} /> {u.name}
                </button>
                <button
                  className="btn sm pm-add" title={`Add ${u.name} as project manager`}
                  onClick={() => put(u._id, { allocation: 100, isManager: true })}
                >
                  <Icon.crown size={13} />
                </button>
              </span>
            ))}
          </div>
        </div>
      )}
    </Modal>
  )
}
