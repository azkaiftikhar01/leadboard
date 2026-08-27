const HOST = process.env.OLLAMA_HOST || 'http://127.0.0.1:11434'
const MODEL = process.env.OLLAMA_MODEL || 'qwen2.5:7b'

/**
 * Free local upgrade over the heuristic parser. Runs on his own machine, so no
 * key and nothing leaves the laptop. Ollama enforces the JSON schema server-side,
 * which is what makes a 7B model reliable enough for this.
 */
const SCHEMA = {
  type: 'object',
  properties: {
    tasks: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          assigneeName: { type: ['string', 'null'] },
          projectName: { type: ['string', 'null'] },
          dueDate: { type: ['string', 'null'] },
          priority: { type: ['string', 'null'] },
        },
        required: ['title'],
      },
    },
    statusUpdates: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          taskHint: { type: 'string' },
          assigneeName: { type: ['string', 'null'] },
          projectName: { type: ['string', 'null'] },
          newState: { type: ['string', 'null'] },
          note: { type: ['string', 'null'] },
        },
        required: ['taskHint'],
      },
    },
    blockers: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          item: { type: 'string' },
          taskHint: { type: ['string', 'null'] },
          projectName: { type: ['string', 'null'] },
          blockedPersonName: { type: ['string', 'null'] },
          waitingOnName: { type: ['string', 'null'] },
          type: { type: 'string', enum: ['waiting_on_dev', 'waiting_on_client', 'waiting_on_me'] },
        },
        required: ['item', 'type'],
      },
    },
    owed: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          toName: { type: ['string', 'null'] },
          item: { type: 'string' },
          projectName: { type: ['string', 'null'] },
          dueDate: { type: ['string', 'null'] },
        },
        required: ['item'],
      },
    },
    notes: {
      type: 'array',
      items: {
        type: 'object',
        properties: { body: { type: 'string' }, refName: { type: ['string', 'null'] } },
        required: ['body'],
      },
    },
  },
  required: ['tasks', 'statusUpdates', 'blockers', 'owed', 'notes'],
}

const SYSTEM = `You turn a team lead's spoken standup rambling into structured work items.

He talks fast, out of order, and in fragments. Extract only what he actually said.
Never invent a task, a deadline, or an assignee to make the output look complete -
an empty array is the correct answer when he did not mention that kind of thing.

Rules:
- Return people and projects by the name he spoke. Do not normalise or correct them.
- "I owe", "I need to send", "I have to get them" -> owed, type waiting_on_me.
- One dev waiting on another dev -> waiting_on_dev. Waiting on the client -> waiting_on_client.
- A task he describes as underway is a task plus a statusUpdate of in_progress.
- Resolve relative dates against the date given. Output YYYY-MM-DD or null.
- A thought with no owner and no action is a note.`

export async function parseOllama(transcript, { people = [], projects = [], today }) {
  const roster = [
    `Today: ${today}`,
    `Team: ${people.map((p) => p.name).join(', ') || '(none)'}`,
    `Projects: ${projects.map((p) => p.name).join(', ') || '(none)'}`,
  ].join('\n')

  const res = await fetch(`${HOST}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      stream: false,
      format: SCHEMA,
      options: { temperature: 0 },
      messages: [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: `${roster}\n\nTranscript:\n"""\n${transcript.trim()}\n"""` },
      ],
    }),
  })
  if (!res.ok) throw new Error(`ollama ${res.status}: ${await res.text()}`)
  const json = await res.json()
  return JSON.parse(json.message.content)
}
