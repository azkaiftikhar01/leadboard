import { useEffect, useState } from 'react'
import { api } from '../lib/api.js'
import { Avatar, Tag, EmptyArt, Spinner, Icon, fmt } from '../components/ui.jsx'

const RANGES = [
  { d: 7, label: '7 days' },
  { d: 30, label: '30 days' },
  { d: 90, label: '90 days' },
  { d: 365, label: 'A year' },
]

const ICON = { completed: 'check', rework: 'undo', award: 'spark', standup: 'sun' }

const dayKey = (d) => new Date(d).toDateString()
const dayLabel = (d) => {
  const t = new Date(d)
  const today = new Date().toDateString()
  const yest = new Date(Date.now() - 86_400_000).toDateString()
  if (t.toDateString() === today) return 'Today'
  if (t.toDateString() === yest) return 'Yesterday'
  return t.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' })
}
const clock = (d) => new Date(d).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })

/** How long it took, said the way a person would say it. */
const took = (days) => {
  if (days == null) return null
  if (days < 1) return 'same day'
  if (days < 2) return '1 day'
  if (days < 14) return `${Math.round(days)} days`
  return `${Math.round(days / 7)} weeks`
}

/**
 * What already happened.
 *
 * Completed work used to leave the board and go nowhere, which meant the one
 * question a lead actually gets asked in a review — what did this person ship,
 * and how long did it take — had no answer anywhere in the product. Nothing
 * here is newly logged; it is the same transitions, rework events and awards
 * the scores are computed from, finally read back.
 */
