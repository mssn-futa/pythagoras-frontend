import { http } from 'msw'
import { beforeEach, describe, expect, test } from 'vitest'
import {
  createAudioResource, createEvent, finalizeUpload, listEvents, listResources, mapEvent, mapPage, mapResource,
  requestAudioUpload, toEventFormValues, toEventPayload, updateEvent,
} from '../../src/features/dawah/admin/dawahAdminService.js'
import { formatLagos, lagosLocalToUtcIso, utcIsoToLagosLocal } from '../../src/features/dawah/admin/time.js'
import { safeUploadHeaders } from '../../src/features/dawah/admin/uploadTransport.js'
import { ApiError } from '../../src/services/api'
import { server } from '../mocks/server.js'
import { fail, ok, recorder, resetSession, url, useApiOrigin } from '../fixtures/auth.js'
import { mp3, paged, rawEvent, rawIntent, rawResource } from '../fixtures/dawah.jsx'
import { setSessionTokens } from '../../src/services/api/session.js'

beforeEach(() => {
  useApiOrigin()
  resetSession()
  setSessionTokens({ access: 'access-1', refresh: 'refresh-1' })
})

describe('Lagos time conversion', () => {
  test('wall-clock input becomes a UTC instant with Z (Lagos is UTC+1)', () => {
    expect(lagosLocalToUtcIso('2026-10-09T13:00')).toBe('2026-10-09T12:00:00Z')
    expect(lagosLocalToUtcIso('2026-01-01T00:30')).toBe('2025-12-31T23:30:00Z')
  })
  test('UTC instants render back to the Lagos input value', () => {
    expect(utcIsoToLagosLocal('2026-10-09T12:00:00Z')).toBe('2026-10-09T13:00')
    expect(utcIsoToLagosLocal('2025-12-31T23:30:00Z')).toBe('2026-01-01T00:30')
  })
  test('rejects impossible or non-ISO values instead of guessing', () => {
    expect(lagosLocalToUtcIso('2026-02-31T10:00')).toBeNull()
    expect(lagosLocalToUtcIso('09-10-2026')).toBeNull()
    expect(lagosLocalToUtcIso('')).toBeNull()
    expect(utcIsoToLagosLocal('09-10-2026')).toBe('')
  })
  test('display uses Africa/Lagos', () => {
    expect(formatLagos('2026-10-09T12:00:00Z')).toContain('13:00')
    expect(formatLagos(null)).toBe('—')
  })
})

describe('payload and response mapping', () => {
  const values = {
    title: ' Friday khutbah ', category: 'jumuah', tags: 'patience', speakers: 'Guest speaker', location: 'FUTA mosque',
    startLocal: '2026-10-09T13:00', endLocal: '2026-10-09T14:00', summary: 'Key takeaways', description: 'Friday session',
  }
  test('event form values map to the D2 create request with UTC times', () => {
    expect(toEventPayload(values)).toEqual({
      title: 'Friday khutbah', category: 'jumuah', tags: 'patience', speakers: 'Guest speaker', location: 'FUTA mosque',
      start_time: '2026-10-09T12:00:00Z', end_time: '2026-10-09T13:00:00Z', summary: 'Key takeaways', description: 'Friday session',
    })
  })
  test('event response maps to a camelCase view and back to form values', () => {
    const event = mapEvent(rawEvent({ id: 3, status: 'published', published_at: '2026-10-01T09:00:00Z' }))
    expect(event).toMatchObject({ id: 3, startTime: '2026-10-09T12:00:00Z', status: 'published', publishedAt: '2026-10-01T09:00:00Z' })
    expect(toEventFormValues(event)).toMatchObject({ startLocal: '2026-10-09T13:00', endLocal: '2026-10-09T14:00' })
  })
  test('resource response maps ids, state and media', () => {
    const resource = mapResource(rawResource({ status: 'published', storage_status: 'ready', media_url: 'https://media.example.test/k.mp3', duration: 2100 }))
    expect(resource).toMatchObject({ id: 8, eventId: 3, status: 'published', storageStatus: 'ready', mediaUrl: 'https://media.example.test/k.mp3', duration: 2100 })
  })
  test('paginated envelope data is mapped; bare arrays are tolerated', () => {
    expect(mapPage({ count: 41, next: 'n', previous: null, results: [rawEvent()] }, mapEvent)).toMatchObject({ count: 41, next: 'n' })
    expect(mapPage([rawEvent()], mapEvent)).toMatchObject({ count: 1, next: null })
  })
  test('upload headers never carry credentials', () => {
    expect(safeUploadHeaders({ 'Content-Type': 'audio/mpeg', Authorization: 'Bearer x', cookie: 'a=b' })).toEqual({ 'Content-Type': 'audio/mpeg' })
  })
})

