import { StrictMode } from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse, delay } from 'msw'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { getAccessToken, REFRESH_STORAGE_KEY } from '../../src/services/api/session.js'
import { server } from '../mocks/server.js'
import { fail, ok, recorder, resetSession, sessionHandlers, storeRefreshToken, student, url, useApiOrigin } from '../fixtures/auth.js'
import { TestApp } from '../fixtures/TestApp.jsx'

beforeEach(useApiOrigin)
afterEach(resetSession)

const location = () => screen.getByTestId('location').textContent

async function signIn(user, identifier = 'CSC/21/001', password = 'correct horse') {
  await user.type(await screen.findByLabelText('Email or matric number'), identifier)
  await user.type(screen.getByLabelText('Password'), password)
  await user.click(screen.getByRole('button', { name: 'Sign in' }))
}

describe('session restoration', () => {
  test('restores refresh → current user before rendering the protected page (Strict Mode safe)', async () => {
    const rec = recorder()
    let releaseMe
    const meGate = new Promise((resolve) => { releaseMe = resolve })
    const [refresh] = sessionHandlers(rec)
    server.use(refresh, http.get(url('/accounts/me/'), async ({ request }) => {
      await rec.record(request)
      await meGate
      return ok(student)
    }))
    storeRefreshToken('refresh-1')

    render(<StrictMode><TestApp path="/profile" /></StrictMode>)

    expect(screen.getByRole('status')).toHaveTextContent('Checking your session')
    await waitFor(() => expect(rec.count('/accounts/me/')).toBeGreaterThan(0))
    expect(screen.queryByRole('heading', { name: 'Amina Yusuf' })).not.toBeInTheDocument()
    releaseMe()

    expect(await screen.findByRole('heading', { name: 'Amina Yusuf' })).toBeVisible()
    expect(location()).toBe('/profile')
    // One rotation even though Strict Mode runs the effect twice.
    expect(rec.count('/accounts/refresh/')).toBe(1)
    expect(rec.calls.find((call) => call.path === '/accounts/refresh/').body).toEqual({ refresh: 'refresh-1' })
    expect(rec.calls.filter((call) => call.path === '/accounts/me/').every((call) => call.auth === 'Bearer access-2')).toBe(true)
    expect(sessionStorage.getItem(REFRESH_STORAGE_KEY)).toBe('refresh-2')
  })

  test('failed restoration clears the session and lands on sign-in once, without looping', async () => {
    const rec = recorder()
    server.use(http.post(url('/accounts/refresh/'), async ({ request }) => {
      await rec.record(request)
      return fail(401, 'TOKEN_NOT_VALID', 'Token is invalid or expired.')
    }))
    storeRefreshToken('stale')

    render(<TestApp path="/profile" />)

    expect(await screen.findByText('Your session has ended. Sign in again.')).toBeVisible()
    expect(location()).toBe('/sign-in?next=%2Fprofile')
    expect(sessionStorage.getItem(REFRESH_STORAGE_KEY)).toBeNull()
    await delay(30)
    expect(rec.count('/accounts/refresh/')).toBe(1)
  })

  test.each([
    ['a network failure on refresh', 'refresh', () => HttpResponse.error()],
    ['a 503 on refresh', 'refresh', () => fail(503, 'SERVICE_UNAVAILABLE', 'Service unavailable.')],
    ['a 429 on refresh', 'refresh', () => fail(429, 'THROTTLED', 'Too many requests.')],
    ['a 500 on current user', 'me', () => fail(500, 'SERVER_ERROR', 'Internal error.')],
  ])('%s keeps the stored session and offers a retry', async (_label, stage, respond) => {
    const rec = recorder()
    const [refresh, me] = sessionHandlers(rec)
    if (stage === 'refresh') server.use(http.post(url('/accounts/refresh/'), respond))
    else server.use(refresh, http.get(url('/accounts/me/'), respond))
    storeRefreshToken('refresh-1')
    const history = []
    render(<TestApp path="/profile" history={history} />)

    expect(await screen.findByRole('heading', { name: "We couldn't restore your session" })).toBeVisible()
    expect(location()).toBe('/profile')
    expect(history).not.toContain('/sign-in?next=%2Fprofile')
    expect(sessionStorage.getItem(REFRESH_STORAGE_KEY)).not.toBeNull()

    server.resetHandlers(refresh, me)
    await userEvent.setup().click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findByRole('heading', { name: 'Amina Yusuf' })).toBeVisible()
    expect(location()).toBe('/profile')
  })

  test('signing out from the restore-failure screen clears the session', async () => {
    server.use(
      http.post(url('/accounts/refresh/'), () => HttpResponse.error()),
      http.post(url('/accounts/logout/'), () => HttpResponse.error()),
    )
    storeRefreshToken('refresh-1')
    render(<TestApp path="/profile" />)
    await userEvent.setup().click(await screen.findByRole('button', { name: 'Sign out' }))
    expect(await screen.findByText('You have signed out.')).toBeVisible()
    expect(location()).toBe('/sign-in')
    expect(sessionStorage.getItem(REFRESH_STORAGE_KEY)).toBeNull()
  })

  test('a 401 on current user during restoration clears the session without another refresh', async () => {
    const rec = recorder()
    const [refresh] = sessionHandlers(rec)
    server.use(refresh, http.get(url('/accounts/me/'), async ({ request }) => {
      await rec.record(request)
      return fail(401, 'NOT_AUTHENTICATED', 'Authentication required.')
    }))
    storeRefreshToken()
    render(<TestApp path="/profile" />)
    expect(await screen.findByRole('heading', { name: 'Welcome back to Pythagoras' })).toBeVisible()
    expect(sessionStorage.getItem(REFRESH_STORAGE_KEY)).toBeNull()
    expect(rec.count('/accounts/refresh/')).toBe(1)
    expect(rec.count('/accounts/me/')).toBe(1)
  })

  test('an inactive account (403 on current user) is not restored', async () => {
    const rec = recorder()
    const [refresh] = sessionHandlers(rec)
    server.use(refresh, http.get(url('/accounts/me/'), () => fail(403, 'ACCOUNT_INACTIVE', 'This account is inactive.')))
    storeRefreshToken()
    render(<TestApp path="/" />)
    expect(await screen.findByRole('heading', { name: 'Welcome back to Pythagoras' })).toBeVisible()
    expect(location()).toBe('/sign-in')
    expect(sessionStorage.getItem(REFRESH_STORAGE_KEY)).toBeNull()
    expect(getAccessToken()).toBeNull()
  })

  test('without a stored session no request is made', async () => {
    render(<TestApp path="/" />)
    expect(await screen.findByRole('heading', { name: 'Welcome back to Pythagoras' })).toBeVisible()
    expect(location()).toBe('/sign-in')
  })
})