export function History() {
  const [data, setData] = useState(null)
  const [days, setDays] = useState(30)
  const [person, setPerson] = useState('')
  const [project, setProject] = useState('')
  const [kinds, setKinds] = useState({ completed: true, rework: true, award: true, standup: true })
  const [opts, setOpts] = useState({ people: [], projects: [] })

  useEffect(() => {
    Promise.all([api.people(), api.projects()])
      .then(([p, pr]) => setOpts({ people: p.filter((x) => x.role !== 'lead'), projects: pr }))
      .catch(() => {})
  }, [])

  useEffect(() => {
    setData(null)
    const q = new URLSearchParams({ days: String(days) })
    if (person) q.set('person', person)
    if (project) q.set('project', project)
    api.history(`?${q}`).then(setData).catch(() => setData({ events: [], summary: {} }))
  }, [days, person, project])

  if (!data) return <Spinner />

  const s = data.summary
  const events = data.events.filter((e) => kinds[e.type])
  const groups = []
  for (const e of events) {
    const k = dayKey(e.at)
    if (!groups.length || groups.at(-1).key !== k) groups.push({ key: k, at: e.at, items: [] })
    groups.at(-1).items.push(e)
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>History</h1>
          <div className="sub">Everything that has already happened — who did it, and how long it took</div>
        </div>
        <div className="seg">
          {RANGES.map((r) => (
            <button key={r.d} className={days === r.d ? 'on' : ''} onClick={() => setDays(r.d)}>{r.label}</button>
          ))}
        </div>
      </div>

      <div className="stat-row">
        <Stat k="Completed" v={s.completed ?? 0} n={`in ${s.days} days`} />
        <Stat k="Typical time" v={took(s.medianCycleDays) ?? '—'} n="assigned to done" />
        <Stat k="On time" v={s.onTime == null ? '—' : `${Math.round(s.onTime * 100)}%`} n="of tasks with a date"
              tone={s.onTime == null ? null : s.onTime >= 0.8 ? 'good' : 'bad'} />
        <Stat k="Came back" v={s.reworked ?? 0} n="needed rework first"
              tone={s.reworked ? 'bad' : 'good'} />
      </div>

      <div className="hist-filters">
        <select value={person} onChange={(e) => setPerson(e.target.value)}>
          <option value="">Everyone</option>
          {opts.people.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
        </select>
        <select value={project} onChange={(e) => setProject(e.target.value)}>
          <option value="">All projects</option>
          {opts.projects.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
        </select>
        <span className="hist-kinds">
          {Object.keys(kinds).map((k) => (
            <button key={k} className={kinds[k] ? 'on' : ''}
              onClick={() => setKinds((v) => ({ ...v, [k]: !v[k] }))}>
              {k === 'completed' ? 'Completed' : k === 'rework' ? 'Rework' : k === 'award' ? 'Awards' : 'Standups'}
            </button>
          ))}
        </span>
      </div>

      {s.byPerson?.length > 1 && !person && (
        <div className="panel" style={{ marginBottom: 16 }}>
          <div className="panel-head"><h2>Who shipped what</h2></div>
          <div className="panel-body">
            <div className="stack" style={{ gap: 2, padding: '4px 0' }}>
              {s.byPerson.map((p) => (
                <div className="task" key={p.person?._id || 'unassigned'}>
                  <Avatar user={p.person} />
                  <div className="body">
                    <div className="t">{p.person?.name || 'Unassigned'}</div>
                    <div className="m">
                      typically {took(p.medianCycleDays) ?? '—'}
                      {p.late > 0 && <span style={{ color: 'var(--bad)' }}>· {p.late} late</span>}
                    </div>
                  </div>
                  <Tag tone="green">{p.completed} done</Tag>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {events.length === 0 ? (
        <div className="panel">
          <EmptyArt kind="check">
            Nothing in this window yet. Tick something off and it lands here with who did it and how long it took.
          </EmptyArt>
        </div>
      ) : (
        groups.map((g) => (
          <section className="hist-day" key={g.key}>
            <h3>{dayLabel(g.at)}</h3>
            <div className="hist-list">
              {g.items.map((e, i) => <Row key={`${g.key}-${i}`} e={e} />)}
            </div>
          </section>
        ))
      )}
    </>
  )
}

function Row({ e }) {
  const I = Icon[ICON[e.type]] || Icon.check
  return (
    <div className={`hist-row ${e.type}`}>
      <span className="hist-ico"><I size={14} /></span>

      <div className="body">
        <div className="t">
          {e.type === 'award' && <b>{e.person?.name} — </b>}
          {e.type === 'rework' && <b>{e.person?.name} — </b>}
          {e.title}
        </div>
        <div className="m">
          {e.type === 'completed' && (
            <>
              {e.person && <span className="inline" style={{ gap: 4 }}><Avatar user={e.person} size={18} />{e.person.name}</span>}
              {e.project && <span>· {e.project.name}</span>}
              {e.cycleDays != null && <span>· took {took(e.cycleDays)}</span>}
              {e.reopenCount > 0 && <Tag tone="red">back ×{e.reopenCount}</Tag>}
              {e.late === true && <Tag tone="amber">late</Tag>}
              {e.late === false && <Tag tone="green">on time</Tag>}
            </>
          )}
          {e.type === 'rework' && <>{e.label} · charged to {e.attributedTo}{e.note ? ` · ${e.note}` : ''}</>}
          {e.type === 'award' && <>{e.note ? `“${e.note}”` : 'logged by you'}{e.project ? ` · ${e.project.name}` : ''}</>}
          {e.type === 'standup' && <>{e.durationSec ? `${Math.round(e.durationSec / 60)} min` : 'completed'}</>}
        </div>
      </div>

      <span className="hist-right">
        {(e.type === 'award' || e.type === 'rework') && (
          <Tag tone={e.points >= 0 ? 'green' : 'red'}>{e.points > 0 ? '+' : ''}{e.points}</Tag>
        )}
        <time>{clock(e.at)}</time>
      </span>
    </div>
  )
}

const Stat = ({ k, v, n, tone }) => (
  <div className="stat">
    <div className="eyebrow">{k}</div>
    <div className="v num" style={{ color: tone === 'good' ? 'var(--good)' : tone === 'bad' ? 'var(--bad)' : undefined }}>{v}</div>
    <div className="dim" style={{ fontSize: 12 }}>{n}</div>
  </div>
)