describe('service calls', () => {
  test('listEvents sends status, upcoming and page params through the authenticated client', async () => {
    const rec = recorder()
    let seen
    server.use(http.get(url('/dawah/events/'), async ({ request }) => {
      const entry = await rec.record(request)
      seen = { search: new URL(request.url).search, auth: entry.auth }
      return ok(paged([rawEvent()]))
    }))
    const page = await listEvents({ status: 'draft', upcoming: true, page: 2 })
    expect(seen.search).toBe('?status=draft&page=2&page_size=20&upcoming=true')
    expect(seen.auth).toBe('Bearer access-1')
    expect(page.results[0].title).toBe('Friday khutbah')
  })

  test('listResources sends type/status filters only when set', async () => {
    const seen = []
    server.use(http.get(url('/dawah/events/3/resources/'), ({ request }) => { seen.push(new URL(request.url).search); return ok(paged([rawResource()])) }))
    await listResources(3)
    await listResources(3, { type: 'aud', status: 'draft' })
    await listResources(3, { type: 'all', status: 'all' })
    expect(seen).toEqual(['?page=1&page_size=100', '?page=1&page_size=100&type=aud&status=draft', '?page=1&page_size=100'])
  })

  test('createEvent posts the payload; updateEvent patches', async () => {
    const rec = recorder()
    server.use(
      http.post(url('/dawah/events/'), async ({ request }) => { await rec.record(request); return ok(rawEvent(), 'Saved.', { status: 201 }) }),
      http.patch(url('/dawah/events/3/'), async ({ request }) => { await rec.record(request); return ok(rawEvent()) }),
    )
    const values = toEventFormValues(mapEvent(rawEvent()))
    await createEvent(values)
    await updateEvent(3, values)
    expect(rec.calls.map((call) => [call.method, call.path])).toEqual([['POST', '/dawah/events/'], ['PATCH', '/dawah/events/3/']])
    expect(rec.calls[0].body.start_time).toBe('2026-10-09T12:00:00Z')
  })

  test('a 400 surfaces field errors as an ApiError', async () => {
    server.use(http.post(url('/dawah/events/'), () => fail(400, 'VALIDATION_ERROR', 'Correct the highlighted fields.', { end_time: ['End time must be after start time.'] })))
    const error = await createEvent(toEventFormValues(mapEvent(rawEvent()))).catch((caught) => caught)
    expect(error).toBeInstanceOf(ApiError)
    expect(error.fields.end_time).toEqual(['End time must be after start time.'])
  })

  test('createAudioResource sends type aud under the URL parent', async () => {
    const rec = recorder()
    server.use(http.post(url('/dawah/events/3/resources/'), async ({ request }) => { await rec.record(request); return ok(rawResource(), 'Saved.', { status: 201 }) }))
    expect(await createAudioResource(3, { title: ' Patience ' })).toMatchObject({ id: 8, eventId: 3 })
    expect(rec.calls[0].body).toEqual({ title: 'Patience', type: 'aud' })
  })

  test('requestAudioUpload sends metadata only and maps the intent', async () => {
    const rec = recorder()
    server.use(http.post(url('/dawah/events/3/resources/8/audio/'), async ({ request }) => { await rec.record(request); return ok(rawIntent(), 'Created.', { status: 201 }) }))
    const intent = await requestAudioUpload(3, 8, mp3('khutbah.mp3', 2048))
    expect(rec.calls[0].body).toEqual({ file_name: 'khutbah.mp3', content_type: 'audio/mpeg', size_bytes: 2048 })
    expect(intent).toMatchObject({ uploadId: 12, resourceId: 8, method: 'PUT', headers: { 'Content-Type': 'audio/mpeg' }, expiresAt: '2099-10-09T12:15:00Z' })
  })

  test('finalize posts no storage key and tolerates a minimal response', async () => {
    const rec = recorder()
    server.use(http.post(url('/dawah/uploads/12/finalize/'), async ({ request }) => { await rec.record(request); return ok({ preview_url: 'https://r2.example.test/preview?sig=1' }) }))
    const result = await finalizeUpload(12)
    expect(rec.calls[0].body).toBeNull()
    expect(result.previewUrl).toBe('https://r2.example.test/preview?sig=1')
  })
})
