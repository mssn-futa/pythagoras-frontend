import { delay, http } from 'msw'
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
    ...over,
    eligible_actions: over.eligible_actions ?? (over.state && over.state !== 'draft' ? [] : ['edit', 'delete', 'preview', 'queue']),
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
  eligible_actions: over.eligible_actions ?? (over.state === 'failed' ? ['retry'] : []),
})

export const page = (results, { page: number = 1, page_size: size = 20 } = {}) => {
  const start = (Number(number) - 1) * Number(size)
  return { count: results.length, next: null, previous: null, results: results.slice(start, start + Number(size)) }
}

export const BROADCAST_STATE_VALUES = ['draft', 'queued', 'processing', 'completed', 'completed_with_errors', 'uncertain']
export const DELIVERY_STATE_VALUES = ['queued', 'claimed', 'sending', 'sent', 'failed', 'uncertain', 'skipped', 'cancelled']

/** Strict query check: unknown params, comma lists and bad values are 400 field errors (frozen D4 contract). */
function checkQuery(query, allowed, enums) {
  const fields = {}
  for (const key of Object.keys(query)) if (!allowed.includes(key)) fields[key] = [`Unknown parameter "${key}".`]
  for (const [key, values] of Object.entries(enums)) {
    if (query[key] !== undefined && !values.includes(query[key])) fields[key] = [`Invalid value "${query[key]}".`]
  }
  return Object.keys(fields).length ? fail(400, 'VALIDATION_ERROR', 'Correct the highlighted fields.', fields) : null
}

/**
 * In-memory broadcast backend. `calls` records every request (method, path, query, body).
 * Override a route by registering a handler with server.use before/after these.
 */
export function createBackend({ broadcasts = [], deliveries = {}, previewCount = 42, latency = 0 } = {}) {
  const store = new Map(broadcasts.map((item) => [item.id, structuredClone(item)]))
  const calls = []
  let nextId = Math.max(0, ...store.keys()) + 1
  const log = async (request) => {
    if (latency && request.method !== 'GET') await delay(latency)
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
      const bad = checkQuery(query, ['page', 'page_size', 'kind', 'state'], { kind: ['drafts', 'history'], state: BROADCAST_STATE_VALUES })
      if (bad) return bad
      const rows = [...store.values()].filter((row) => {
        if (query.kind === 'drafts') return row.state === 'draft' && (!query.state || query.state === 'draft')
        if (query.kind === 'history') return row.state !== 'draft' && (!query.state || row.state === query.state)
        return !query.state || row.state === query.state
      })
      return ok(page(rows, query))
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
      const { body } = await log(request)
      const row = find(params.id)
      if (!row) return missing()
      if (Object.keys(body ?? {}).join() !== 'version') return fail(400, 'VALIDATION_ERROR', 'Send only {"version": n}.')
      if (body.version !== row.version) return fail(409, 'BROADCAST_VERSION_CONFLICT', 'This draft was changed elsewhere.')
      return ok({ subject: row.subject, body: row.body, body_format: row.body_format, body_html: `<p>${row.body}</p>`, rendered_text: row.body, rendered_html: `<p>${row.body}</p>`, audience_count: previewCount })
    }),
    http.post(url(`${B}:id/queue/`), async ({ request, params }) => {
      const { body } = await log(request)
      const row = find(params.id)
      if (!row) return missing()
      if (row.state === 'draft') {
        if (body.version !== row.version) return fail(409, 'BROADCAST_VERSION_CONFLICT', 'This draft was changed elsewhere.')
        Object.assign(row, { state: 'queued', eligible_actions: [], queued_at: '2026-11-10T10:00:00Z', recipient_count: previewCount, counts: counts({ queued: previewCount }) })
      }
      return ok(row, 'Broadcast queued. Delivery is pending.', { status: 202 })
    }),
    http.get(url(`${B}:id/deliveries/`), async ({ request, params }) => {
      const { query } = await log(request)
      const bad = checkQuery(query, ['page', 'page_size', 'state'], { state: DELIVERY_STATE_VALUES })
      if (bad) return bad
      const rows = (deliveries[params.id] ?? []).filter((row) => !query.state || row.state === query.state)
      return ok(page(rows, query))
    }),
    http.post(url(`${B}:id/retry/`), async ({ request }) => {
      await log(request)
      return ok({ retried: 1 }, 'Retry requested.', { status: 202 })
    }),
  ]
  return { handlers, calls, store, only: (method, suffix = '') => calls.filter((c) => c.method === method && c.path.endsWith(suffix)) }
}
