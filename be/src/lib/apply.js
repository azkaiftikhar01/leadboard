import Task from '../models/Task.js'
import Note from '../models/Note.js'

/**
 * Applies one confirmed card. Called only after the lead taps accept - nothing
 * here ever runs automatically, because a system that creates things he did not
 * watch it create is a system he stops trusting.
 */
export async function applyCard(card, { leadId, captureId }) {
  const p = card.payload

  if (card.kind === 'task') {
    const task = await Task.create({
      project: p.project,
      assignee: p.assignee,
      track: 'team',
      title: p.title,
      dueDate: p.dueDate ? new Date(p.dueDate) : undefined,
      priority: p.priority || 'normal',
      state: 'assigned',
      createdFromCapture: captureId,
      history: [{ from: null, to: 'assigned', by: leadId }],
    })
    return { ref: task._id, model: 'Task' }
  }

  if (card.kind === 'status') {
    const task = await Task.findById(p.task)
    if (!task) throw new Error('status card has no resolved task')
    return transitionTask(task, p.newState, { by: leadId, note: p.note })
  }

  // a blocker is a task on whoever we are waiting on - same list, same tick.
  // One place to look beats three concepts he has to remember to check.
  if (card.kind === 'blocker') {
    const track = p.type === 'waiting_on_client' ? 'client' : p.type === 'waiting_on_me' ? 'lead' : 'team'
    const task = await Task.create({
      project: p.project,
      assignee: track === 'team' ? p.waitingOn : null,
      track,
      title: p.item,
      waitingOnLabel: track === 'team' ? '' : p.waitingOnLabel || 'client',
      state: 'assigned',
      createdFromCapture: captureId,
      history: [{ from: null, to: 'assigned', by: leadId }],
    })
    return { ref: task._id, model: 'Task' }
  }

  if (card.kind === 'owed') {
    const task = await Task.create({
      project: p.project,
      track: 'lead',
      title: p.item,
      waitingOnLabel: p.toSpoken ? `for ${p.toSpoken}` : '',
      dueDate: p.dueDate ? new Date(p.dueDate) : undefined,
      state: 'assigned',
      createdFromCapture: captureId,
      history: [{ from: null, to: 'assigned', by: leadId }],
    })
    return { ref: task._id, model: 'Task' }
  }

  if (card.kind === 'note') {
    const note = await Note.create({
      body: p.body,
      source: 'voice',
      refType: p.refType || 'none',
      refId: p.refId,
      capture: captureId,
    })
    return { ref: note._id, model: 'Note' }
  }

  throw new Error(`unknown card kind: ${card.kind}`)
}

export async function transitionTask(task, to, { by, note } = {}) {
  const from = task.state
  task.state = to
  if (to === 'in_progress' && !task.startedAt) task.startedAt = new Date()
  if (to === 'done') task.doneAt = new Date()
  if (from === 'done' && to !== 'done') task.doneAt = undefined
  task.history.push({ from, to, by, note })
  await task.save()
  return { ref: task._id, model: 'Task', from, to }
}