describe('sign-in', () => {
  test('signs in with email_or_matric, stores only the refresh token, and returns to the requested page', async () => {
    const rec = recorder()
    server.use(http.post(url('/accounts/login/'), async ({ request }) => {
      await rec.record(request)
      return ok({ user: student, tokens: { access: 'access-1', refresh: 'refresh-1' } }, 'Signed in.')
    }))
    const user = userEvent.setup()
    render(<TestApp path="/profile" />)
    await screen.findByRole('heading', { name: 'Welcome back to Pythagoras' })

    await signIn(user, '  CSC/21/001 ')

    expect(await screen.findByRole('heading', { name: 'Amina Yusuf' })).toBeVisible()
    expect(location()).toBe('/profile')
    expect(rec.calls).toEqual([{
      method: 'POST', path: '/accounts/login/', auth: null,
      body: { email_or_matric: 'CSC/21/001', password: 'correct horse' },
    }])
    expect({ ...sessionStorage }).toEqual({ [REFRESH_STORAGE_KEY]: 'refresh-1', theme: 'light' })
    expect(localStorage.length).toBe(0)
    expect(getAccessToken()).toBe('access-1')
  })

  test.each([
    [400, 'AUTHENTICATION_FAILED', 'Unable to sign in with the provided credentials.'],
    [403, 'ACCOUNT_INACTIVE', 'This account is inactive. Contact an administrator.'],
    [429, 'THROTTLED', 'Too many sign-in attempts. Try again later.'],
  ])('shows the API error for a %i sign-in failure and stays signed out', async (status, code, message) => {
    server.use(http.post(url('/accounts/login/'), () => fail(status, code, message)))
    const user = userEvent.setup()
    render(<TestApp path="/sign-in" />)
    await signIn(user)
    expect(await screen.findByRole('alert')).toHaveTextContent(message)
    expect(location()).toBe('/sign-in')
    expect(sessionStorage.getItem(REFRESH_STORAGE_KEY)).toBeNull()
    expect(screen.getByLabelText('Password')).toHaveValue('')
  })

  test('shows a connection error when the API is unreachable', async () => {
    server.use(http.post(url('/accounts/login/'), () => HttpResponse.error()))
    const user = userEvent.setup()
    render(<TestApp path="/sign-in" />)
    await signIn(user)
    expect(await screen.findByRole('alert')).toHaveTextContent('Unable to reach the server')
  })
})

