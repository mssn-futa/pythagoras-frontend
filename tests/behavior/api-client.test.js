import { http, HttpResponse, delay } from 'msw'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { api, apiClient, ApiError, refreshSession } from '../../src/services/api/axiosConfig.js'
import {
  clearSession,
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

  test.each([400, 401, 403])('a definitive %i refresh rejection clears memory and storage and signals sign-out once', async (status) => {
    const rec = recorder()
    const ended = vi.fn()
    const unsubscribe = onSessionEnded(ended)
    server.use(
      refreshHandler(rec, () => fail(status, 'TOKEN_NOT_VALID', 'Token is blacklisted.')),
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

describe('transient refresh failures and session generations', () => {
  function refreshHandler(rec, respond, wait = 20) {
    return http.post(url('/accounts/refresh/'), async ({ request }) => {
      await rec.record(request)
      await (typeof wait === 'number' ? delay(wait) : wait)
      return respond()
    })
  }
  // Holds the refresh response until the test releases it.
  function gate() {
    let release
    const promise = new Promise((resolve) => { release = resolve })
    return { promise, release }
  }
  const rotated = () => ok({ access: 'access-2', refresh: 'refresh-2' })
  function protectedHandler(rec, path, { wait = 0 } = {}) {
    return http.get(url(path), async ({ request }) => {
      const entry = await rec.record(request)
      if (wait) await delay(wait)
      return entry.auth === 'Bearer access-2' ? ok({ path }) : fail(401, 'NOT_AUTHENTICATED', 'Token expired.')
    })
  }

  test.each([
    ['a network failure', () => HttpResponse.error(), 0, 'NETWORK_ERROR'],
    ['a 429', () => fail(429, 'THROTTLED', 'Slow down.'), 429, 'THROTTLED'],
    ['a 500', () => fail(500, 'SERVER_ERROR', 'Internal error.'), 500, 'SERVER_ERROR'],
    ['a 503', () => fail(503, 'SERVICE_UNAVAILABLE', 'Unavailable.'), 503, 'SERVICE_UNAVAILABLE'],
  ])('%s during refresh keeps the session and rejects with that error', async (_label, respond, status, code) => {
    const rec = recorder()
    const ended = vi.fn()
    const unsubscribe = onSessionEnded(ended)
    server.use(refreshHandler(rec, respond), protectedHandler(rec, '/quiz/a/'))
    signedIn()

    await expect(api.get('/quiz/a/')).rejects.toMatchObject({ status, code })
    expect(rec.count('/accounts/refresh/')).toBe(1)
    expect(rec.count('/quiz/a/')).toBe(1)
    expect(getAccessToken()).toBe('access-1')
    expect(getRefreshToken()).toBe('refresh-1')
    expect(ended).not.toHaveBeenCalled()
    unsubscribe()
  })

  test('a 401 that arrives after another request refreshed reuses the new token without a second refresh', async () => {
    const rec = recorder()
    server.use(
      refreshHandler(rec, rotated),
      protectedHandler(rec, '/quiz/slow/', { wait: 120 }), // still in flight while the refresh completes
      protectedHandler(rec, '/quiz/fast/'),
    )
    signedIn()

    const slow = api.get('/quiz/slow/')
    await delay(5)
    await expect(api.get('/quiz/fast/')).resolves.toEqual({ path: '/quiz/fast/' })
    expect(getAccessToken()).toBe('access-2')
    await expect(slow).resolves.toEqual({ path: '/quiz/slow/' })

    expect(rec.count('/accounts/refresh/')).toBe(1)
    expect(rec.calls.filter((call) => call.path === '/quiz/slow/').map((call) => call.auth))
      .toEqual(['Bearer access-1', 'Bearer access-2'])
  })

  test('logout during an in-flight refresh revokes the rotated token and does not resurrect the session', async () => {
    const rec = recorder()
    const held = gate()
    server.use(
      refreshHandler(rec, rotated, held.promise),
      protectedHandler(rec, '/quiz/a/'),
      http.post(url('/accounts/logout/'), async ({ request }) => {
        await rec.record(request)
        return new HttpResponse(null, { status: 204 })
      }),
    )
    signedIn()

    const pending = api.get('/quiz/a/').catch((error) => error)
    await vi.waitFor(() => expect(rec.count('/accounts/refresh/')).toBe(1))
    const loggingOut = authService.logout()
    expect(getAccessToken()).toBeNull() // cleared before the refresh settles
    held.release()
    await loggingOut
    const outcome = await pending

    expect(outcome).toBeInstanceOf(ApiError)
    expect(outcome.status).toBe(401)
    expect(rec.calls.find((call) => call.path === '/accounts/logout/'))
      .toMatchObject({ auth: 'Bearer access-2', body: { refresh: 'refresh-2' } })
    // The original request was not retried as authenticated after logout.
    expect(rec.count('/quiz/a/')).toBe(1)
    expect(getAccessToken()).toBeNull()
    expect(sessionStorage.getItem(REFRESH_STORAGE_KEY)).toBeNull()
    await delay(80)
    expect(sessionStorage.getItem(REFRESH_STORAGE_KEY)).toBeNull()
  })

  test('a refresh result from a cleared session generation is discarded', async () => {
    const rec = recorder()
    const held = gate()
    server.use(refreshHandler(rec, rotated, held.promise), protectedHandler(rec, '/quiz/a/'))
    signedIn()

    const pending = api.get('/quiz/a/').catch((error) => error)
    await vi.waitFor(() => expect(rec.count('/accounts/refresh/')).toBe(1))
    clearSession()
    held.release()
    const outcome = await pending

    expect(outcome).toMatchObject({ status: 401 })
    expect(rec.count('/quiz/a/')).toBe(1)
    expect(getAccessToken()).toBeNull()
    expect(sessionStorage.getItem(REFRESH_STORAGE_KEY)).toBeNull()
  })

  test('a 401 from a previous session is never retried with a newer session\'s token', async () => {
    const rec = recorder()
    server.use(refreshHandler(rec, rotated), protectedHandler(rec, '/quiz/slow/', { wait: 60 }))
    signedIn('access-1', 'refresh-1')

    const pending = api.get('/quiz/slow/').catch((error) => error)
    await vi.waitFor(() => expect(rec.count('/quiz/slow/')).toBe(1))
    clearSession() // logout ...
    setSessionTokens({ access: 'access-2', refresh: 'refresh-other' }) // ... and another sign-in

    expect(await pending).toMatchObject({ status: 401 })
    expect(rec.count('/quiz/slow/')).toBe(1)
    expect(rec.count('/accounts/refresh/')).toBe(0)
    expect(getAccessToken()).toBe('access-2')
  })
})
