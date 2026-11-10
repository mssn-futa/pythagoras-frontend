import { http, HttpResponse, delay } from 'msw'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { api, apiClient, ApiError, refreshSession } from '../../src/services/api/axiosConfig.js'
import {
  getAccessToken,
  getRefreshToken,
  onSessionEnded,
  REFRESH_STORAGE_KEY,
  setSessionTokens,
} from '../../src/services/api/session.js'
import * as authService from '../../src/services/api/authService.js'
import { server } from '../mocks/server.js'
import { fail, ok, recorder, resetSession, url, useApiOrigin } from '../fixtures/auth.js'

beforeEach(useApiOrigin)
afterEach(resetSession)

function signedIn(access = 'access-1', refresh = 'refresh-1') {
  setSessionTokens({ access, refresh })
}

describe('envelope and transport', () => {
  test('targets VITE_API_URL without a version prefix and unwraps the envelope exactly once', async () => {
    const rec = recorder()
    const inner = { success: true, data: { id: 1 }, message: 'inner' }
    server.use(http.get(url('/dawah/events/7/'), async ({ request }) => {
      await rec.record(request)
      return ok(inner, 'Loaded.')
    }))

    await expect(api.get('/dawah/events/7/')).resolves.toEqual(inner)
    const response = await apiClient.get('/dawah/events/7/')
    expect(response.data).toEqual(inner)
    expect(response.message).toBe('Loaded.')
    expect(rec.calls.map((call) => call.path)).toEqual(['/dawah/events/7/', '/dawah/events/7/'])
  })

  test('returns paginated data as-is and empty 204 deletions as null', async () => {
    const page = { count: 1, next: null, previous: null, results: [{ id: 1 }] }
    server.use(
      http.get(url('/quiz/quizzes/'), () => ok(page)),
      http.delete(url('/quiz/quizzes/1/'), () => new HttpResponse(null, { status: 204 })),
    )
    await expect(api.get('/quiz/quizzes/', { params: { page: 1 } })).resolves.toEqual(page)
    await expect(api.delete('/quiz/quizzes/1/')).resolves.toBeNull()
  })

  test('injects the in-memory bearer token, but never on public requests', async () => {
    const rec = recorder()
    server.use(
      http.get(url('/accounts/me/'), async ({ request }) => (await rec.record(request), ok({}))),
      http.get(url('/dawah/events/'), async ({ request }) => (await rec.record(request), ok([]))),
    )
    signedIn('secret-access')
    await api.get('/accounts/me/')
    await api.get('/dawah/events/', { public: true })
    expect(rec.calls.map((call) => call.auth)).toEqual(['Bearer secret-access', null])
    // Access token is memory-only; only the refresh token is persisted.
    expect(Object.values({ ...sessionStorage })).toEqual(['refresh-1'])
    expect(localStorage.length).toBe(0)
  })
})

describe('error normalization', () => {
  test('maps validation field errors from data.fields', async () => {
    server.use(http.post(url('/dawah/events/'), () =>
      fail(400, 'VALIDATION_ERROR', 'Correct the highlighted fields.', { title: ['This field is required.'], starts_at: 'Invalid.' })))
    const error = await api.post('/dawah/events/', {}).catch((caught) => caught)
    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({
      status: 400,
      code: 'VALIDATION_ERROR',
      message: 'Correct the highlighted fields.',
      fields: { title: ['This field is required.'], starts_at: ['Invalid.'] },
    })
  })

  test.each([
    [403, 'PERMISSION_DENIED', 'This account is inactive.'],
    [409, 'RESOURCE_REFERENCED', 'Event is referenced by a quiz.'],
    [503, 'MEDIA_UPLOAD_FAILED', 'Upload unavailable.'],
  ])('keeps status %i code and message', async (status, code, message) => {
    server.use(http.get(url('/x/'), () => fail(status, code, message)))
    signedIn()
    await expect(api.get('/x/')).rejects.toMatchObject({ status, code, message, fields: {} })
  })

  test('maps throttling with Retry-After and falls back to default codes/messages', async () => {
    server.use(http.post(url('/accounts/login/'), () =>
      HttpResponse.json({ detail: 'Request was throttled.' }, { status: 429, headers: { 'Retry-After': '30' } })))
    await expect(api.post('/accounts/login/', {}, { public: true })).rejects.toMatchObject({
      status: 429, code: 'THROTTLED', message: 'Request was throttled.', retryAfter: 30,
    })
  })

  test('maps network failures to status 0', async () => {
    server.use(http.get(url('/x/'), () => HttpResponse.error()))
    await expect(api.get('/x/', { public: true })).rejects.toMatchObject({ status: 0, code: 'NETWORK_ERROR' })
  })
})

