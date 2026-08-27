import { useEffect, useState } from 'react'
import { api } from '../lib/api.js'
import { Avatar, Pill, fmt, pct } from '../components/bits.jsx'

/**
 * Player cards. Sober on purpose — this has to survive being opened in a 1:1,
 * so every figure drills through to the events it came from.
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
    <div>
      <div className="topbar"><h1>People</h1></div>
      <div className="people-grid">
        {people.map((u) => {
          const c = cards[u._id] || {}
          const isLead = u.role === 'lead'
          return (
            <button key={u._id} className="card" style={{ textAlign: 'left' }} onClick={() => setOpen(u._id)}>
              <div className="row" style={{ paddingTop: 0 }}>
                <Avatar user={u} size={34} />
                <div className="grow">
                  <div className="title">{u.name}</div>
                  <div className="sub">{isLead ? 'team lead' : `${c.tasksCompleted ?? 0} done · 12wk`}</div>
                </div>
              </div>
              {isLead ? (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <Pill tone={c.stillOpen ? 'red' : 'green'}>{c.stillOpen ?? 0} still on you</Pill>
                  <Pill>{fmt(c.unblockSpeedHours, 0)}h to unblock</Pill>
                </div>
              ) : (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <Pill tone={c.reliability >= 0.8 ? 'green' : c.reliability >= 0.5 ? 'amber' : 'red'}>
                    {pct(c.reliability)} on time
                  </Pill>
                  <Pill tone={c.reworkIndex >= 0 ? 'green' : 'red'}>
                    rework {c.reworkIndex > 0 ? '+' : ''}{fmt(c.reworkIndex)}
                  </Pill>
                </div>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function Detail({ id, card, onBack }) {
  const [rework, setRework] = useState([])
  useEffect(() => { api.rework(id).then(setRework) }, [id])
  if (!card) return <div className="empty">…</div>

  const isLead = !!card.blockersOnMe || card.blockersOnMe === 0
  return (
    <div>
      <div className="topbar">
        <h1>{card.user?.name || 'Scorecard'}</h1>
        <button className="btn ghost" onClick={onBack}>← People</button>
      </div>

      <div className="metrics">
        {isLead ? (
          <>
            <M k="On me now" v={card.stillOpen} tone={card.stillOpen ? 'bad' : 'good'} n="open blockers" />
            <M k="Unblock speed" v={fmt(card.unblockSpeedHours, 0)} n="median hours" />
            <M k="Cleared" v={card.blockersCleared} n={`of ${card.blockersOnMe}`} />
            <M k="Unclear briefs" v={card.unclearBriefCount} tone={card.unclearBriefCount ? 'bad' : 'good'} n="charged to me" />
          </>
        ) : (
          <>
            <M k="On time" v={pct(card.reliability)} tone={card.reliability >= 0.8 ? 'good' : 'bad'} n={`${card.deliveries} deliveries`} />
            <M k="Rework index" v={`${card.reworkIndex > 0 ? '+' : ''}${fmt(card.reworkIndex)}`} tone={card.reworkIndex >= 0 ? 'good' : 'bad'} n="per delivery" />
            <M k="Cycle time" v={fmt(card.cycleTimeDays)} n="median days" />
            <M k="Completed" v={card.tasksCompleted} n="last 12 weeks" />
          </>
        )}
      </div>

      <div className="section-title">Where the rework came from</div>
      {rework.length === 0 ? (
        <div className="card"><div className="muted" style={{ fontSize: 13 }}>No rework on record.</div></div>
      ) : (
        <div className="card tight">
          {rework.map((r) => (
            <div className="row" key={r._id}>
              <Pill tone={r.points >= 0 ? 'green' : 'red'}>{r.points > 0 ? '+' : ''}{r.points}</Pill>
              <div className="grow">
                <div className="title">{r.task?.title || '—'}</div>
                <div className="sub">
                  {r.reason.replace(/_/g, ' ')} · charged to {r.attributedTo}
                  {r.note ? ` · ${r.note}` : ''}
                </div>
              </div>
              <span className="muted" style={{ fontSize: 11 }}>{r.project?.name}</span>
            </div>
          ))}
        </div>
      )}

      {card.openTasks?.length > 0 && (
        <>
          <div className="section-title">Open right now</div>
          <div className="card tight">
            {card.openTasks.map((t) => (
              <div className="row" key={t._id}>
                <div className="grow">
                  <div className="title">{t.title}</div>
                  <div className="sub">{t.project?.name} · {t.state.replace('_', ' ')}</div>
                </div>
                {t.reopenCount > 0 && <Pill tone="red">reopened ×{t.reopenCount}</Pill>}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

const M = ({ k, v, n, tone }) => (
  <div className="metric">
    <div className="k">{k}</div>
    <div className={`v ${tone || ''}`}>{v ?? '—'}</div>
    <div className="n">{n}</div>
  </div>
)
