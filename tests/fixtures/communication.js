import { http } from 'msw'
import { fail, ok, url } from './auth.js'

// Synthetic, test-only broadcast API following D4's routes and envelopes.
export const B = '/dawah/broadcasts/'

export const counts = (over = {}) => ({ queued: 0, sent: 0, failed: 0, uncertain: 0, skipped: 0, ...over })

export function wireBroadcast(over = {}) {
  return {
    id: 7,
    subject: 'Weekly Da’wah summary',
    body: 'Summary and recording link',
    body_format: 'plain',
    audience: { type: 'all' },
    state: 'draft',
    version: 1,
    creator_id: 2,
    created_at: '2026-11-10T09:00:00Z',
    updated_at: '2026-11-10T09:30:00Z',
    queued_at: null,
    recipient_count: 0,
    counts: counts(),
    eligible_actions: [],
    ...over,
  }
}

export const wireDelivery = (over = {}) => ({
  id: 12,
  student_id: 5,
  snapshot_email: 'one@example.test',
  state: 'queued',
  attempt_count: 0,
  retry_generation: 0,
  provider_email_id: null,
  error_code: null,
  sent_at: null,
  ...over,
})

export const page = (results) => ({ count: results.length, next: null, previous: null, results })

/**
 * In-memory broadcast backend. `calls` records every request (method, path, query, body).
 * Override a route by registering a handler with server.use before/after these.
 */
export function createBackend({ broadcasts = [], deliveries = {}, previewCount = 42 } = {}) {
  const store = new Map(broadcasts.map((item) => [item.id, structuredClone(item)]))
  const calls = []
  let nextId = Math.max(0, ...store.keys()) + 1
  const log = async (request) => {
    const u = new URL(request.url)
    const text = ['GET', 'HEAD'].includes(request.method) ? '' : await request.clone().text()
    const entry = { method: request.method, path: u.pathname, query: Object.fromEntries(u.searchParams), body: text ? JSON.parse(text) : null }
    calls.push(entry)
    return entry
  }
  const find = (id) => store.get(Number(id))
  const missing = () => fail(404, 'NOT_FOUND', 'Not found.')

  const handlers = [
    http.get(url(B), async ({ request }) => {
      const { query } = await log(request)
      const states = query.state ? query.state.split(',') : null
      const rows = [...store.values()].filter((row) => !states || states.includes(row.state))
      return ok(page(rows))
    }),
    http.post(url(B), async ({ request }) => {
      const { body } = await log(request)
      const created = wireBroadcast({ id: nextId, version: 1, ...body })
      nextId += 1
      store.set(created.id, created)
      return ok(created, 'Saved.', { status: 201 })
    }),
    http.get(url(`${B}:id/`), async ({ request, params }) => {
      await log(request)
      const row = find(params.id)
      return row ? ok(row) : missing()
    }),
    http.patch(url(`${B}:id/`), async ({ request, params }) => {
      const { body } = await log(request)
      const row = find(params.id)
      if (!row) return missing()
      if (row.state !== 'draft') return fail(409, 'BROADCAST_ALREADY_QUEUED', 'This broadcast is already queued.')
      if (body.version !== row.version) return fail(409, 'BROADCAST_VERSION_CONFLICT', 'This draft was changed elsewhere.')
      const { version, ...fields } = body
      void version
      Object.assign(row, fields, { version: row.version + 1 })
      return ok(row)
    }),
    http.post(url(`${B}:id/preview/`), async ({ request, params }) => {
      await log(request)
      const row = find(params.id)
      if (!row) return missing()
      return ok({ subject: row.subject, body: row.body, rendered_text: row.body, rendered_html: `<p>${row.body}</p>`, audience_count: previewCount })
    }),
    http.post(url(`${B}:id/queue/`), async ({ request, params }) => {
      const { body } = await log(request)
      const row = find(params.id)
      if (!row) return missing()
      if (row.state === 'draft') {
        if (body.version !== row.version) return fail(409, 'BROADCAST_VERSION_CONFLICT', 'This draft was changed elsewhere.')
        Object.assign(row, { state: 'queued', queued_at: '2026-11-10T10:00:00Z', recipient_count: previewCount, counts: counts({ queued: previewCount }) })
      }
      return ok(row, 'Broadcast queued. Delivery is pending.', { status: 202 })
    }),
    http.get(url(`${B}:id/deliveries/`), async ({ request, params }) => {
      const { query } = await log(request)
      const rows = (deliveries[params.id] ?? []).filter((row) => !query.state || row.state === query.state)
      return ok(page(rows))
    }),
    http.post(url(`${B}:id/retry/`), async ({ request }) => {
      await log(request)
      return ok({ retried: 1 }, 'Retry requested.', { status: 202 })
    }),
  ]
  return { handlers, calls, store, only: (method, suffix = '') => calls.filter((c) => c.method === method && c.path.endsWith(suffix)) }
}
