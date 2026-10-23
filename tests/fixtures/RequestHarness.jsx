import { useState } from 'react'

// Harness-only UI. It makes no claim about implemented product behavior.
export default function RequestHarness() {
  const [message, setMessage] = useState('No request yet')
  const [loading, setLoading] = useState(false)

  async function loadMessage() {
    setLoading(true)
    try {
      const response = await fetch(new URL('/__harness__/message', window.location.origin))
      if (!response.ok) throw new Error('Request failed')
      const body = await response.json()
      setMessage(body.data.message)
    } catch {
      setMessage('Request unavailable')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main>
      <h1>Frontend harness sample</h1>
      <button disabled={loading} onClick={loadMessage}>
        {loading ? 'Loading…' : 'Load message'}
      </button>
      <p role="status">{message}</p>
    </main>
  )
}
