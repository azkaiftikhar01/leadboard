// deployed, the API is same-origin behind /api; in dev it is a separate port
const BASE = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:4000/api' : '/api')

async function req(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    ...opts,
  })
  if (res.status === 401) {
    const err = new Error('unauthorized')
    err.unauthorized = true
    throw err
  }
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || res.statusText)
  return res.json()
}

export const api = {
  // auth
  authState: () => req('/auth/state'),
  login: (password) => req('/auth/login', { method: 'POST', body: JSON.stringify({ password }) }),
  logout: () => req('/auth/logout', { method: 'POST' }),
  changePassphrase: (current, next) =>
    req('/auth/change', { method: 'POST', body: JSON.stringify({ current, next }) }),

  today: () => req('/today'),

  // team
  people: () => req('/people'),
  teamLoad: () => req('/people/load/all'),
  available: () => req('/people/load/available'),
  addPerson: (b) => req('/people', { method: 'POST', body: JSON.stringify(b) }),
  patchPerson: (id, b) => req(`/people/${id}`, { method: 'PATCH', body: JSON.stringify(b) }),
  removePerson: (id) => req(`/people/${id}`, { method: 'DELETE' }),
  deletePerson: (id) => req(`/people/${id}?permanent=true`, { method: 'DELETE' }),
  personImpact: (id) => req(`/people/${id}/impact`),
  scorecard: (id) => req(`/people/${id}/scorecard`),
  rework: (id) => req(`/people/${id}/rework`),
  // projects
  projects: () => req('/projects'),
  projectModes: () => req('/projects/modes'),
  addProject: (b) => req('/projects', { method: 'POST', body: JSON.stringify(b) }),
  patchProject: (id, b) => req(`/projects/${id}`, { method: 'PATCH', body: JSON.stringify(b) }),
  archiveProject: (id) => req(`/projects/${id}`, { method: 'DELETE' }),
  deleteProject: (id) => req(`/projects/${id}?permanent=true`, { method: 'DELETE' }),
  projectImpact: (id) => req(`/projects/${id}/impact`),
  setMember: (pid, uid, b) => req(`/projects/${pid}/members/${uid}`, { method: 'PUT', body: JSON.stringify(b) }),
  removeMember: (pid, uid) => req(`/projects/${pid}/members/${uid}`, { method: 'DELETE' }),
  board: (id) => req(`/projects/${id}/board`),
  // awards & scoreboard
  awardTypes: () => req('/awards/types'),
  scoreboard: () => req('/awards/board'),
  awards: (q = '') => req(`/awards${q}`),
  giveAward: (b) => req('/awards', { method: 'POST', body: JSON.stringify(b) }),
  undoAward: (id) => req(`/awards/${id}`, { method: 'DELETE' }),

  // history
  history: (q = '') => req(`/history${q}`),

  // notes
  notes: (q = '') => req(`/notes${q}`),
  addNote: (b) => req('/notes', { method: 'POST', body: JSON.stringify(b) }),
  patchNote: (id, b) => req(`/notes/${id}`, { method: 'PATCH', body: JSON.stringify(b) }),
  deleteNote: (id) => req(`/notes/${id}`, { method: 'DELETE' }),

  // tasks
  tasks: (q = '') => req(`/tasks${q}`),
  addTask: (b) => req('/tasks', { method: 'POST', body: JSON.stringify(b) }),
  toggleTask: (id) => req(`/tasks/${id}/toggle`, { method: 'POST', body: JSON.stringify({}) }),
  deleteTask: (id) => req(`/tasks/${id}`, { method: 'DELETE' }),
  reviewQueue: () => req('/tasks/review'),
  reopenReasons: () => req('/tasks/reopen-reasons'),
  transition: (id, body) => req(`/tasks/${id}/transition`, { method: 'POST', body: JSON.stringify(body) }),
  reopen: (id, body) => req(`/tasks/${id}/reopen`, { method: 'POST', body: JSON.stringify(body) }),
  blockers: (type) => req(`/blockers${type ? `?type=${type}` : ''}`),
  clearBlocker: (id) => req(`/blockers/${id}/clear`, { method: 'POST' }),
  standupToday: () => req('/standup/today'),
  completeStandup: (body) => req('/standup/complete', { method: 'POST', body: JSON.stringify(body) }),
  inbox: () => req('/captures/inbox'),
  deleteCapture: (id) => req(`/captures/${id}`, { method: 'DELETE' }),
  applyCard: (cid, card, payload) =>
    req(`/captures/${cid}/cards/${card}/apply`, { method: 'POST', body: JSON.stringify({ payload }) }),
  discardCard: (cid, card) => req(`/captures/${cid}/cards/${card}/discard`, { method: 'POST' }),

  // audio goes up as multipart, so it skips the JSON helper
  /**
   * Two shapes, because there are two paths. Browser speech produces a
   * transcript and no audio, so it posts plain JSON; the offline Whisper path
   * produces both and needs multipart. The transcript has to be sent either
   * way - leaving it out is what made the server reject perfectly good captures
   * as empty.
   */
  async capture(blob, { durationSec, source, project, transcript } = {}) {
    let res
    if (blob) {
      const form = new FormData()
      form.append('audio', blob, 'capture.webm')
      if (transcript) form.append('transcript', transcript)
      if (durationSec) form.append('durationSec', String(durationSec))
      if (source) form.append('source', source)
      if (project) form.append('project', project)
      res = await fetch(`${BASE}/captures`, { method: 'POST', credentials: 'include', body: form })
    } else {
      res = await fetch(`${BASE}/captures`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ transcript, durationSec, source, project }),
      })
    }
    const json = await res.json()
    if (!res.ok) throw Object.assign(new Error(json.error || 'capture failed'), { capture: json.capture })
    return json
  },
}
