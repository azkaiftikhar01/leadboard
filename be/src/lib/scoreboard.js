import User from '../models/User.js'
import Award, { AWARDS } from '../models/Award.js'
import ReworkEvent from '../models/ReworkEvent.js'
import Delivery from '../models/Delivery.js'
import { teamLoad } from './load.js'

const DAY = 86_400_000

/**
 * One number per person, and the full arithmetic behind it.
 *
 * Score = what the lead saw (awards) + what the work itself showed (rework
 * attribution). Both halves matter: awards alone become a popularity contest,
 * rework alone misses everything a state machine cannot see.
 *
 * Rework charged to the client still scores positive here, for the same reason
 * it does everywhere else - absorbing churn is work, and a registry that
 * punishes it gets gamed within a month.
 */
export async function scoreboard({ weeks = 12 } = {}) {
  const since = new Date(Date.now() - weeks * 7 * DAY)

  const [people, awards, rework, deliveries, load] = await Promise.all([
    User.find({ active: true, role: 'dev' }).lean(),
    Award.find({ givenAt: { $gte: since } }).lean(),
    ReworkEvent.find({ occurredAt: { $gte: since } }).lean(),
    Delivery.find({ actualDate: { $gte: since } }).lean(),
    teamLoad(),
  ])

  const rows = people.map((user) => {
    const id = String(user._id)
    const mine = awards.filter((a) => String(a.subject) === id)
    const myRework = rework.filter((r) => String(r.subject) === id)
    const myDeliveries = deliveries.filter((d) => String(d.owner) === id)
    const l = load.find((x) => String(x.user._id) === id)

    const praise = mine.filter((a) => a.tone === 'praise')
    const dings = mine.filter((a) => a.tone === 'ding')
    const awardPoints = mine.reduce((s, a) => s + a.points, 0)
    const reworkPoints = myRework.reduce((s, r) => s + r.points, 0)
    const onTime = myDeliveries.filter((d) => (d.varianceDays ?? 0) <= 0).length

    return {
      user: { _id: user._id, name: user.name, title: user.title },
      score: Math.round((awardPoints + reworkPoints) * 10) / 10,
      awardPoints,
      reworkPoints,
      praise: praise.length,
      dings: dings.length,
      // avoidable rework is the number that actually stings - it is the one
      // they could have prevented, as opposed to churn the client caused
      avoidable: myRework.filter((r) => r.attributedTo === 'dev').length,
      absorbed: myRework.filter((r) => r.attributedTo === 'client').length,
      deliveries: myDeliveries.length,
      reliability: myDeliveries.length ? onTime / myDeliveries.length : null,
      loadPercent: l?.loadPercent ?? 0,
      headroom: l?.headroom ?? 0,
      band: l?.band?.key ?? 'free',
      openTasks: l?.openTasks ?? 0,
      streak: praiseStreak(mine),
      recent: mine
        .sort((a, b) => b.givenAt - a.givenAt)
        .slice(0, 6)
        .map((a) => ({ kind: a.kind, tone: a.tone, points: a.points, note: a.note, givenAt: a.givenAt, ...AWARDS[a.kind] })),
    }
  })

  rows.sort((a, b) => b.score - a.score || b.praise - a.praise)
  return rows.map((r, i) => ({ ...r, rank: i + 1 }))
}

/** Consecutive awards with no ding among them - a run worth protecting. */
function praiseStreak(mine) {
  const sorted = [...mine].sort((a, b) => b.givenAt - a.givenAt)
  let n = 0
  for (const a of sorted) {
    if (a.tone !== 'praise') break
    n += 1
  }
  return n
}
