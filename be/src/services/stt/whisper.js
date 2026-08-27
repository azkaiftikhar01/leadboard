export async function transcribeWhisper(buffer) {
  const key = process.env.OPENAI_API_KEY
  if (!key) throw new Error('OPENAI_API_KEY not set (STT_PROVIDER=whisper)')
  if (!buffer) throw new Error('no audio to transcribe')

  const form = new FormData()
  form.append('file', new Blob([buffer]), 'capture.webm')
  form.append('model', 'whisper-1')
  form.append('language', 'en')

  const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}` },
    body: form,
  })
  if (!res.ok) throw new Error(`whisper ${res.status}: ${await res.text()}`)
  return (await res.json()).text
}
