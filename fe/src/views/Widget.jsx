import { useCallback, useEffect, useState } from 'react'
import { api } from '../lib/api.js'
import { Avatar, Tag, Icon, Spinner, dueLabel } from '../components/ui.jsx'
import { Focus } from '../components/Focus.jsx'
import { Notes } from '../components/Notes.jsx'

const shell = () => (typeof window !== 'undefined' ? window.leadboard : null)

/**
 * A widget is one feature, small enough to leave open beside real work.
 *
 * Everything here assumes it is sitting on top of something else the reader
 * actually cares about: no navigation, no chrome beyond a title bar to drag by,
 * and only the rows that would make him do something.
 */
export function Widget({ kind }) {
  const [pinned, setPinned] = useState(true)

  const togglePin = () => {
    const next = !pinned
    setPinned(next)
    shell()?.pinWidget(next)
  }

  const Body = { tasks: TaskWidget, focus: FocusWidget, notes: NotesWidget }[kind] || TaskWidget
  const title = { tasks: 'On me', focus: 'Focus', notes: 'Notes' }[kind] || 'LeadBoard'

  return (
    <div className="widget">
      <header className="widget-bar drag">
        <span className="widget-dot" />
        <b>{title}</b>
        <span className="grow" />
        <button
          className={`widget-btn no-drag${pinned ? ' on' : ''}`}
          title={pinned ? 'Stays on top — click to let it fall behind' : 'Keep on top'}
          onClick={togglePin}
        >
          <Icon.spark size={13} />
        </button>
        <button className="widget-btn no-drag" title="Open the full board"
          onClick={() => shell()?.openMain('#/')}>
          <Icon.arrow size={13} />
        </button>
        <button className="widget-btn no-drag close" title="Close" onClick={() => shell()?.closeWidget()}>
          <Icon.x size={14} />
        </button>
      </header>

      <div className="widget-body"><Body /></div>
    </div>
  )
}

/* ---------------- tasks ---------------- */

function TaskWidget() {
  const [data, setData] = useState(null)
  const [err, setErr] = useState(null)

  const load = useCallback(() => {
    api.today().then(setData).catch((e) => setErr(e.unauthorized ? 'auth' : e.message))
  }, [])

  useEffect(() => {
    load()
    const t = setInterval(load, 30_000)
    return () => clearInterval(t)
  }, [load])

  const tick = async (task) => {
    setData((d) => ({ ...d, tracks: { ...d.tracks, lead: d.tracks.lead.filter((t) => t._id !== task._id) } }))
    await api.toggleTask(task._id).catch(() => {})
    load()
  }

  if (err === 'auth') {
    return (
      <div className="widget-empty">
        <p>Not signed in.</p>
        <button className="btn primary sm" onClick={() => shell()?.openMain('#/')}>Open the board</button>
      </div>
    )
  }
  if (err) return <div className="widget-empty"><p>{err}</p></div>
  if (!data) return <Spinner />

  const mine = data.tracks.lead
  const soon = data.dueSoon.filter((t) => t.track !== 'lead')

  return (
    <>
      {mine.length === 0 && soon.length === 0 ? (
        <div className="widget-empty">
          <Icon.check size={22} />
          <p>Nothing waiting on you.</p>
        </div>
      ) : (
        <>
          {mine.map((t) => {
            const d = dueLabel(t.dueDate, t.dueHasTime)
            return (
              <div className="widget-row" key={t._id}>
                <button className="tick" onClick={() => tick(t)}><Icon.check size={12} /></button>
                <div className="body">
                  <div className="t">{t.title}</div>
                  <div className="m">
                    {t.waitingOnLabel && <span>{t.waitingOnLabel}</span>}
                    {t.project?.name && <span>· {t.project.name}</span>}
                    {d && <Tag tone={d.tone}>{d.text}</Tag>}
                  </div>
                </div>
              </div>
            )
          })}

          {soon.length > 0 && (
            <>
              <div className="widget-head">Due soon</div>
              {soon.slice(0, 5).map((t) => {
                const d = dueLabel(t.dueDate, t.dueHasTime)
                return (
                  <div className="widget-row muted-row" key={t._id}>
                    {t.assignee ? <Avatar user={t.assignee} size={18} /> : <span className="widget-pip" />}
                    <div className="body">
                      <div className="t">{t.title}</div>
                      <div className="m">
                        {t.assignee?.name && <span>{t.assignee.name}</span>}
                        {d && <Tag tone={d.tone}>{d.text}</Tag>}
                      </div>
                    </div>
                  </div>
                )
              })}
            </>
          )}
        </>
      )}
    </>
  )
}

/* ---------------- focus ---------------- */

function FocusWidget() {
  // Focus is already a full-screen surface; inside a widget it simply fills it
  return <Focus open embedded onClose={() => shell()?.closeWidget()} />
}

/* ---------------- notes ---------------- */

function NotesWidget() {
  return <Notes open embedded onClose={() => shell()?.closeWidget()} />
}
