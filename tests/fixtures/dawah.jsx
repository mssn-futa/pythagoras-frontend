import { http } from 'msw'
import { render } from '@testing-library/react'
import { server } from '../mocks/server.js'
import { admin, recorder, sessionHandlers, storeRefreshToken, url } from './auth.js'
import { TestApp } from './TestApp.jsx'

export const R2_ORIGIN = 'https://r2.example.test'
export const R2_PUT_URL = `${R2_ORIGIN}/staging/abc123?X-Amz-Signature=synthetic`

// Synthetic, test-only records shaped like the frozen D2 examples.
export const rawEvent = (overrides = {}) => ({
  id: 3,
  title: 'Friday khutbah',
  category: 'jumuah',
  tags: 'patience',
  speakers: 'Guest speaker',
  location: 'FUTA mosque',
  start_time: '2026-10-09T12:00:00Z',
  end_time: '2026-10-09T13:00:00Z',
  summary: 'Key takeaways',
  description: 'Friday session',
  status: 'draft',
  published_at: null,
  ...overrides,
})

export const rawResource = (overrides = {}) => ({
  id: 8,
  event_id: 3,
  title: 'Patience',
  type: 'aud',
  status: 'draft',
  storage_status: 'none',
  media_url: null,
  duration: null,
  ...overrides,
})

export const paged = (results, extra = {}) => ({ count: results.length, next: null, previous: null, results, ...extra })

export const rawIntent = (overrides = {}) => ({
  upload_id: 12,
  resource_id: 8,
  method: 'PUT',
  upload_url: R2_PUT_URL,
  headers: { 'Content-Type': 'audio/mpeg' },
  expires_at: '2099-10-09T12:15:00Z',
  ...overrides,
})

export const mp3 = (name = 'khutbah.mp3', size = 12) => {
  const file = new File([new Uint8Array(size)], name, { type: 'audio/mpeg' })
  return file
}

/** Signs in as an admin (restored session) and renders the real app at `path`. */
export function renderAdminApp(path, handlers = [], { user = admin } = {}) {
  const session = recorder()
  server.use(...sessionHandlers(session, user), ...handlers)
  storeRefreshToken()
  return render(<TestApp path={path} />)
}

/** Records a Pythagoras API handler's calls (method, path, auth, body). */
export function apiHandler(method, path, resolver, rec = recorder()) {
  const handler = http[method](url(path), async ({ request, params }) => {
    const entry = await rec.record(request)
    return resolver({ request, params, entry, calls: rec.calls })
  })
  return { handler, rec }
}
