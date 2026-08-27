export async function transcribeDeepgram(buffer) {
  const key = process.env.DEEPGRAM_API_KEY
  if (!key) throw new Error('DEEPGRAM_API_KEY not set (STT_PROVIDER=deepgram)')
  if (!buffer) throw new Error('no audio to transcribe')

  const res = await fetch('https://api.deepgram.com/v1/listen?model=nova-2&smart_format=true', {
    method: 'POST',
    headers: { Authorization: `Token ${key}`, 'Content-Type': 'audio/webm' },
    body: buffer,
  })
  if (!res.ok) throw new Error(`deepgram ${res.status}: ${await res.text()}`)
  const json = await res.json()
  return json.results?.channels?.[0]?.alternatives?.[0]?.transcript
}
