import fs from 'node:fs'

export async function transcribeDeepgram(filePath) {
  const key = process.env.DEEPGRAM_API_KEY
  if (!key) throw new Error('DEEPGRAM_API_KEY not set (STT_PROVIDER=deepgram)')

  const buf = await fs.promises.readFile(filePath)
  const res = await fetch('https://api.deepgram.com/v1/listen?model=nova-2&smart_format=true', {
    method: 'POST',
    headers: { Authorization: `Token ${key}`, 'Content-Type': 'audio/webm' },
    body: buf,
  })
  if (!res.ok) throw new Error(`deepgram ${res.status}: ${await res.text()}`)
  const json = await res.json()
  return json.results?.channels?.[0]?.alternatives?.[0]?.transcript
}
