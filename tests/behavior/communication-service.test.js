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
    await listBroadcasts({ page: 2, pageSize: 10, states: ['queued', 'processing'] })
    const deliveries = await listDeliveries(7, { page: 3, state: 'failed' })
    expect(backend.calls[0].query).toEqual({ page: '2', page_size: '10', state: 'queued,processing' })
    expect(backend.calls[1].query).toEqual({ page: '3', page_size: '20', state: 'failed' })
    expect(deliveries.results[0]).toMatchObject({ id: 12, recipient: 'one@example.test', state: 'failed', eligibleActions: null })
  })

  test('detail is read by id', async () => {
    server.use(...createBackend({ broadcasts: [wireBroadcast({ id: 9, subject: 'Nine' })] }).handlers)
    expect((await getBroadcast(9)).subject).toBe('Nine')
  })

  test('preview keeps text only and drops every html field', async () => {
    server.use(...createBackend({ broadcasts: [wireBroadcast({ id: 7 })] }).handlers)
    const preview = await previewBroadcast(7)
    expect(preview).toEqual({ subject: 'Weekly Da’wah summary', body: 'Summary and recording link', renderedText: 'Summary and recording link', audienceCount: 42 })
    expect(normalizePreview({ subject: 's', body: 'b', body_html: '<script>', rendered_html: '<b>' })).not.toHaveProperty('bodyHtml')
  })

  test('missing optional fields get safe defaults', () => {
    expect(normalizeBroadcast({ id: 1 })).toMatchObject({ subject: '', state: 'draft', audience: { type: 'all' }, counts: counts({ cancelled: 0 }), eligibleActions: [] })
  })
})
