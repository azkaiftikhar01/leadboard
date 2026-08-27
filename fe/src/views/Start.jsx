import { Icon, Mark, Identicon } from '../components/ui.jsx'

/**
 * First run. The database is empty on purpose, so this screen has one job:
 * make the empty state feel like a beginning rather than a broken page.
 *
 * It does that by *showing* what each step unlocks - a real load dial, real
 * track cards, real avatars - floating just behind the instructions. He can see
 * what he is building toward before he has typed anything.
 */
const STEPS = [
  {
    k: 'team', n: 1, to: '#/team',
    label: 'Add your devs',
    hint: 'Their name is how the mic knows them when you talk.',
    art: 'people',
  },
  {
    k: 'projects', n: 2, to: '#/projects',
    label: 'Create projects',
    hint: 'Development, support or maintenance — the mode decides how much of a week it costs.',
    art: 'modes',
  },
  {
    k: 'assign', n: 3, to: '#/projects',
    label: 'Put people on them',
    hint: 'Then the board tells you who actually has room.',
    art: 'load',
  },
]

export function Start({ counts, onGo }) {
  const done = { team: counts.people > 0, projects: counts.projects > 0, assign: counts.assigned > 0 }
  const doneCount = Object.values(done).filter(Boolean).length
  const next = STEPS.find((s) => !done[s.k])

  return (
    <div className="start">
      <header className="start-head">
        <h1 className="start-title"><span className="g-text">Let’s set it up</span></h1>
        <p className="start-lead">
          It starts empty on purpose — so the first thing you type is real.
          <br />Three steps and the day board comes alive.
        </p>
        <div className="start-progress">
          <span className="bar"><i style={{ width: `${(doneCount / 3) * 100}%` }} /></span>
          <span className="num dim">{doneCount} of 3</span>
        </div>
      </header>

      <div className="start-grid">
        {STEPS.map((s, i) => (
          <article
            key={s.k}
            className={`step-card${done[s.k] ? ' done' : ''}${next?.k === s.k ? ' next' : ''}`}
            style={{ animationDelay: `${i * 90}ms` }}
            onClick={() => onGo(s.to)}
          >
            <div className="step-badge">
              {done[s.k] ? <Icon.check size={15} /> : s.n}
            </div>

            <div className="step-art"><StepArt kind={s.art} /></div>

            <h3>{s.label}</h3>
            <p>{s.hint}</p>

            {next?.k === s.k && (
              <span className="step-go"><span>Start <Icon.arrow size={14} /></span></span>
            )}
            {done[s.k] && <span className="step-done">Done</span>}
          </article>
        ))}
      </div>

      <footer className="start-foot">
        <Mark size={26} id="start-mark" />
        <span>
          Or just hit the mic and talk — anything it can’t place waits in your Inbox.
        </span>
      </footer>
    </div>
  )
}

/** Small live previews of what each step unlocks. Real components, not pictures. */
function StepArt({ kind }) {
  if (kind === 'people') {
    return (
      <div className="art-people">
        {['Aisha', 'Omar', 'Rina', 'Kai'].map((n, i) => (
          <span key={n} style={{ animationDelay: `${i * 120}ms` }}>
            <Identicon name={n} size={38} rounded={12} />
          </span>
        ))}
      </div>
    )
  }

  if (kind === 'modes') {
    return (
      <div className="art-modes">
        {[
          { l: 'Development', w: '×1', c: 'var(--g-deep)' },
          { l: 'Support', w: '×0.45', c: 'linear-gradient(135deg,#A8446F,#7A3B7E)' },
          { l: 'Maintenance', w: '×0.25', c: 'linear-gradient(135deg,#B9A0C4,#8E7BA0)' },
        ].map((m, i) => (
          <span key={m.l} style={{ animationDelay: `${i * 110}ms` }}>
            <i style={{ background: m.c }} />
            {m.l}
            <b>{m.w}</b>
          </span>
        ))}
      </div>
    )
  }

  // a load dial mid-sweep, which is the payoff of the whole setup
  const pct = 62
  const r = 26
  const circ = 2 * Math.PI * r
  return (
    <div className="art-load">
      <svg width="66" height="66" viewBox="0 0 66 66">
        <defs>
          <linearGradient id="sg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#E57A44" /><stop offset="100%" stopColor="#A8446F" />
          </linearGradient>
        </defs>
        <circle cx="33" cy="33" r={r} fill="none" stroke="var(--s-3)" strokeWidth="6" />
        <circle
          cx="33" cy="33" r={r} fill="none" stroke="url(#sg)" strokeWidth="6" strokeLinecap="round"
          strokeDasharray={circ} strokeDashoffset={circ - (pct / 100) * circ}
          transform="rotate(-90 33 33)" className="art-sweep"
        />
      </svg>
      <span className="art-load-tag">has room</span>
    </div>
  )
}
