import { Icon } from '../components/ui.jsx'

/**
 * First run. The database is empty on purpose — no fake devs, no fake projects —
 * so this says what to do in the order it has to happen, and gets out of the way
 * the moment there is one real project.
 */
export function Start({ counts, onGo }) {
  const steps = [
    { k: 'team', n: 1, done: counts.people > 0, label: 'Add your devs',
      hint: 'Their name is also how the mic recognises them when you talk.', to: '#/team' },
    { k: 'projects', n: 2, done: counts.projects > 0, label: 'Create projects and set the mode',
      hint: 'Development, support or maintenance — it decides how much of a week each one costs.', to: '#/projects' },
    { k: 'assign', n: 3, done: counts.assigned > 0, label: 'Put people on them',
      hint: 'Then the load board tells you who actually has room.', to: '#/projects' },
  ]
  const next = steps.find((s) => !s.done)

  return (
    <>
      <div className="hero" style={{ marginBottom: 22 }}>
        <h1>Let’s set it up</h1>
        <div style={{ opacity: .88, marginTop: 8, fontSize: 14.5, maxWidth: 520 }}>
          Nothing in here is made up — it starts empty so the first thing you type is real.
          Three steps and the day board starts working.
        </div>
      </div>

      <div className="panel">
        <div className="panel-body">
          {steps.map((s) => (
            <div className={`step${s.done ? ' done' : ''}`} key={s.k}>
              <span className="n">{s.done ? <Icon.check size={14} /> : s.n}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{s.label}</div>
                <div className="dim" style={{ fontSize: 12.5, marginTop: 2 }}>{s.hint}</div>
              </div>
              {!s.done && next?.k === s.k && (
                <button className="btn primary sm" onClick={() => onGo(s.to)}>
                  Start <Icon.arrow size={13} />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
