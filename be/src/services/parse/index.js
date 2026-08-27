import { parseHeuristic } from './heuristic.js'

/**
 * Parsing is an adapter because the right answer depends on what is installed.
 *
 *   heuristic  zero setup, zero cost, offline, instant           (default)
 *   ollama     free local model, noticeably better on messy speech
 *   claude     best quality, needs a paid key
 *
 * All three return the same shape, and every result lands as a confirm-chip
 * either way - so the floor is "one extra tap", not "wrong data silently filed".
 */
export async function parseTranscript(transcript, ctx) {
  const empty = { tasks: [], statusUpdates: [], blockers: [], owed: [], notes: [] }
  if (!transcript?.trim()) return { ...empty, parser: 'none' }

  const want = process.env.PARSER || 'heuristic'

  if (want === 'ollama') {
    try {
      const { parseOllama } = await import('./ollama.js')
      return { ...(await parseOllama(transcript, ctx)), parser: 'ollama' }
    } catch (err) {
      // a model that is not running must not cost him the capture
      console.warn(`ollama parse failed (${err.message}) - falling back to heuristic`)
    }
  }

  if (want === 'claude') {
    try {
      const { parseClaude } = await import('./claude.js')
      return { ...(await parseClaude(transcript, ctx)), parser: 'claude' }
    } catch (err) {
      console.warn(`claude parse failed (${err.message}) - falling back to heuristic`)
    }
  }

  return { ...parseHeuristic(transcript, ctx), parser: 'heuristic' }
}
