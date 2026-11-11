import { beforeEach, afterEach, describe, expect, test, vi } from 'vitest'
import { server } from '../mocks/server.js'
import { resetSession, useApiOrigin } from '../fixtures/auth.js'
import { createLearningBackend, rawClass, rawDoc, rawModule } from '../fixtures/assessLearningApi.js'
import { audio } from '../fixtures/dawah.js'
import { accessState, canReadModules, enroll, getEnrollment, listModules, mapClass, mapModule, withdraw } from '../../src/features/assessments/student/classes/api/classesApi.js'

vi.setConfig({ testTimeout: 20000 })
beforeEach(useApiOrigin)
afterEach(resetSession)

const use = (config) => {
  const backend = createLearningBackend(config)
  server.use(...backend.handlers)
  return backend
}

describe('student class service', () => {
  test('mappers whitelist fields and keep full public resource payloads', () => {
    expect(mapClass({ ...rawClass(), secret: 'x' })).toEqual({ id: 2, code: 'ARB101', title: 'Arabic for beginners', description: 'Greetings and basics.', status: 'published', moduleCount: null })
    const module = mapModule(rawModule({ resources: [audio(8), rawDoc(10)], quizzes: [{ id: 45, title: 'Q', status: 'published', is_correct: true }] }))
    expect(module.quizzes).toEqual([{ id: 45, title: 'Q', status: 'published' }])
    expect(module.resources.map((r) => [r.id, r.type, r.status, r.storageStatus])).toEqual([[8, 'aud', 'published', 'ready'], [10, 'doc', 'published', 'ready']])
    expect(module.resources[0].mediaUrl).toBe('https://media.example.test/khutbah-8.mp3')
  })

  test('modules are ordered by persisted order then id', async () => {
    use({ modules: { 2: [rawModule({ id: 3, order: 2 }), rawModule({ id: 2, order: 2 }), rawModule({ id: 9, order: 1 })] }, enrollments: { 2: { id: 5, status: 'active' } } })
    expect((await listModules(2)).map((m) => m.id)).toEqual([9, 2, 3])
  })

  test('enrollment: never enrolled is null; enroll is idempotent; withdraw then enroll reuses the record', async () => {
    const backend = use({})
    expect(await getEnrollment(2)).toBeNull()
    const first = await enroll(2)
    const replay = await enroll(2)
    expect(replay).toEqual(first)
    expect(first.status).toBe('active')
    await withdraw(2)
    expect((await getEnrollment(2)).status).toBe('withdrawn')
    expect((await enroll(2)).id).toBe(first.id)
    expect(backend.state.violations).toEqual([])
    expect(backend.state.calls.find((c) => c.method === 'POST').body).toEqual({})
  })

  test('access states', () => {
    const published = { status: 'published' }
    expect(accessState(published, { status: 'active' })).toBe('open')
    expect(accessState(published, null)).toBe('not_enrolled')
    expect(accessState(published, { status: 'withdrawn' })).toBe('withdrawn')
    expect(accessState({ status: 'closed' }, { status: 'active' })).toBe('closed')
    expect(accessState({ status: 'draft' }, null)).toBe('unavailable')
    expect(canReadModules({ status: 'closed' }, { status: 'active' })).toBe(false)
    expect(canReadModules(published, { status: 'withdrawn' })).toBe(false)
  })
})
