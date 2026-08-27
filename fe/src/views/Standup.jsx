import { useEffect, useState, useCallback } from 'react'
import { api } from '../lib/api.js'
import { Mic } from '../components/Mic.jsx'
import { CaptureChips } from '../components/CaptureChips.jsx'
import { Avatar, Tag, Empty, Spinner, Icon, dueLabel } from '../components/ui.jsx'
import { QuickTask } from '../components/QuickTask.jsx'

/**
 * The ritual. A pre-filled card stack, never a blank page — a blank page is what
 * the notebook already gave him. Keyboard-driven because he is at a laptop:
 * Right arrow advances, left goes back, Esc leaves.
 */
export function Standup() {
  const [data, setData] = useState(null)
  const [i, setI] = useState(0)
  const [captures, setCaptures] = useState({})
  const [digest, setDigest] = useState(null)
  const [startedAt] = useState(Date.now())
  const [copied, setCopied] = useState(false)
  const [addingTo, setAddingTo] = useState(null)
  const [jumping, setJumping] = useState(false)

  useEffect(() => { api.standupToday().then(setData) }, [])

  const cards = data?.cards ?? []
  const atEnd = i >= cards.length

  const finish = useCallback(async () => {
    const session = await api.completeStandup({
      durationSec: Math.round((Date.now() - startedAt) / 1000),
      projectsCovered: cards.map((c) => c.project._id),
    })
    setDigest(session.digest)
  }, [cards, startedAt])

  const next = useCallback(() => {
    if (i + 1 > cards.length - 1) { setI(cards.length); finish() } else setI(i + 1)
  }, [i, cards.length, finish])

  useEffect(() => {
    const onKey = (e) => {
      if (digest) return
      if (e.key === 'ArrowRight' || (e.key === 'Enter' && e.metaKey)) next()
      if (e.key === 'ArrowLeft') setI((n) => Math.max(0, n - 1))
      if (e.key === 'Escape') location.hash = '#/'
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [next, digest])

  if (!data) return <Spinner />
  if (!cards.length) return <Empty icon="projects">No active projects yet. Create one first.</Empty>

  if (digest) return <Digest digest={digest} copied={copied} setCopied={setCopied} />

  const card = cards[Math.min(i, cards.length - 1)]
  if (atEnd) return <Spinner />

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>{card.project.name}</h1>
          <div className="sub">
            {card.project.client} · {i + 1} of {cards.length}
          </div>
        </div>
        <div className="inline" style={{ gap: 10 }}>
          <button className="btn sm" onClick={() => setJumping((v) => !v)} title="Jump to any project">
            <Icon.projects size={14} /> All projects
          </button>
          <button className="btn ghost sm" onClick={() => { location.hash = '#/' }} title="Leave standup — Esc">
            <Icon.x size={15} /> Leave
          </button>
        </div>
      </div>

      {jumping && (
        <div className="jump">
          {cards.map((c, n) => (
            <button
              key={c.project._id}
              className={`jump-item${n === i ? ' on' : ''}${n < i ? ' seen' : ''}`}
              onClick={() => { setI(n); setJumping(false) }}
            >
              <span className="jump-n">{n < i ? <Icon.check size={12} /> : n + 1}</span>
              {c.project.name}
              {c.tasks.length > 0 && <em>{c.tasks.length}</em>}
            </button>
          ))}
        </div>
      )}

      <div className="panel" style={{ padding: 18 }}>
        <div className="row-between" style={{ marginBottom: 4 }}>
          <div className="eyebrow">Who's on what</div>
          <button className="btn sm" onClick={() => setAddingTo(card.project._id)}>
            <Icon.plus size={13} /> Task
          </button>
        </div>
        {card.tasks.length === 0 ? (
          <div className="muted" style={{ fontSize: 13 }}>Nothing open on this project.</div>
        ) : (
          card.tasks.map((t) => {
            const d = dueLabel(t.dueDate)
            return (
              <div className="task" key={t._id}>
                <Avatar user={t.assignee} />
                <div className="body">
                  <div className="t">{t.title}</div>
                  <div className="m">
                    {t.assignee?.name || 'unassigned'} · {t.state.replace('_', ' ')}
                    {t.daysOnTask != null && ` · day ${t.daysOnTask}`}
                  </div>
                </div>
                {t.daysOnTask >= 3 && <Tag tone="amber">stalled</Tag>}
                {d && <Tag tone={d.tone}>{d.text}</Tag>}
              </div>
            )
          })
        )}

        <div className="eyebrow" style={{ margin: "18px 0 8px" }}>Blocked on</div>
        <BlockerLane label="client" rows={card.blockers.waitingOnClient} tone="blue" />
        <BlockerLane label="on me" rows={card.blockers.waitingOnMe} tone="red" />
        {!card.blockers.waitingOnClient.length && !card.blockers.waitingOnMe.length && (
          <div className="muted" style={{ fontSize: 13 }}>Nothing blocked.</div>
        )}

        <div className="eyebrow" style={{ margin: "18px 0 8px" }}>Say what changed</div>
        <Mic
          source="standup"
          project={card.project._id}
          hint="Updates, blockers, what you owe them — all in one go."
          onCapture={(c) => setCaptures((prev) => ({ ...prev, [card.project._id]: c }))}
        />
        <CaptureChips
          capture={captures[card.project._id]}
          onChange={(c) => setCaptures((prev) => ({ ...prev, [card.project._id]: c }))}
        />
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
        <button className="btn ghost" disabled={!i} onClick={() => setI(i - 1)}><Icon.back size={15} /> Back</button>
        <button className="btn ghost" onClick={next} title="Nothing to say about this one">Skip</button>
        <button className="btn primary" style={{ flex: 1 }} onClick={next}>
          {i === cards.length - 1 ? 'Finish & build digest' : <>Next project <Icon.arrow size={15} /></>}
        </button>
      </div>
      {addingTo && (
        <QuickTask
          project={addingTo}
          onClose={() => setAddingTo(null)}
          onDone={() => api.standupToday().then(setData)}
        />
      )}
    </div>
  )
}

function BlockerLane({ label, rows, tone }) {
  if (!rows.length) return null
  return (
    <div style={{ marginBottom: 6 }}>
      {rows.map((b) => (
        <div className="task" key={b._id}>
          <Tag tone={tone}>{label}</Tag>
          <div className="body">
            <div className="t">{b.title || b.item}</div>
            <div className="m">
              {b.waitingOnLabel || b.assignee?.name || '—'}
              {b.daysOnTask != null && ` · ${b.daysOnTask}d open`}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

/** The payback. This is what paper never gave him. */
function Digest({ digest, copied, setCopied }) {
  const copy = async () => {
    await navigator.clipboard.writeText(digest.text || '')
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }
  return (
    <div>
      <div className="page-head">
        <h1>Standup done</h1>
        <button className="btn primary" onClick={copy}>{copied ? <><Icon.check size={14} /> Copied</> : 'Copy for Slack'}</button>
      </div>

      <Lane title="Ask from" rows={digest.askFrom} render={(a) => `${a.who} — ${a.item}`} tone="blue" />
      <Lane title="I owe" rows={digest.iOwe} render={(a) => `${a.item}${a.who ? ` (${a.who})` : ''}`} tone="red" />
      <Lane title="At risk" rows={digest.atRisk} render={(a) => `${a.what} — ${a.why}`} tone="amber" />

      <a href="#/" className="btn wide" style={{ marginTop: 16 }}>Back to Today</a>
    </div>
  )
}

function Lane({ title, rows = [], render, tone }) {
  return (
    <>
      <div className="eyebrow" style={{ margin: "18px 0 8px" }}>{title} · {rows.length}</div>
      {rows.length === 0 ? (
        <div className="muted" style={{ fontSize: 13, paddingBottom: 6 }}>Clear.</div>
      ) : (
        <div className="stack" style={{ gap: 2 }}>
          {rows.map((row, n) => (
            <div className="task" key={n}>
              <Tag tone={tone}>{row.project || '—'}</Tag>
              <div className="body"><div className="t">{render(row)}</div></div>
            </div>
          ))}
        </div>
      )}
    </>
  )
}
