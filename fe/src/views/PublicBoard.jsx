import { useCallback, useEffect, useState } from 'react'
import { Icon } from '../components/ui.jsx'

const BASE = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:4000/api' : '/api')

const due = (d) => {
  if (!d) return null
  const days = Math.round((new Date(d).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0)) / 86_400_000)
  if (days < 0) return { t: `${-days}d late`, tone: 'red' }
  if (days === 0) return { t: 'today', tone: 'red' }
  if (days === 1) return { t: 'tomorrow', tone: 'amber' }
  if (days <= 3) return { t: `${days} days`, tone: 'amber' }
  return { t: `${days} days`, tone: '' }
}

/**
 * Somebody else's to-do list, opened from a link.
 *
 * No account, no passphrase, no dock - a dev following a link from his lead
 * should see what he owes and be able to tick it off, and nothing else. There
 * is deliberately no scoreboard, no load, and no sign of anyone else's record
 * on this page.
 */
export function PublicBoard({ token }) {
  const [data, setData] = useState(null)
  const [err, setErr] = useState(null)
  const [busy, setBusy] = useState(null)

  const load = useCallback(() => {
    fetch(`${BASE}/public/board/${encodeURIComponent(token)}`)
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'Link not found')
        return r.json()
      })
      .then(setData)
      .catch((e) => setErr(e.message))
  }, [token])

  useEffect(() => { load() }, [load])

  const toggle = async (t) => {
    if (!data.canComplete) return
    setBusy(t._id)
    try {
      await fetch(`${BASE}/public/board/${encodeURIComponent(token)}/tasks/${t._id}/done`, { method: 'POST' })
      load()
    } finally { setBusy(null) }
  }

  if (err) {
    return (
      <div className="pub">
        <div className="pub-card" style={{ textAlign: 'center' }}>
          <img src="/logo-wordmark.png" alt="LeadBoard" className="pub-logo" />
          <p className="muted" style={{ marginTop: 14 }}>{err}</p>
        </div>
      </div>
    )
  }
  if (!data) return <div className="pub"><span className="spinner" /></div>

  return (
    <div className="pub">
      <div className="aura" aria-hidden="true"><b /><b /><b /></div>

      <div className="pub-card">
        <header className="pub-head">
          <img src="/logo-wordmark.png" alt="LeadBoard" className="pub-logo" />
          <h1>{data.title}</h1>
          <p>
            {data.open.length === 0
              ? 'Nothing outstanding. Enjoy it.'
              : `${data.open.length} thing${data.open.length === 1 ? '' : 's'} to do`}
            {data.canComplete && data.open.length > 0 && ' — tick them off as you go'}
          </p>
        </header>

        {data.open.length > 0 && (
          <ul className="pub-list">
            {data.open.map((t) => {
              const d = due(t.dueDate)
              return (
                <li key={t._id} className="pub-item">
                  <button
                    className="tick" disabled={!data.canComplete || busy === t._id}
                    onClick={() => toggle(t)}
                    title={data.canComplete ? 'Mark done' : 'This link is read-only'}
                  >
                    <Icon.check size={13} />
                  </button>
                  <div className="body">
                    <div className="t">{t.title}</div>
                    <div className="m">
                      {t.project?.name && <span>{t.project.name}</span>}
                      {t.assignee?.name && <span>{t.assignee.name}</span>}
                      {d && <span className={`tag ${d.tone}`}>{d.t}</span>}
                      {t.daysOnTask >= 3 && <span className="tag amber">day {t.daysOnTask}</span>}
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        )}

        {data.done.length > 0 && (
          <details className="pub-done">
            <summary>{data.done.length} already done</summary>
            <ul>
              {data.done.map((t) => (
                <li key={t._id}>
                  <Icon.check size={13} /> {t.title}
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>

      <p className="pub-foot">Shared from LeadBoard · this link only shows this list</p>
    </div>
  )
}