describe('refresh and retry', () => {
  function protectedHandler(rec, path, acceptedToken = 'Bearer access-2') {
    return http.get(url(path), async ({ request }) => {
      const entry = await rec.record(request)
      return entry.auth === acceptedToken ? ok({ path }) : fail(401, 'NOT_AUTHENTICATED', 'Token expired.')
    })
  }

  function refreshHandler(rec, respond = () => ok({ access: 'access-2', refresh: 'refresh-2' })) {
    return http.post(url('/accounts/refresh/'), async ({ request }) => {
      await rec.record(request)
      await delay(20)
      return respond()
    })
  }

  test('concurrent 401s share exactly one refresh and each request retries once', async () => {
    const rec = recorder()
    server.use(
      refreshHandler(rec),
      protectedHandler(rec, '/quiz/a/'),
      protectedHandler(rec, '/quiz/b/'),
      protectedHandler(rec, '/quiz/c/'),
    )
    signedIn()

    const results = await Promise.all(['/quiz/a/', '/quiz/b/', '/quiz/c/'].map((path) => api.get(path)))

    expect(results).toEqual([{ path: '/quiz/a/' }, { path: '/quiz/b/' }, { path: '/quiz/c/' }])
    expect(rec.count('/accounts/refresh/')).toBe(1)
    for (const path of ['/quiz/a/', '/quiz/b/', '/quiz/c/']) {
      expect(rec.calls.filter((call) => call.path === path).map((call) => call.auth))
        .toEqual(['Bearer access-1', 'Bearer access-2'])
    }
    const refreshCall = rec.calls.find((call) => call.path === '/accounts/refresh/')
    expect(refreshCall).toMatchObject({ auth: null, body: { refresh: 'refresh-1' } })
    expect(getAccessToken()).toBe('access-2')
    expect(getRefreshToken()).toBe('refresh-2')
  })

  test('a request rejected again after refresh is not retried a second time', async () => {
    const rec = recorder()
    const ended = vi.fn()
    const unsubscribe = onSessionEnded(ended)
    server.use(refreshHandler(rec), protectedHandler(rec, '/quiz/a/', 'never-accepted'))
    signedIn()

    await expect(api.get('/quiz/a/')).rejects.toMatchObject({ status: 401 })
    expect(rec.count('/accounts/refresh/')).toBe(1)
    expect(rec.count('/quiz/a/')).toBe(2)
    expect(sessionStorage.getItem(REFRESH_STORAGE_KEY)).toBeNull()
    expect(ended).toHaveBeenCalledTimes(1)
    unsubscribe()
  })

  test('refresh failure clears memory and storage and signals sign-out once', async () => {
    const rec = recorder()
    const ended = vi.fn()
    const unsubscribe = onSessionEnded(ended)
    server.use(
      refreshHandler(rec, () => fail(401, 'TOKEN_NOT_VALID', 'Token is blacklisted.')),
      protectedHandler(rec, '/quiz/a/'),
      protectedHandler(rec, '/quiz/b/'),
    )
    signedIn()

    const outcomes = await Promise.allSettled([api.get('/quiz/a/'), api.get('/quiz/b/')])

    expect(outcomes.map((outcome) => outcome.reason?.code)).toEqual(['SESSION_EXPIRED', 'SESSION_EXPIRED'])
    expect(rec.count('/accounts/refresh/')).toBe(1)
    expect(rec.count('/quiz/a/')).toBe(1)
    expect(getAccessToken()).toBeNull()
    expect(sessionStorage.getItem(REFRESH_STORAGE_KEY)).toBeNull()
    expect(ended).toHaveBeenCalledTimes(1)
    expect(ended).toHaveBeenCalledWith('expired')
    unsubscribe()
  })

  test('never refreshes for login, refresh or other public requests, nor on 403', async () => {
    const rec = recorder()
    server.use(
      refreshHandler(rec),
      http.post(url('/accounts/login/'), async ({ request }) => (await rec.record(request), fail(401, 'AUTHENTICATION_FAILED', 'Invalid credentials.'))),
      http.get(url('/dawah/events/'), async ({ request }) => (await rec.record(request), fail(401, 'NOT_AUTHENTICATED', 'No.'))),
      http.get(url('/admin-only/'), async ({ request }) => (await rec.record(request), fail(403, 'PERMISSION_DENIED', 'Admins only.'))),
    )
    signedIn()

    await expect(authService.login({ emailOrMatric: 'x', password: 'y' })).rejects.toMatchObject({ status: 401, message: 'Invalid credentials.' })
    await expect(api.get('/dawah/events/', { public: true })).rejects.toMatchObject({ status: 401 })
    await expect(api.get('/admin-only/')).rejects.toMatchObject({ status: 403 })
    expect(rec.count('/accounts/refresh/')).toBe(0)
    expect(rec.calls.find((call) => call.path === '/accounts/login/').auth).toBeNull()

    // A failing refresh call itself does not recurse into another refresh.
    server.use(refreshHandler(rec, () => fail(401, 'TOKEN_NOT_VALID', 'Expired.')))
    await expect(refreshSession()).rejects.toMatchObject({ status: 401 })
    expect(rec.count('/accounts/refresh/')).toBe(1)
  })

  test('a 401 without any refresh token ends the session without a refresh call', async () => {
    const rec = recorder()
    server.use(refreshHandler(rec), protectedHandler(rec, '/quiz/a/'))
    setSessionTokens({ access: 'access-1' })
    await expect(api.get('/quiz/a/')).rejects.toMatchObject({ status: 401 })
    expect(rec.count('/accounts/refresh/')).toBe(0)
    expect(getAccessToken()).toBeNull()
  })
})
