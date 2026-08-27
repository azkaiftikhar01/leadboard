import { useEffect, useState, useCallback } from 'react'
import { api } from '../lib/api.js'
import { Mic } from '../components/Mic.jsx'
import { CaptureChips } from '../components/CaptureChips.jsx'
import { Avatar, Pill, Empty, dayLabel } from '../components/bits.jsx'

/**
 * The ritual. A pre-filled card stack, never a blank page — a blank page is what
 * the notebook already gave him. Keyboard-driven because he is at a laptop:
 * → next, ← back, Esc out.
 */
export function Standup() {
  const [data, setData] = useState(null)
  const [i, setI] = useState(0)
  const [captures, setCaptures] = useState({})
  const [digest, setDigest] = useState(null)
  const [startedAt] = useState(Date.now())
  const [copied, setCopied] = useState(false)

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

  if (!data) return <div className="empty">…</div>
  if (!cards.length) return <Empty icon="🌤">No active projects yet. Add one on the Board.</Empty>

  if (digest) return <Digest digest={digest} copied={copied} setCopied={setCopied} />

  const card = cards[Math.min(i, cards.length - 1)]
  if (atEnd) return <div className="empty">wrapping up…</div>

  return (
    <div>
      <div className="stack-head">
        <div>
          <h1>{card.project.name}</h1>
          <div className="muted" style={{ fontSize: 13, marginTop: 2 }}>
            {card.project.client} · {i + 1} of {cards.length}
          </div>
        </div>
        <div className="progress">
          {cards.map((_, n) => <i key={n} className={n < i ? 'done' : n === i ? 'on' : ''} />)}
        </div>
      </div>

      <div className="project-card">
        <div className="section-title">Who's on what</div>
        {card.tasks.length === 0 ? (
          <div className="muted" style={{ fontSize: 13 }}>Nothing open on this project.</div>
        ) : (
          card.tasks.map((t) => {
            const d = dayLabel(t.dueDate)
            return (
              <div className="row" key={t._id}>
                <Avatar user={t.assignee} />
                <div className="grow">
                  <div className="title">{t.title}</div>
                  <div className="sub">
                    {t.assignee?.name || 'unassigned'} · {t.state.replace('_', ' ')}
                    {t.daysOnTask != null && ` · day ${t.daysOnTask}`}
                  </div>
                </div>
                {t.daysOnTask >= 3 && <Pill tone="amber">stalled</Pill>}
                {d && <Pill tone={d.tone}>{d.text}</Pill>}
              </div>
            )
          })
        )}

        <div className="section-title">Blocked on</div>
        <BlockerLane label="a dev" rows={card.blockers.waitingOnDev} tone="amber" />
        <BlockerLane label="the client" rows={card.blockers.waitingOnClient} tone="blue" />
        <BlockerLane label="me" rows={card.blockers.waitingOnMe} tone="red" />
        {!card.blockers.waitingOnDev.length &&
          !card.blockers.waitingOnClient.length &&
          !card.blockers.waitingOnMe.length && (
            <div className="muted" style={{ fontSize: 13 }}>Nothing blocked.</div>
          )}

        <div className="section-title">Say what changed</div>
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
        <button className="btn ghost" disabled={!i} onClick={() => setI(i - 1)}>← Back</button>
        <button className="btn primary" style={{ flex: 1 }} onClick={next}>
          {i === cards.length - 1 ? 'Finish & build digest' : 'Next project →'}
        </button>
      </div>
    </div>
  )
}

function BlockerLane({ label, rows, tone }) {
  if (!rows.length) return null
  return (
    <div style={{ marginBottom: 6 }}>
      {rows.map((b) => (
        <div className="row" key={b._id}>
          <Pill tone={tone}>{label}</Pill>
          <div className="grow">
            <div className="title">{b.item}</div>
            <div className="sub">
              {b.waitingOn?.name || b.waitingOnLabel || '—'} · {Math.max(1, Math.round(b.ageHours / 24))}d open
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
      <div className="topbar">
        <h1>🎉 Standup done</h1>
        <button className="btn primary" onClick={copy}>{copied ? 'Copied ✓' : 'Copy for Slack'}</button>
      </div>

      <Lane title="Ask from" rows={digest.askFrom} render={(a) => `${a.who} — ${a.item}`} tone="blue" />
      <Lane title="I owe" rows={digest.iOwe} render={(a) => `${a.item}${a.who ? ` (${a.who})` : ''}`} tone="red" />
      <Lane title="At risk" rows={digest.atRisk} render={(a) => `${a.what} — ${a.why}`} tone="amber" />

      <a href="#/" className="btn wide" style={{ marginTop: 14 }}>Back to Today</a>
    </div>
  )
}

function Lane({ title, rows = [], render, tone }) {
  return (
    <>
      <div className="section-title">{title} · {rows.length}</div>
      {rows.length === 0 ? (
        <div className="muted" style={{ fontSize: 13, paddingBottom: 6 }}>Clear.</div>
      ) : (
        <div className="card tight">
          {rows.map((row, n) => (
            <div className="row" key={n}>
              <Pill tone={tone}>{row.project || '—'}</Pill>
              <div className="grow"><div className="title">{render(row)}</div></div>
            </div>
          ))}
        </div>
      )}
    </>
  )
}
