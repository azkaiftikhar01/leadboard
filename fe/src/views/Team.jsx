import { useEffect, useState } from 'react'
import { api } from '../lib/api.js'
import { Avatar, Tag, Empty, EmptyArt, Modal, Field, LoadMeter, Spinner, Dial, Icon } from '../components/ui.jsx'
import { useConfirm } from '../components/Confirm.jsx'

const BAND_LABEL = { free: 'Has room', ok: 'Comfortable', full: 'Full', over: 'Overloaded' }

/**
 * The bandwidth board. The number that matters is weighted: someone parked on a
 * support project is not spent, and this has to say so or he will keep
 * protecting people who are barely loaded.
 */
export function Team() {
  const [rows, setRows] = useState(null)
  const [adding, setAdding] = useState(false)
  const [open, setOpen] = useState(null)

  const load = () => api.teamLoad().then(setRows)
  useEffect(() => { load() }, [])

  if (!rows) return <Spinner />

  const free = rows.filter((r) => r.headroom > 15)

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Team</h1>
          <div className="sub">
            {rows.length} {rows.length === 1 ? 'dev' : 'devs'}
            {free.length > 0 && <> · <span style={{ color: 'var(--good)' }}>{free.length} with room right now</span></>}
          </div>
        </div>
        <button className="btn primary" onClick={() => setAdding(true)}><Icon.plus size={15} /> Add dev</button>
      </div>

      {rows.length === 0 ? (
        <div className="panel">
          <EmptyArt kind="team" action={<button className="btn primary" onClick={() => setAdding(true)}><Icon.plus size={15} /> Add your first dev</button>}>
            No devs yet. Add the team first — the load board, the day board and every
            scorecard hang off it.
          </EmptyArt>
        </div>
      ) : (
        <div className="grid c2">
          {rows.map((r) => (
            <div key={r.user._id} className="card hover" style={{ cursor: 'pointer' }} onClick={() => setOpen(r)}>
              <div className="row-between" style={{ marginBottom: 14 }}>
                <div className="inline" style={{ gap: 12 }}>
                  <Avatar user={r.user} size={38} />
                  <div>
                    <div style={{ fontWeight: 640, fontSize: 15 }}>{r.user.name}</div>
                    <div className="dim" style={{ fontSize: 12 }}>{r.user.title || 'Developer'}</div>
                  </div>
                </div>
                <Dial pct={r.loadPercent} size={50} />
              </div>

              <LoadMeter assignments={r.assignments} capacity={r.capacity} />

              <div className="row-between" style={{ marginTop: 9 }}>
                <span className="dim" style={{ fontSize: 11.5 }}>
                  {BAND_LABEL[r.band.key]}
                  {r.headroom > 0 && ` · ${r.headroom}% free`}
                </span>
                <span className="dim" style={{ fontSize: 11.5 }}>
                  {r.openTasks} open{r.overdue > 0 && <span style={{ color: 'var(--bad)' }}> · {r.overdue} late</span>}
                </span>
              </div>

              <div className="inline" style={{ marginTop: 11, gap: 6 }}>
                {r.assignments.length === 0 ? (
                  <Tag>on nothing</Tag>
                ) : (
                  r.assignments.map((a) => (
                    <Tag key={a.project._id} title={`${a.allocation}% × ${a.weight} weight = ${a.effective}`}>
                      <span style={{ width: 6, height: 6, borderRadius: 99, background: a.project.color }} />
                      {a.project.name}
                      <span className="dim">{a.effective}</span>
                    </Tag>
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {adding && <AddDev onClose={() => setAdding(false)} onSaved={() => { setAdding(false); load() }} />}
      {open && <DevDetail row={open} onClose={() => setOpen(null)} onChanged={load} />}
    </>
  )
}

function AddDev({ onClose, onSaved }) {
  const [name, setName] = useState('')
  const [title, setTitle] = useState('')
  const [capacity, setCapacity] = useState(100)
  const [busy, setBusy] = useState(false)

  const save = async () => {
    if (!name.trim()) return
    setBusy(true)
    try {
      await api.addPerson({ name: name.trim(), title: title.trim(), capacityPercent: Number(capacity) })
      onSaved()
    } finally { setBusy(false) }
  }

  return (
    <Modal
      title="Add a dev"
      sub="The name is also how the mic will recognise them when you speak."
      onClose={onClose}
      foot={
        <>
          <button className="btn ghost" onClick={onClose}>Cancel</button>
          <button className="btn primary" disabled={!name.trim() || busy} onClick={save}>
            {busy ? <span className="spinner" /> : 'Add'}
          </button>
        </>
      }
    >
      <Field label="Name">
        <input type="text" autoFocus value={name} placeholder="Asad" onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && save()} />
      </Field>
      <Field label="Role">
        <input type="text" value={title} placeholder="Frontend" onChange={(e) => setTitle(e.target.value)} />
      </Field>
      <Field label={`Availability — ${capacity}% of a full week`}>
        <input className="range" type="range" min="20" max="100" step="10" value={capacity}
          onChange={(e) => setCapacity(e.target.value)} />
        <div className="dim" style={{ fontSize: 11.5 }}>
          Drop this for part-timers, or anyone half-gone to something else.
        </div>
      </Field>
    </Modal>
  )
}

function DevDetail({ row, onClose, onChanged }) {
  const confirm = useConfirm()
  const [card, setCard] = useState(null)
  useEffect(() => { api.scorecard(row.user._id).then(setCard) }, [row.user._id])

  const remove = async () => {
    const impact = await api.personImpact(row.user._id).catch(() => ({ open: 0, awards: 0, rework: 0 }))
    const ok = await confirm({
      title: `Remove ${row.user.name}?`,
      body: impact.open
        ? `They still have ${impact.open} open task${impact.open === 1 ? '' : 's'}, which will be left unassigned.`
        : 'They have nothing open right now.',
      danger: 'Delete permanently',
      consequences: [
        { text: `${impact.awards} award${impact.awards === 1 ? '' : 's'} and ${impact.rework} rework event${impact.rework === 1 ? '' : 's'} erased`, kept: false },
        { text: 'Their open tasks stay, unassigned', kept: true },
      ],
      // taking someone off the team should not require destroying their record
      alternative: {
        label: 'Just deactivate',
        run: async () => { await api.removePerson(row.user._id); onChanged(); onClose() },
      },
      onConfirm: async () => { await api.deletePerson(row.user._id); onChanged(); onClose() },
    })
    if (ok) onClose()
  }

  return (
    <Modal
      title={row.user.name}
      sub={`${row.user.title || 'Developer'} · ${row.loadPercent}% loaded · ${row.headroom}% free`}
      onClose={onClose}
      foot={
        <>
          <button className="btn danger" onClick={remove}><Icon.trash size={14} /> Remove</button>
          <button className="btn" onClick={onClose}>Close</button>
        </>
      }
    >
      <div>
        <div className="eyebrow" style={{ marginBottom: 8 }}>What their week is made of</div>
        {row.assignments.length === 0 ? (
          <Empty icon="projects">Not on any project yet.</Empty>
        ) : (
          <div className="stack" style={{ gap: 8 }}>
            {row.assignments.map((a) => (
              <div key={a.project._id} className="row-between">
                <div className="inline">
                  <span style={{ width: 8, height: 8, borderRadius: 99, background: a.project.color }} />
                  <span style={{ fontSize: 13.5 }}>{a.project.name}</span>
                  <Tag tone={a.project.mode === 'development' ? 'violet' : ''}>{a.project.mode}</Tag>
                </div>
                <span className="dim num" style={{ fontSize: 12 }}>
                  {a.allocation}% × {a.weight} = <b style={{ color: 'var(--text-2)' }}>{a.effective}</b>
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {card && (
        <div>
          <div className="eyebrow" style={{ marginBottom: 8 }}>Track record · 12 weeks</div>
          <div className="inline" style={{ gap: 7 }}>
            <Tag tone={card.reliability >= 0.8 ? 'green' : card.reliability === null ? '' : 'red'}>
              {card.reliability === null ? 'no deliveries' : `${Math.round(card.reliability * 100)}% on time`}
            </Tag>
            <Tag tone={card.reworkIndex >= 0 ? 'green' : 'red'}>
              rework {card.reworkIndex > 0 ? '+' : ''}{Number(card.reworkIndex).toFixed(1)}
            </Tag>
            <Tag>{card.tasksCompleted} completed</Tag>
          </div>
        </div>
      )}
    </Modal>
  )
}
