import Task from '../models/Task.js'
import Blocker from '../models/Blocker.js'
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

  if (card.kind === 'blocker') {
    const blocker = await Blocker.create({
      task: p.task,
      project: p.project,
      type: p.type,
      waitingOn: p.waitingOn,
      waitingOnLabel: p.waitingOnLabel,
      item: p.item,
      raisedBy: leadId,
    })
    return { ref: blocker._id, model: 'Blocker' }
  }

  if (card.kind === 'owed') {
    // an owed item is just a blocker pointed at the lead - same lane, same clock
    const blocker = await Blocker.create({
      project: p.project,
      type: 'waiting_on_me',
      waitingOn: leadId,
      waitingOnLabel: p.toSpoken ? `for ${p.toSpoken}` : undefined,
      item: p.item,
      raisedBy: leadId,
    })
    return { ref: blocker._id, model: 'Blocker' }
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
