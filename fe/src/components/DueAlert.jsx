import { Icon } from './ui.jsx'

const when = (t) => {
  const late = Date.now() - new Date(t.dueDate).getTime()
  const mins = Math.round(late / 60_000)
  if (mins < 1) return 'due now'
  if (mins < 60) return `${mins} min late`
  const hrs = Math.round(mins / 60)
  if (hrs < 24) return `${hrs}h late`
  return `${Math.round(hrs / 24)}d late`
}

/**
 * Samsung-style edge lighting, on all four sides of the viewport.
 *
 * It exists for the case a notification cannot cover: he is looking at this tab
 * already, so an OS banner would be a duplicate of something he can see. The
 * glow is peripheral - it catches the eye without taking it off whatever he is
 * reading, and it keeps pulsing until the alert is dealt with rather than
 * flashing once and being missed.
 */
export function EdgeGlow({ on }) {
  if (!on) return null
  return (
    <div className="edge-glow" aria-hidden="true">
      <span className="eg t" /><span className="eg r" />
      <span className="eg b" /><span className="eg l" />
    </div>
  )
}

export function DueAlert({ due, permission, onAsk, onSnooze, onComplete, onDismiss, onDismissAll }) {
  if (!due.length) return null

  return (
    <div className="due-stack" role="alert">
      {due.length > 1 && (
        <div className="due-all">
          <b>{due.length} tasks are due</b>
          <button className="btn ghost sm" onClick={onDismissAll}>Dismiss all</button>
        </div>
      )}

      {due.slice(0, 4).map((t) => (
        <article className="due-card" key={t._id}>
          <span className="due-ico"><Icon.clock size={17} /></span>

          <div className="due-body">
            <div className="due-t">{t.title}</div>
            <div className="due-m">
              <span className="due-when">{when(t)}</span>
              {t.project?.name && <span>· {t.project.name}</span>}
              {t.assignee?.name && <span>· {t.assignee.name}</span>}
            </div>

            <div className="due-acts">
              <button className="btn primary sm" onClick={() => onComplete(t)}>
                <Icon.check size={13} /> Done
              </button>
              <button className="btn sm" onClick={() => onSnooze(t, 10)}>10 min</button>
              <button className="btn sm" onClick={() => onSnooze(t, 60)}>1 hour</button>
              <button className="btn ghost sm" onClick={() => onDismiss(t._id)}>Dismiss</button>
            </div>
          </div>
        </article>
      ))}

      {permission === 'default' && (
        <button className="due-perm" onClick={onAsk}>
          <Icon.warn size={14} />
          Allow notifications so these reach you when this tab isn’t open
        </button>
      )}
    </div>
  )
}
