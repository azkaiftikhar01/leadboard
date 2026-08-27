const BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000/api'

async function req(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  })
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || res.statusText)
  return res.json()
}

export const api = {
  today: () => req('/today'),

  // team
  people: () => req('/people'),
  teamLoad: () => req('/people/load/all'),
  available: () => req('/people/load/available'),
  addPerson: (b) => req('/people', { method: 'POST', body: JSON.stringify(b) }),
  patchPerson: (id, b) => req(`/people/${id}`, { method: 'PATCH', body: JSON.stringify(b) }),
  removePerson: (id) => req(`/people/${id}`, { method: 'DELETE' }),
  scorecard: (id) => req(`/people/${id}/scorecard`),
  rework: (id) => req(`/people/${id}/rework`),
  // projects
  projects: () => req('/projects'),
  projectModes: () => req('/projects/modes'),
  addProject: (b) => req('/projects', { method: 'POST', body: JSON.stringify(b) }),
  patchProject: (id, b) => req(`/projects/${id}`, { method: 'PATCH', body: JSON.stringify(b) }),
  archiveProject: (id) => req(`/projects/${id}`, { method: 'DELETE' }),
  setMember: (pid, uid, b) => req(`/projects/${pid}/members/${uid}`, { method: 'PUT', body: JSON.stringify(b) }),
  removeMember: (pid, uid) => req(`/projects/${pid}/members/${uid}`, { method: 'DELETE' }),
  board: (id) => req(`/projects/${id}/board`),
  // tasks
  tasks: (q = '') => req(`/tasks${q}`),
  addTask: (b) => req('/tasks', { method: 'POST', body: JSON.stringify(b) }),
  toggleTask: (id) => req(`/tasks/${id}/toggle`, { method: 'POST', body: JSON.stringify({}) }),
  reviewQueue: () => req('/tasks/review'),
  reopenReasons: () => req('/tasks/reopen-reasons'),
  transition: (id, body) => req(`/tasks/${id}/transition`, { method: 'POST', body: JSON.stringify(body) }),
  reopen: (id, body) => req(`/tasks/${id}/reopen`, { method: 'POST', body: JSON.stringify(body) }),
  blockers: (type) => req(`/blockers${type ? `?type=${type}` : ''}`),
  clearBlocker: (id) => req(`/blockers/${id}/clear`, { method: 'POST' }),
  standupToday: () => req('/standup/today'),
  completeStandup: (body) => req('/standup/complete', { method: 'POST', body: JSON.stringify(body) }),
  inbox: () => req('/captures/inbox'),
  applyCard: (cid, card, payload) =>
    req(`/captures/${cid}/cards/${card}/apply`, { method: 'POST', body: JSON.stringify({ payload }) }),
  discardCard: (cid, card) => req(`/captures/${cid}/cards/${card}/discard`, { method: 'POST' }),

  // audio goes up as multipart, so it skips the JSON helper
  async capture(blob, { durationSec, source, project } = {}) {
    const form = new FormData()
    form.append('audio', blob, 'capture.webm')
    if (durationSec) form.append('durationSec', String(durationSec))
    if (source) form.append('source', source)
    if (project) form.append('project', project)
    const res = await fetch(`${BASE}/captures`, { method: 'POST', body: form })
    const json = await res.json()
    if (!res.ok) throw Object.assign(new Error(json.error || 'capture failed'), { capture: json.capture })
    return json
  },
}
