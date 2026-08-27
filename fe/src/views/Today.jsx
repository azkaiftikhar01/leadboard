import { useEffect, useState } from 'react'
import { api } from '../lib/api.js'
import { Mic } from '../components/Mic.jsx'
import { CaptureChips } from '../components/CaptureChips.jsx'
import { Avatar, Streak, Empty, Pill, dayLabel } from '../components/bits.jsx'

/** The tray popover. Most days this is the only surface he touches. */
export function Today({ compact = true }) {
  const [data, setData] = useState(null)
  const [capture, setCapture] = useState(null)
  const [err, setErr] = useState(null)

  const load = () => api.today().then(setData).catch((e) => setErr(e.message))
  useEffect(() => { load() }, [])

  const clear = async (id) => {
    await api.clearBlocker(id)
    load()
  }

  if (err) return <div className="err">{err} — is the API running on :4000?</div>
  if (!data) return <div className="empty">…</div>

  return (
    <div>
      <div className="topbar drag">
        <h1>Today</h1>
        <span className="no-drag"><Streak count={data.streak} /></span>
      </div>

      {!data.standupDone && (
        <a href="#/standup" className="btn primary wide no-drag" style={{ marginBottom: 12 }}>
          Start standup →
        </a>
      )}

      <Mic source={compact ? 'popover' : 'window'} onCapture={setCapture} />
      {capture && <CaptureChips capture={capture} onChange={(c) => { setCapture(c); load() }} />}

      {/* the lane leads forget, put first on purpose */}
      <div className="section-title">Waiting on me · {data.owed.length}</div>
      {data.owed.length === 0 ? (
        <Empty>Nothing is stuck on you.</Empty>
      ) : (
        <div className="card tight">
          {data.owed.map((b) => (
            <div className="row" key={b._id}>
              <div className="dot" style={{ background: b.ageHours > 24 ? 'var(--bad)' : 'var(--warn)' }} />
              <div className="grow">
                <div className="title">{b.item}</div>
                <div className="sub">
                  {b.project?.name || '—'} · open {Math.max(1, Math.round(b.ageHours / 24))}d
                </div>
              </div>
              <button className="btn sm" onClick={() => clear(b._id)}>Cleared</button>
            </div>
          ))}
        </div>
      )}

      <div className="section-title">Due soon</div>
      {data.dueSoon.length === 0 ? (
        <Empty icon="○">Nothing lands in the next 3 days.</Empty>
      ) : (
        <div className="card tight">
          {data.dueSoon.map((t) => {
            const d = dayLabel(t.dueDate)
            return (
              <div className="row" key={t._id}>
                <Avatar user={t.assignee} />
                <div className="grow">
                  <div className="title">{t.title}</div>
                  <div className="sub">{t.project?.name}</div>
                </div>
                {d && <Pill tone={d.tone}>{d.text}</Pill>}
              </div>
            )
          })}
        </div>
      )}

      {data.stale.length > 0 && (
        <>
          <div className="section-title">Sitting too long</div>
          <div className="card tight">
            {data.stale.map((t) => (
              <div className="row" key={t._id}>
                <Avatar user={t.assignee} />
                <div className="grow">
                  <div className="title">{t.title}</div>
                  <div className="sub">{t.project?.name}</div>
                </div>
                <Pill tone="amber">{t.daysOnTask}d</Pill>
              </div>
            ))}
          </div>
        </>
      )}

      {data.inboxCount > 0 && (
        <a href="#/inbox" className="btn wide" style={{ marginTop: 12 }}>
          Inbox · {data.inboxCount} to place
        </a>
      )}
    </div>
  )
}
