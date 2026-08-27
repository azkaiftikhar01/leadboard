import Anthropic from '@anthropic-ai/sdk'
import { z } from 'zod'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'

const MODEL = 'claude-opus-5'

const client = new Anthropic()

const nullableString = z.string().nullable()

/**
 * The parser returns *names as spoken*, never ids. Resolution to real records
 * happens in resolve.js, where anything ambiguous is marked unresolved and sent
 * to Inbox instead of being guessed. The model is good at hearing intent and
 * bad at knowing which of two people called Ali was meant.
 */
const ParsedCapture = z.object({
  tasks: z.array(
    z.object({
      title: z.string(),
      assigneeName: nullableString,
      projectName: nullableString,
      dueDate: nullableString, // YYYY-MM-DD
      priority: z.enum(['low', 'normal', 'high', 'urgent']).nullable(),
    })
  ),
  statusUpdates: z.array(
    z.object({
      taskHint: z.string(),
      assigneeName: nullableString,
      projectName: nullableString,
      newState: z.enum(['in_progress', 'submitted', 'in_review', 'done', 'dropped']).nullable(),
      note: nullableString,
    })
  ),
  blockers: z.array(
    z.object({
      item: z.string(),
      taskHint: nullableString,
      projectName: nullableString,
      blockedPersonName: nullableString,
      waitingOnName: nullableString,
      type: z.enum(['waiting_on_dev', 'waiting_on_client', 'waiting_on_me']),
    })
  ),
  owed: z.array(
    z.object({
      toName: nullableString,
      item: z.string(),
      projectName: nullableString,
      dueDate: nullableString,
    })
  ),
  notes: z.array(
    z.object({
      body: z.string(),
      refName: nullableString,
    })
  ),
})

const SYSTEM = `You turn a team lead's spoken standup rambling into structured work items.

He talks fast, out of order, and in fragments. Extract only what he actually said.
Never invent a task, a deadline, or an assignee to make the output look complete -
an empty array is the correct answer when he did not mention that kind of thing.

Rules:
- Return people and projects by the name he spoke. Do not normalise or correct them.
- "I owe", "I need to send", "I have to get them" -> owed, and the matching blocker
  is type waiting_on_me.
- One dev waiting on another dev -> waiting_on_dev. Waiting on the client or on
  external sign-off -> waiting_on_client.
- A task he describes as already underway is a task plus a statusUpdate of in_progress.
- Relative dates ("thursday", "end of week", "tomorrow") resolve against the current
  date given in the user message. Output YYYY-MM-DD or null.
- If he is only recording a thought with no owner or action, it is a note.`

export async function parseTranscript(transcript, { people = [], projects = [], today }) {
  if (!transcript?.trim()) return { empty: true, ...emptyResult() }

  const roster = [
    `Today: ${today}`,
    `Team: ${people.map((p) => p.name).join(', ') || '(none on file)'}`,
    `Projects: ${projects.map((p) => p.name).join(', ') || '(none on file)'}`,
  ].join('\n')

  const response = await client.messages.parse({
    model: MODEL,
    max_tokens: 8000,
    system: SYSTEM,
    output_config: {
      format: zodOutputFormat(ParsedCapture),
      effort: 'medium',
    },
    messages: [
      { role: 'user', content: `${roster}\n\nTranscript:\n"""\n${transcript.trim()}\n"""` },
    ],
  })

  if (response.stop_reason === 'refusal') {
    throw new Error(`parse refused: ${response.stop_details?.category ?? 'unknown'}`)
  }

  return response.parsed_output ?? emptyResult()
}

function emptyResult() {
  return { tasks: [], statusUpdates: [], blockers: [], owed: [], notes: [] }
}
