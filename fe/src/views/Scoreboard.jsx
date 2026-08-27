import { useEffect, useState } from 'react'
import { api } from '../lib/api.js'
import { Avatar, Tag, Empty, EmptyArt, Spinner, Dial, Icon } from '../components/ui.jsx'
import { GiveAward } from '../components/GiveAward.jsx'

/**
 * The scoreboard. Every number here is either something he logged with his own
 * eyes (awards) or something the work itself produced (rework attribution,
 * on-time deliveries) - and both halves are shown separately, so nobody has to
 * take the total on faith.
 *
 * It is ranked and it is colourful on purpose. A spreadsheet gets opened once a
 * quarter; a board with a top spot on it gets opened on Monday.
 */
export function Scoreboard() {
  const [rows, setRows] = useState(null)
  const [feed, setFeed] = useState([])
  const [giving, setGiving] = useState(false)
  const [open, setOpen] = useState(null)

  const load = () => Promise.all([api.scoreboard(), api.awards('?limit=25')])
    .then(([r, f]) => { setRows(r); setFeed(f) })
  useEffect(() => { load() }, [])

  if (!rows) return <Spinner />

  const hasAny = rows.some((r) => r.praise || r.dings || r.reworkPoints)

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Scoreboard</h1>
          <div className="sub">What you saw, plus what the work showed · last 12 weeks</div>
        </div>
        <button className="btn primary" onClick={() => setGiving(true)}>
          <Icon.spark size={15} /> Log what you saw
        </button>
      </div>

      {rows.length === 0 ? (
        <div className="panel"><EmptyArt kind="team">Add your devs first — the board builds itself from there.</EmptyArt></div>
      ) : (
        <>
          <div className="board">
            {rows.map((r) => (
              <article
                key={r.user._id}
                className={`board-row${r.rank === 1 && hasAny ? ' lead' : ''}`}
                onClick={() => setOpen(open === r.user._id ? null : r.user._id)}
              >
                <span className={`rank r${r.rank}`}>{r.rank}</span>

                <Avatar user={r.user} size={42} />

                <div className="board-who">
                  <b>{r.user.name}</b>
                  <span>{r.user.title || 'Developer'}</span>
                </div>

                {/* the two halves of the score, never merged into one opaque number */}
                <div className="board-bars">
                  <span className="pn">
                    <i className="p" style={{ flex: Math.max(r.praise, 0.001) }} />
                    <i className="n" style={{ flex: Math.max(r.dings + r.avoidable, 0.001) }} />
                  </span>
                  <span className="pn-legend">
                    <b style={{ color: 'var(--good)' }}>{r.praise} good</b>
                    <b style={{ color: r.dings + r.avoidable ? 'var(--bad)' : 'var(--text-3)' }}>
                      {r.dings + r.avoidable} flagged
                    </b>
                  </span>
                </div>

                <div className="board-load">
                  <Dial pct={r.loadPercent} size={40} stroke={4} />
                  <span className="dim">{r.headroom > 0 ? `${r.headroom}% free` : 'full'}</span>
                </div>

                <div className={`board-score ${r.score > 0 ? 'up' : r.score < 0 ? 'down' : ''}`}>
                  {r.score > 0 ? '+' : ''}{r.score}
                  {r.streak >= 3 && <em title={`${r.streak} in a row`}><Icon.flame size={12} /> {r.streak}</em>}
                </div>
              </article>
            ))}
          </div>

          {open && <Detail row={rows.find((r) => r.user._id === open)} onGive={() => setGiving(true)} />}

          <div className="panel" style={{ marginTop: 18 }}>
            <div className="panel-head"><h2>Recent</h2></div>
            <div className="panel-body">
              {feed.length === 0 ? (
                <Empty icon="spark">Nothing logged yet. The first one takes two taps.</Empty>
              ) : (
                <div className="stack" style={{ gap: 2, padding: '4px 0' }}>
                  {feed.map((a) => {
                    const I = Icon[a.meta?.icon] || Icon.spark
                    return (
                      <div className="task" key={a._id}>
                        <span className={`feed-ico ${a.tone}`}><I size={15} /></span>
                        <div className="body">
                          <div className="t">
                            <b>{a.subject?.name}</b> — {a.meta?.label}
                          </div>
                          <div className="m">
                            {a.note && <span>“{a.note}”</span>}
                            {a.project?.name && <span>· {a.project.name}</span>}
                            <span>· {new Date(a.givenAt).toLocaleDateString()}</span>
                          </div>
                        </div>
                        <Tag tone={a.points >= 0 ? 'green' : 'red'}>{a.points > 0 ? '+' : ''}{a.points}</Tag>
                        <button
                          className="btn ghost sm" title="Undo"
                          onClick={async (e) => { e.stopPropagation(); await api.undoAward(a._id); load() }}
                        >
                          <Icon.undo size={14} />
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {giving && <GiveAward onClose={() => setGiving(false)} onDone={load} />}
    </>
  )
}

function Detail({ row, onGive }) {
  if (!row) return null
  return (
    <div className="panel accent" style={{ marginTop: 14 }}>
      <div className="panel-head">
        <h2>{row.user.name} — the arithmetic</h2>
        <button className="btn sm" onClick={onGive}><Icon.spark size={13} /> Log something</button>
      </div>
      <div className="panel-body">
        <div className="grid c3" style={{ padding: '8px 0' }}>
          <Cell k="From you" v={row.awardPoints} n={`${row.praise} good · ${row.dings} flagged`} />
          <Cell k="From the work" v={row.reworkPoints} n={`${row.avoidable} avoidable · ${row.absorbed} absorbed`} />
          <Cell k="On time" v={row.reliability === null ? '—' : `${Math.round(row.reliability * 100)}%`} n={`${row.deliveries} deliveries`} plain />
          <Cell k="Open now" v={row.openTasks} n={`${row.loadPercent}% loaded`} plain />
        </div>
        {row.recent.length > 0 && (
          <div className="inline" style={{ gap: 6, paddingBottom: 8 }}>
            {row.recent.map((a, i) => (
              <Tag key={i} tone={a.points >= 0 ? 'green' : 'red'}>{a.label}</Tag>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

const Cell = ({ k, v, n, plain }) => (
  <div className="stat" style={{ padding: '14px 15px' }}>
    <div className="eyebrow">{k}</div>
    <div className="v num" style={{
      fontSize: 26,
      color: plain ? undefined : v > 0 ? 'var(--good)' : v < 0 ? 'var(--bad)' : undefined,
    }}>
      {!plain && v > 0 ? '+' : ''}{v}
    </div>
    <div className="dim" style={{ fontSize: 12 }}>{n}</div>
  </div>
)
