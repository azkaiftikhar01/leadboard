/**
 * Zero-dependency parser. No key, no model, no network.
 *
 * This works better than it sounds because the grammar is tiny and closed: the
 * people and projects are a known list, and a lead's standup speech uses maybe a
 * dozen verb patterns. It will not catch everything - but every item it produces
 * is a confirm-chip he can reject in one tap, so a miss costs a tap, not trust.
 * The Ollama and Claude parsers are drop-in upgrades over the same interface.
 */

const OWED =
  /\bi\s+(?:still\s+)?owe\b|\bi(?:'?ll|'?ve)?\s+(?:need to|have to|gotta|should|must)\s+(?:send|give|share|get|hand|pass|provide|write|set ?up|sort)\b|\bfrom my end\b|\bon me\b/i
const BLOCKED = /\b(?:blocked|stuck|waiting (?:on|for)|held up|hung up|can'?t (?:proceed|move|start|continue)|pending)\b/i
const DONE = /\b(?:done|finished|completed|shipped|delivered|wrapped(?: up)?|closed(?: out)?|landed)\b/i
const SUBMITTED = /\b(?:submitted|sent (?:it )?for review|ready for review|up for review|raised (?:a )?pr|opened (?:a )?pr)\b/i
const PROGRESS = /\b(?:working on|is on|are on|started|starting|picking up|picked up|doing|mid(?:way)? through|halfway)\b/i
const ASSIGN = /\b(?:needs? to|should|will|is going to|has to|put \w+ on|give \w+|assign(?:ed)?|take|handle|pick up)\b/i

const CLIENT_WORDS = /\b(?:client|customer|stakeholder|their side)\b/i
const SELF_WORDS = /\b(?:me|myself|my end)\b/i

const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const iso = (d) => d.toISOString().slice(0, 10)

/* ---------------- dates ---------------- */
function extractDate(text, today) {
  const base = new Date(`${today}T12:00:00Z`)
  const lower = text.toLowerCase()
  const hit = (re) => lower.match(re)

  const todayM = hit(/\b(?:today|eod|end of day|tonight)\b/)
  if (todayM) return { date: iso(base), match: todayM[0] }
  if (hit(/\btomorrow\b/)) return { date: iso(new Date(base.getTime() + 86_400_000)), match: 'tomorrow' }

  const inDays = hit(/\bin (\d+) days?\b/)
  if (inDays) return { date: iso(new Date(base.getTime() + Number(inDays[1]) * 86_400_000)), match: inDays[0] }

  const eow = hit(/\b(?:end of (?:the )?week|eow)\b/)
  if (eow) return { date: iso(nextWeekday(base, 5)), match: eow[0] }

  const nextWeek = hit(/\bnext week\b/)
  if (nextWeek) return { date: iso(nextWeekday(new Date(base.getTime() + 7 * 86_400_000), 1)), match: 'next week' }

  for (let i = 0; i < 7; i++) {
    const m = hit(new RegExp(`\\b(?:by |on |before )?(?:next )?${WEEKDAYS[i]}\\b`))
    if (m) return { date: iso(nextWeekday(base, i)), match: m[0] }
  }
  return null
}

function nextWeekday(from, target) {
  const d = new Date(from)
  const delta = (target - d.getUTCDay() + 7) % 7
  d.setUTCDate(d.getUTCDate() + (delta === 0 ? 7 : delta))
  return d
}

/* ---------------- roster matching ---------------- */
function findAll(text, records) {
  const found = []
  for (const r of records) {
    const names = [r.name, ...(r.aliases || [])].filter(Boolean)
    for (const n of names) {
      const m = text.match(new RegExp(`\\b${esc(n)}(?:'s)?\\b`, 'i'))
      if (m) { found.push({ record: r, matched: m[0], index: m.index }); break }
    }
  }
  return found.sort((a, b) => a.index - b.index)
}

/* ---------------- title cleanup ---------------- */
const FILLER = /\b(?:is|are|was|were|has|have|had|will|would|should|needs? to|gonna|going to|still|also|just|basically|like|really|actually)\b/gi
const CONNECTORS =
  /\b(?:working on|is on|blocked on|stuck on|waiting on|waiting for|owe|owes|send|give|the|a|an|to|for|by|on|and|but|then|from|his|her|their|my|our|him|them|he|she|they|we|it|that|this|of|i|s|re|ve|ll|m|t|d)\b/gi

function cleanTitle(clause, strip) {
  let t = clause.replace(/['\u2019]/g, ' ')
  for (const s of strip.filter(Boolean)) t = t.replace(new RegExp(esc(s), 'ig'), ' ')
  return t.replace(FILLER, ' ').replace(CONNECTORS, ' ').replace(/[^\w\s/&+-]/g, ' ').replace(/\s+/g, ' ').trim()
}

/* ---------------- main ---------------- */

const PRONOUN = /\b(?:he|she|they|him|her|them|his|their)\b/i

/** Speech strings clauses together with commas, so the splitter has to know the
 *  roster: "sara submitted X, asad should pick up Y" is two clauses, not one. */
function splitClauses(transcript, names) {
  const alt = names.filter(Boolean).map(esc).join('|')
  const re = new RegExp(
    `(?:[.;!?\n]+|,\\s*(?=(?:and |but )?(?:also|then|plus|he|she|they|we|i|it${alt ? `|${alt}` : ''})\\b)|\\s+(?:and then|also,?|plus)\\s+)`,
    'i'
  )
  return transcript.split(re).map((c) => c.trim()).filter((c) => c.length > 2)
}

export function parseHeuristic(transcript, { people = [], projects = [], today }) {
  const out = { tasks: [], statusUpdates: [], blockers: [], owed: [], notes: [] }
  const devs = people.filter((p) => p.role !== 'lead')
  const names = devs.flatMap((p) => [p.name, ...(p.aliases || [])])
  const clauses = splitClauses(transcript, names)

  // a project named once early usually governs the clauses that follow, and
  // "he" almost always means the last person named
  let stickyProject = null
  let lastSubject = null

  // a verb marks where the subject ends: anyone named before it is doing the
  // thing, anyone named after it is being waited on or handed to
  const verbIndex = (c) => {
    const hits = [BLOCKED, PROGRESS, ASSIGN, OWED, DONE, SUBMITTED]
      .map((re) => c.search(re))
      .filter((i) => i >= 0)
    return hits.length ? Math.min(...hits) : c.length
  }

  for (const clause of clauses) {
    const persons = findAll(clause, devs)
    const projs = findAll(clause, projects)
    const when = extractDate(clause, today)

    if (projs.length) stickyProject = projs[0].record
    const projectName = projs[0]?.record.name ?? stickyProject?.name ?? null
    const projectInferred = !projs.length && Boolean(stickyProject)

    // resolve "he/she/they" back to the last clause subject
    const vIdx = verbIndex(clause)
    const namedSubject = persons.find((p) => p.index < vIdx)?.record ?? null
    const pronounIdx = clause.search(PRONOUN)
    const usesPronoun = pronounIdx >= 0 && (!namedSubject || pronounIdx < persons[0].index)
    const antecedent = !namedSubject && usesPronoun ? lastSubject : null
    if (namedSubject) lastSubject = namedSubject

    const strip = [...projs.map((p) => p.matched), when?.match]
    const subject = namedSubject?.name ?? antecedent?.name ?? null
    const subjectInferred = !namedSubject && Boolean(antecedent)

    // "I owe X the Y" first - it also contains a person mention, so order matters
    if (OWED.test(clause)) {
      out.owed.push({
        toName: persons[0]?.record.name ?? antecedent?.name ?? null,
        toInferred: !persons.length && Boolean(antecedent),
        item: cleanTitle(clause, [...strip, ...persons.map((p) => p.matched)]) || clause,
        projectName,
        projectInferred,
        dueDate: when?.date ?? null,
      })
      continue
    }

    if (BLOCKED.test(clause)) {
      // whoever is named *after* the blocking verb is who we are waiting on
      const bIdx = clause.search(BLOCKED)
      const waitingOn = persons.find((p) => p.index > bIdx) ?? null
      const blockedPerson = persons.find((p) => p.index < bIdx)?.record ?? antecedent ?? null
      const tail = clause.slice(bIdx).split(/,/)[0]

      const type = waitingOn
        ? 'waiting_on_dev'
        : SELF_WORDS.test(tail)
          ? 'waiting_on_me'
          : CLIENT_WORDS.test(tail)
            ? 'waiting_on_client'
            : 'waiting_on_dev'

      out.blockers.push({
        item: cleanTitle(tail, [...strip, waitingOn?.matched]) || tail,
        taskHint: cleanTitle(clause.slice(0, bIdx), [persons[0]?.matched, ...strip]) || null,
        projectName,
        projectInferred,
        blockedPersonName: blockedPerson?.name ?? null,
        blockedPersonInferred: !persons.some((p) => p.index < bIdx) && Boolean(blockedPerson),
        waitingOnName: waitingOn?.record.name ?? (CLIENT_WORDS.test(tail) ? 'client' : null),
        type,
      })
      continue
    }

    const state = DONE.test(clause)
      ? 'done'
      : SUBMITTED.test(clause)
        ? 'submitted'
        : PROGRESS.test(clause)
          ? 'in_progress'
          : null

    const title = cleanTitle(clause, [...strip, ...persons.map((p) => p.matched)])

    if (state) {
      out.statusUpdates.push({ taskHint: title || clause, assigneeName: subject, projectName, projectInferred, newState: state, note: null, assigneeInferred: subjectInferred })
      // "asad is working on the grid fix" is both an update and, if the task is
      // new, the task itself - the lead confirms which he meant
      if (state === 'in_progress' && subject && title) {
        out.tasks.push({ title, assigneeName: subject, assigneeInferred: subjectInferred, projectName, projectInferred, dueDate: when?.date ?? null, priority: null })
      }
      continue
    }

    if (subject && (ASSIGN.test(clause) || when) && title) {
      out.tasks.push({
        title,
        assigneeName: subject,
        assigneeInferred: subjectInferred,
        projectName,
        projectInferred,
        dueDate: when?.date ?? null,
        priority: /\b(?:urgent|asap|critical|right away)\b/i.test(clause) ? 'urgent' : null,
      })
      continue
    }

    if (clause.split(/\s+/).length >= 4) out.notes.push({ body: clause, refName: subject ?? projectName })
  }

  return out
}
