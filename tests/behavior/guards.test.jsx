import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http } from 'msw'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { buildSignInPath, getSafeReturnPath } from '../../src/features/auth/returnPath.js'
import { server } from '../mocks/server.js'
import { admin, ok, recorder, resetSession, sessionHandlers, storeRefreshToken, student, url, useApiOrigin } from '../fixtures/auth.js'
import { TestApp } from '../fixtures/TestApp.jsx'

beforeEach(useApiOrigin)
afterEach(resetSession)

const location = () => screen.getByTestId('location').textContent

function restoreAs(user) {
  server.use(...sessionHandlers(recorder(), user))
  storeRefreshToken()
}

async function signInAs(user) {
  server.use(http.post(url('/accounts/login/'), () => ok({ user, tokens: { access: 'a', refresh: 'r' } })))
  const actor = userEvent.setup()
  await actor.type(await screen.findByLabelText('Email or matric number'), user.email)
  await actor.type(screen.getByLabelText('Password'), 'pw')
  await actor.click(screen.getByRole('button', { name: 'Sign in' }))
}

describe('return destination validation', () => {
  test.each([
    ['/profile', '/profile'],
    ['/admin/students?page=2#top', '/admin/students?page=2#top'],
    ['/dawah/events/3', '/dawah/events/3'],
  ])('accepts in-app path %s', (value, expected) => {
    expect(getSafeReturnPath(value)).toBe(expected)
  })

  test.each([
    'https://evil.example/profile',
    '//evil.example/profile',
    '/\\evil.example',
    '\\\\evil.example',
    'javascript:alert(1)',
    ' /profile',
    '/pro\nfile',
    '/pro\u0000file',
    'profile',
    '/sign-in',
    '/sign-up/',
    '',
    null,
    undefined,
    `/${'a'.repeat(3000)}`,
  ])('rejects unsafe or looping destination %j', (value) => {
    expect(getSafeReturnPath(value)).toBeNull()
  })

  test('builds a sign-in path carrying only safe destinations', () => {
    expect(buildSignInPath({ pathname: '/profile', search: '?x=1', hash: '' })).toBe('/sign-in?next=%2Fprofile%3Fx%3D1')
    expect(buildSignInPath({ pathname: '/', search: '', hash: '' })).toBe('/sign-in')
    expect(buildSignInPath({ pathname: '//evil.example', search: '', hash: '' })).toBe('/sign-in')
  })
})

describe('route guards', () => {
  test('unauthenticated visitors are sent to sign-in with the return path, then back after sign-in', async () => {
    render(<TestApp path="/profile?tab=details" />)
    expect(await screen.findByRole('heading', { name: 'Welcome back to Pythagoras' })).toBeVisible()
    expect(location()).toBe('/sign-in?next=%2Fprofile%3Ftab%3Ddetails')

    await signInAs(student)
    expect(await screen.findByRole('heading', { name: 'Amina Yusuf' })).toBeVisible()
    expect(location()).toBe('/profile?tab=details')
  })

  test('admin pages redirect anonymous visitors to sign-in', async () => {
    render(<TestApp path="/admin/students" />)
    await screen.findByRole('heading', { name: 'Welcome back to Pythagoras' })
    expect(location()).toBe('/sign-in?next=%2Fadmin%2Fstudents')
  })

  test.each(['https://evil.example/x', '//evil.example', '/\\evil.example', 'javascript:alert(1)'])(
    'an unsafe next=%s is ignored after sign-in', async (next) => {
      render(<TestApp path={`/sign-in?next=${encodeURIComponent(next)}`} />)
      await signInAs(student)
      expect(await screen.findByText(/Assalamu Alaykum/)).toBeVisible()
      expect(location()).toBe('/')
    })

  test('admins land on /admin by default after sign-in', async () => {
    render(<TestApp path="/sign-in" />)
    await signInAs(admin)
    expect(await screen.findByRole('heading', { name: 'Welcome to Admin Dashboard' })).toBeVisible()
    expect(location()).toBe('/admin')
  })

  test('students are blocked from admin routes', async () => {
    restoreAs(student)
    render(<TestApp path="/admin" />)
    expect(await screen.findByRole('heading', { name: 'Access denied' })).toBeVisible()
    expect(screen.queryByRole('heading', { name: 'Welcome to Admin Dashboard' })).not.toBeInTheDocument()
    expect(location()).toBe('/admin')
  })

  test('admins reach admin routes', async () => {
    restoreAs(admin)
    render(<TestApp path="/admin" />)
    expect(await screen.findByRole('heading', { name: 'Welcome to Admin Dashboard' })).toBeVisible()
  })

  test('signed-in users visiting sign-in are sent to their destination', async () => {
    restoreAs(student)
    render(<TestApp path="/sign-in?next=%2Fprofile" />)
    expect(await screen.findByRole('heading', { name: 'Amina Yusuf' })).toBeVisible()
    expect(location()).toBe('/profile')
  })

  test.each(['/verification-code', '/account-activation', '/create-profile', '/profile-verified', '/academics', '/empowerment'])(
    'deferred route %s is not mounted', async (path) => {
      restoreAs(student)
      render(<TestApp path={path} />)
      expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeVisible()
    })

  test('navigation shows only mounted destinations', async () => {
    restoreAs(student)
    render(<TestApp path="/" />)
    await screen.findByText(/Assalamu Alaykum/)
    const links = screen.getAllByRole('link').map((link) => link.getAttribute('href'))
    expect(links).toEqual(expect.arrayContaining(['/', '/profile']))
    for (const hidden of ['/dawah', '/academics', '/empowerment', '/admin']) expect(links).not.toContain(hidden)
    expect(screen.queryByText(/verif/i)).not.toBeInTheDocument()
  })
})

describe('domain route slots', () => {
  const slots = {
    studentRoutes: [
      { path: 'learn', element: <h1>Private slot page</h1> },
      { path: 'library', public: true, element: <h1>Public slot page</h1> },
    ],
    adminRoutes: [{ path: 'reports', children: [{ index: true, element: <h1>Admin slot page</h1> }] }],
  }

  test('protected student slots require a session; public slots do not', async () => {
    const { unmount } = render(<TestApp path="/library" routeProps={slots} />)
    expect(await screen.findByRole('heading', { name: 'Public slot page' })).toBeVisible()
    expect(screen.getByRole('link', { name: 'Sign in' })).toBeVisible()
    unmount()

    render(<TestApp path="/learn" routeProps={slots} />)
    await screen.findByRole('heading', { name: 'Welcome back to Pythagoras' })
    expect(location()).toBe('/sign-in?next=%2Flearn')
  })

  test('admin slots mount under /admin behind the admin guard', async () => {
    restoreAs(student)
    const { unmount } = render(<TestApp path="/admin/reports" routeProps={slots} />)
    expect(await screen.findByRole('heading', { name: 'Access denied' })).toBeVisible()
    unmount()
    resetSession()

    restoreAs(admin)
    render(<TestApp path="/admin/reports" routeProps={slots} />)
    expect(await screen.findByRole('heading', { name: 'Admin slot page' })).toBeVisible()
  })

  test('shipped slot modules are empty, build-safe arrays', async () => {
    const modules = await Promise.all([
      import('../../src/features/dawah/adminRoutes.jsx'),
      import('../../src/features/dawah/studentRoutes.jsx'),
      import('../../src/features/assessments/adminRoutes.jsx'),
      import('../../src/features/assessments/studentRoutes.jsx'),
      import('../../src/features/communication/routes.jsx'),
    ])
    for (const module of modules) expect(module.default).toEqual([])
  })
})
