import fs from 'node:fs'
import path from 'node:path'

export async function transcribeWhisper(filePath) {
  const key = process.env.OPENAI_API_KEY
  if (!key) throw new Error('OPENAI_API_KEY not set (STT_PROVIDER=whisper)')

  const form = new FormData()
  const buf = await fs.promises.readFile(filePath)
  form.append('file', new Blob([buf]), path.basename(filePath))
  form.append('model', 'whisper-1')
  form.append('language', 'en')

  const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}` },
    body: form,
  })
  if (!res.ok) throw new Error(`whisper ${res.status}: ${await res.text()}`)
  const json = await res.json()
  return json.text
}
