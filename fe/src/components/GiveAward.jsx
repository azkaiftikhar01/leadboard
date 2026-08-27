import { useEffect, useState } from 'react'
import { api } from '../lib/api.js'
import { Avatar, Modal, Icon } from './ui.jsx'

/**
 * Handing out an award has to cost about as much as saying it out loud, or he
 * will just say it out loud and the record will stay empty. Two taps: who, then
 * which. The note is optional and almost always skipped.
 */
export function GiveAward({ preset, onClose, onDone }) {
  const [people, setPeople] = useState([])
  const [types, setTypes] = useState([])
  const [who, setWho] = useState(preset?.subject || null)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(null)
  const [tone, setTone] = useState('praise')

  useEffect(() => {
    Promise.all([api.people(), api.awardTypes()]).then(([u, t]) => {
      setPeople(u.filter((p) => p.role === 'dev'))
      setTypes(t)
    })
  }, [])

  const give = async (kind) => {
    if (!who) return
    setBusy(kind)
    try {
      await api.giveAward({ subject: who, kind, note: note.trim(), project: preset?.project, task: preset?.task })
      onDone?.()
      onClose()
    } finally { setBusy(null) }
  }

  const shown = types.filter((t) => t.tone === tone)

  return (
    <Modal
      title="Log what you saw"
      sub="Goes straight onto their record. You can undo it from the scoreboard."
      onClose={onClose}
      wide
    >
      <div>
        <div className="eyebrow" style={{ marginBottom: 10 }}>Who</div>
        <div className="who-row">
          {people.map((p) => (
            <button
              key={p._id}
              className={`who${String(who) === String(p._id) ? ' on' : ''}`}
              onClick={() => setWho(p._id)}
            >
              <Avatar user={p} size={40} />
              <span>{p.name}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="seg" style={{ alignSelf: 'flex-start' }}>
        <button className={tone === 'praise' ? 'on' : ''} onClick={() => setTone('praise')}>Well done</button>
        <button className={tone === 'ding' ? 'on' : ''} onClick={() => setTone('ding')}>Needs saying</button>
      </div>

      <div className="award-grid">
        {shown.map((t) => {
          const I = Icon[t.icon] || Icon.spark
          return (
            <button
              key={t.key}
              className={`award ${t.tone}`}
              disabled={!who || Boolean(busy)}
              onClick={() => give(t.key)}
            >
              <span className="award-ico"><I size={19} /></span>
              <span className="award-body">
                <b>{t.label}</b>
                <i>{t.blurb}</i>
              </span>
              <span className="award-pts">{t.points > 0 ? `+${t.points}` : t.points}</span>
            </button>
          )
        })}
      </div>

      <input
        type="text" value={note} placeholder="Add a line of context (optional)"
        onChange={(e) => setNote(e.target.value)}
      />
    </Modal>
  )
}
