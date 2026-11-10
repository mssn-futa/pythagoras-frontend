import { beforeEach, describe, expect, test } from 'vitest'
import {
  createDraft, getBroadcast, listBroadcasts, listDeliveries, normalizeBroadcast, normalizePreview,
  previewBroadcast, queueBroadcast, retryDeliveries, toAudiencePayload, updateDraft,
} from '../../src/features/communication/api/broadcastsApi.js'
import { createBackend, counts, wireBroadcast, wireDelivery } from '../fixtures/communication.js'
import { useApiOrigin } from '../fixtures/auth.js'
import { server } from '../mocks/server.js'

beforeEach(useApiOrigin)

describe('audience mapping', () => {
  test.each([
    [{ type: 'all', department: 'stale', level: '300' }, { type: 'all' }],
    [{ type: 'department', department: '  Computer Science ', level: '300' }, { type: 'department', department: 'Computer Science' }],
    [{ type: 'level', level: '300', department: 'stale' }, { type: 'level', level: '300' }],
  ])('sends only the selector of the chosen type: %j', (input, wire) => {
    expect(toAudiencePayload(input)).toEqual(wire)
  })
})

describe('payload and response mapping', () => {
  test('create draft posts subject/body/audience and maps id + version', async () => {
    const backend = createBackend()
    server.use(...backend.handlers)
    const draft = await createDraft({ subject: ' Weekly ', body: 'Hello', audience: { type: 'department', department: 'Computer Science', level: '' } })
    expect(backend.calls[0]).toMatchObject({
      method: 'POST', path: '/dawah/broadcasts/',
      body: { subject: 'Weekly', body: 'Hello', audience: { type: 'department', department: 'Computer Science' } },
    })
    expect(draft).toMatchObject({ id: 1, version: 1, state: 'draft', audience: { type: 'department', department: 'Computer Science', level: '' } })
  })

  test('update sends the version it edited from', async () => {
    const backend = createBackend({ broadcasts: [wireBroadcast({ id: 7, version: 3 })] })
    server.use(...backend.handlers)
    const saved = await updateDraft(7, { subject: 'S', body: 'B', audience: { type: 'level', level: '300', department: '' } }, 3)
    expect(backend.calls[0]).toMatchObject({ method: 'PATCH', path: '/dawah/broadcasts/7/', body: { subject: 'S', body: 'B', audience: { type: 'level', level: '300' }, version: 3 } })
    expect(saved.version).toBe(4)
  })

  test('queue posts {version}; 202 acknowledgement maps counts and recipient_count', async () => {
    const backend = createBackend({ broadcasts: [wireBroadcast({ id: 7, version: 3 })], previewCount: 42 })
    server.use(...backend.handlers)
    const ack = await queueBroadcast(7, 3)
    expect(backend.calls[0]).toMatchObject({ method: 'POST', path: '/dawah/broadcasts/7/queue/', body: { version: 3 } })
    expect(ack).toMatchObject({ id: 7, state: 'queued', recipientCount: 42, counts: { queued: 42, sent: 0, failed: 0, uncertain: 0, skipped: 0 } })
  })

  test('retry posts the explicitly selected ids', async () => {
    const backend = createBackend()
    server.use(...backend.handlers)
    await retryDeliveries(7, new Set([12, 13]))
    expect(backend.calls[0]).toMatchObject({ method: 'POST', path: '/dawah/broadcasts/7/retry/', body: { delivery_ids: [12, 13] } })
  })

  test('list and deliveries send paging and state filters', async () => {
    const backend = createBackend({ broadcasts: [wireBroadcast({ state: 'queued' })], deliveries: { 7: [wireDelivery({ state: 'failed' })] } })
    server.use(...backend.handlers)
    await listBroadcasts({ kind: 'history', page: 2, pageSize: 10, state: 'queued' })
    const deliveries = await listDeliveries(7, { page: 1, state: 'failed' })
    expect(backend.calls[0].query).toEqual({ kind: 'history', page: '2', page_size: '10', state: 'queued' })
    expect(backend.calls[1].query).toEqual({ page: '1', page_size: '20', state: 'failed' })
    expect(deliveries.results[0]).toMatchObject({ id: 12, recipient: 'one@example.test', state: 'failed', eligibleActions: ['retry'] })
  })

  test('detail is read by id', async () => {
    server.use(...createBackend({ broadcasts: [wireBroadcast({ id: 9, subject: 'Nine' })] }).handlers)
    expect((await getBroadcast(9)).subject).toBe('Nine')
  })

  test('preview keeps text only and drops every html field', async () => {
    const backend = createBackend({ broadcasts: [wireBroadcast({ id: 7 })] })
    server.use(...backend.handlers)
    const preview = await previewBroadcast(7, 1)
    expect(backend.calls[0]).toMatchObject({ method: 'POST', path: '/dawah/broadcasts/7/preview/', body: { version: 1 } })
    expect(preview).toEqual({ subject: 'Weekly Da’wah summary', body: 'Summary and recording link', renderedText: 'Summary and recording link', audienceCount: 42 })
    expect(normalizePreview({ subject: 's', body: 'b', body_html: '<script>', rendered_html: '<b>' })).not.toHaveProperty('bodyHtml')
  })

  test('missing optional fields get safe defaults, but a missing audience is never "all"', () => {
    expect(normalizeBroadcast({ id: 1 })).toMatchObject({ subject: '', state: 'draft', audience: { type: 'unknown' }, counts: counts({ cancelled: 0 }), eligibleActions: null })
  })

  test.each([[null], [undefined], [{}], [{ type: 'everyone' }], [{ type: 'ALL' }], ['all']])('unknown or malformed audience %j stays unknown', (audience) => {
    expect(normalizeBroadcast({ id: 1, audience }).audience.type).toBe('unknown')
  })

  test('frozen payload names map exactly', () => {
    const mapped = normalizeBroadcast(wireBroadcast({ body_format: 'rich', creator_id: 2, counts: counts({ cancelled: 3 }), eligible_actions: ['edit', 'queue'] }))
    expect(mapped).toMatchObject({ bodyFormat: 'rich', creatorId: 2, counts: { cancelled: 3 }, eligibleActions: ['edit', 'queue'] })
  })

  test('preview of a stale version is a 409 BROADCAST_VERSION_CONFLICT', async () => {
    server.use(...createBackend({ broadcasts: [wireBroadcast({ id: 7, version: 4 })] }).handlers)
    await expect(previewBroadcast(7, 3)).rejects.toMatchObject({ status: 409, code: 'BROADCAST_VERSION_CONFLICT' })
  })

  test('the strict fixture rejects the old comma-list drift and unknown params with 400', async () => {
    server.use(...createBackend().handlers)
    await expect(listBroadcasts({ kind: 'history', state: 'queued,processing' })).rejects.toMatchObject({ status: 400, fields: { state: expect.any(Array) } })
    await expect(listBroadcasts({ kind: 'everything' })).rejects.toMatchObject({ status: 400 })
    await expect(listDeliveries(7, { state: 'sent,failed' })).rejects.toMatchObject({ status: 400 })
  })
})