describe('logout and forced sign-out', () => {
  async function restoredAt(path, extra = []) {
    const rec = recorder()
    server.use(...sessionHandlers(rec), ...extra)
    storeRefreshToken()
    render(<TestApp path={path} />)
    await screen.findByRole('heading', { name: 'Amina Yusuf' })
    return rec
  }

  test('logout revokes the refresh token and clears the session', async () => {
    const calls = recorder()
    const rec = await restoredAt('/profile', [http.post(url('/accounts/logout/'), async ({ request }) => {
      await calls.record(request)
      return new HttpResponse(null, { status: 204 })
    })])
    await userEvent.setup().click(screen.getByRole('button', { name: 'Sign out' }))

    expect(await screen.findByText('You have signed out.')).toBeVisible()
    expect(location()).toBe('/sign-in')
    expect(calls.calls).toEqual([{ method: 'POST', path: '/accounts/logout/', auth: 'Bearer access-2', body: { refresh: 'refresh-2' } }])
    expect(sessionStorage.getItem(REFRESH_STORAGE_KEY)).toBeNull()
    expect(getAccessToken()).toBeNull()
    expect(rec.count('/accounts/refresh/')).toBe(1)
  })

  test.each([
    ['a server error', () => fail(500, 'SERVER_ERROR', 'Internal error.')],
    ['a 401', () => fail(401, 'NOT_AUTHENTICATED', 'Expired.')],
    ['a network failure', () => HttpResponse.error()],
  ])('logout still clears local state after %s', async (_label, respond) => {
    const rec = await restoredAt('/profile', [http.post(url('/accounts/logout/'), respond)])
    await userEvent.setup().click(screen.getByRole('button', { name: 'Sign out' }))
    expect(await screen.findByText('You have signed out.')).toBeVisible()
    expect(location()).toBe('/sign-in')
    expect(sessionStorage.getItem(REFRESH_STORAGE_KEY)).toBeNull()
    expect(getAccessToken()).toBeNull()
    expect(rec.count('/accounts/refresh/')).toBe(1)
  })

  test('a refresh failure during use signs out and returns to sign-in with the current page', async () => {
    const refreshCalls = []
    await restoredAt('/profile', [http.patch(url('/accounts/me/'), () => fail(401, 'NOT_AUTHENTICATED', 'Token expired.'))])
    server.use(http.post(url('/accounts/refresh/'), () => {
      refreshCalls.push(1)
      return fail(401, 'TOKEN_NOT_VALID', 'Token is blacklisted.')
    }))
    const user = userEvent.setup()
    const field = screen.getByLabelText('Department')
    await user.clear(field)
    await user.type(field, 'Mathematics')
    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    expect(await screen.findByText('Your session has ended. Sign in again.')).toBeVisible()
    expect(location()).toBe('/sign-in?next=%2Fprofile')
    expect(refreshCalls).toHaveLength(1)
    expect(sessionStorage.getItem(REFRESH_STORAGE_KEY)).toBeNull()
  })
})
