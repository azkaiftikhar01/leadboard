import { useEffect, useState } from 'react'
import { api } from '../lib/api.js'
import { Avatar, Tag, Empty, Spinner, Icon, pct, fmt } from '../components/ui.jsx'

/**
 * Scorecards. Sober on purpose — this has to survive being opened in a 1:1, so
 * every figure drills through to the events it came from.
 */
export function People() {
  const [people, setPeople] = useState([])
  const [cards, setCards] = useState({})
  const [open, setOpen] = useState(null)

  useEffect(() => {
    api.people().then(async (list) => {
      setPeople(list)
      const entries = await Promise.all(list.map(async (u) => [u._id, await api.scorecard(u._id)]))
      setCards(Object.fromEntries(entries))
    })
  }, [])

  if (open) return <Detail id={open} card={cards[open]} onBack={() => setOpen(null)} />

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Scorecards</h1>
          <div className="sub">Derived from deliveries and rework — nothing here is hand-entered</div>
        </div>
      </div>

      <div className="grid c2">
        {people.map((u) => {
          const c = cards[u._id] || {}
          const isLead = u.role === 'lead'
          return (
            <button key={u._id} className="card hover" style={{ textAlign: 'left' }} onClick={() => setOpen(u._id)}>
              <div className="inline" style={{ gap: 11, marginBottom: 12 }}>
                <Avatar user={u} size={38} />
                <div>
                  <div style={{ fontWeight: 620, fontSize: 14.5 }}>{u.name}</div>
                  <div className="dim" style={{ fontSize: 12 }}>
                    {isLead ? 'team lead' : `${c.tasksCompleted ?? 0} completed · 12wk`}
                  </div>
                </div>
              </div>
              <div className="inline" style={{ gap: 6 }}>
                {isLead ? (
                  <>
                    <Tag tone={c.stillOpen ? 'red' : 'green'}>{c.stillOpen ?? 0} still on you</Tag>
                    <Tag>{fmt(c.unblockSpeedHours, 0)}h to unblock</Tag>
                  </>
                ) : (
                  <>
                    <Tag tone={c.reliability >= 0.8 ? 'green' : c.reliability === null ? '' : 'red'}>
                      {c.reliability === null ? 'no deliveries' : `${pct(c.reliability)} on time`}
                    </Tag>
                    <Tag tone={c.reworkIndex >= 0 ? 'green' : 'red'}>
                      rework {c.reworkIndex > 0 ? '+' : ''}{fmt(c.reworkIndex)}
                    </Tag>
                  </>
                )}
              </div>
            </button>
          )
        })}
      </div>
    </>
  )
}

function Detail({ id, card, onBack }) {
  const [rework, setRework] = useState([])
  useEffect(() => { api.rework(id).then(setRework) }, [id])
  if (!card) return <Spinner />

  const isLead = card.blockersOnMe !== undefined

  return (
    <>
      <div className="page-head">
        <div>
          <h1>{card.user?.name || 'Scorecard'}</h1>
          <div className="sub">Last 12 weeks</div>
        </div>
        <button className="btn ghost" onClick={onBack}><Icon.back size={15} /> All</button>
      </div>

      <div className="grid c3" style={{ marginBottom: 18 }}>
        {isLead ? (
          <>
            <M k="On me now" v={card.stillOpen} n="open" tone={card.stillOpen ? 'bad' : 'good'} />
            <M k="Unblock speed" v={fmt(card.unblockSpeedHours, 0)} n="median hours" />
            <M k="Cleared" v={card.blockersCleared} n={`of ${card.blockersOnMe}`} />
            <M k="Unclear briefs" v={card.unclearBriefCount} n="charged to me" tone={card.unclearBriefCount ? 'bad' : 'good'} />
          </>
        ) : (
          <>
            <M k="On time" v={pct(card.reliability)} n={`${card.deliveries} deliveries`} tone={card.reliability >= 0.8 ? 'good' : 'bad'} />
            <M k="Rework index" v={`${card.reworkIndex > 0 ? '+' : ''}${fmt(card.reworkIndex)}`} n="per delivery" tone={card.reworkIndex >= 0 ? 'good' : 'bad'} />
            <M k="Cycle time" v={fmt(card.cycleTimeDays)} n="median days" />
            <M k="Completed" v={card.tasksCompleted} n="tasks" />
          </>
        )}
      </div>

      <div className="panel">
        <div className="panel-head"><h2>Where the rework came from</h2></div>
        <div className="panel-body">
          {rework.length === 0 ? (
            <Empty icon="check">No rework on record.</Empty>
          ) : (
            <div className="stack" style={{ gap: 2, padding: '4px 0' }}>
              {rework.map((r) => (
                <div className="task" key={r._id}>
                  <Tag tone={r.points >= 0 ? 'green' : 'red'}>{r.points > 0 ? '+' : ''}{r.points}</Tag>
                  <div className="body">
                    <div className="t">{r.task?.title || '—'}</div>
                    <div className="m">
                      {r.reason.replace(/_/g, ' ')} · charged to {r.attributedTo}
                      {r.note && ` · ${r.note}`}
                    </div>
                  </div>
                  <span className="dim" style={{ fontSize: 11 }}>{r.project?.name}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {card.openTasks?.length > 0 && (
        <div className="panel" style={{ marginTop: 14 }}>
          <div className="panel-head"><h2>Open right now</h2></div>
          <div className="panel-body">
            <div className="stack" style={{ gap: 2, padding: '4px 0' }}>
              {card.openTasks.map((t) => (
                <div className="task" key={t._id}>
                  <div className="body">
                    <div className="t">{t.title}</div>
                    <div className="m">{t.project?.name} · {t.state.replace('_', ' ')}</div>
                  </div>
                  {t.reopenCount > 0 && <Tag tone="red">back ×{t.reopenCount}</Tag>}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

const M = ({ k, v, n, tone }) => (
  <div className="card">
    <div className="eyebrow">{k}</div>
    <div className="num" style={{
      fontSize: 25, fontWeight: 700, marginTop: 6,
      color: tone === 'good' ? 'var(--good)' : tone === 'bad' ? 'var(--bad)' : 'var(--text)',
    }}>{v ?? '—'}</div>
    <div className="dim" style={{ fontSize: 11.5, marginTop: 2 }}>{n}</div>
  </div>
)
