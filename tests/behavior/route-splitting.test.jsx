import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { lazyPage } from '../../src/routes/lazyPage.js'
import { server } from '../mocks/server.js'
import { admin, recorder, resetSession, sessionHandlers, storeRefreshToken, student, useApiOrigin } from '../fixtures/auth.js'
import { adminDashboardHandlers, studentDashboardHandlers } from '../fixtures/dashboard.js'
// Deliberately NOT TestApp.jsx: nothing is preloaded here, so every page loads on demand.
import { TestApp } from '../fixtures/AppHarness.jsx'

// Records whether the admin layout chunk (module) was ever imported in this file.
const chunks = vi.hoisted(() => ({ adminLayout: 0, events: [] }))
vi.mock('../../src/components/layout/AdminLayout.jsx', async (importOriginal) => {
  chunks.adminLayout += 1
  chunks.events.push('layout:start')
  await new Promise((resolve) => setTimeout(resolve, 50)) // a slow layout chunk
  const module = await importOriginal()
  chunks.events.push('layout:end')
  return module
})
vi.mock('../../src/pages/admin/AdminDashboard.jsx', async (importOriginal) => {
  chunks.events.push('dashboard:start')
  return importOriginal()
})

beforeEach(useApiOrigin)
afterEach(resetSession)
afterEach(() => vi.waitFor(() => expect(screen.queryAllByText(/^Loading/)).toHaveLength(0)))

const location = () => screen.getByTestId('location').textContent
const main = () => screen.getByRole('main')

function restoreAs(user) {
  server.use(...sessionHandlers(recorder(), user), ...studentDashboardHandlers().handlers)
  storeRefreshToken()
}

/** A page whose chunk download the test controls. */
function controlledPage(title) {
  let resolve
  let reject
  const factory = vi.fn(() => new Promise((res, rej) => { resolve = res; reject = rej }))
  const Page = lazyPage(factory)
  return {
    Page,
    factory,
    load: () => act(async () => resolve({ default: () => <h1>{title}</h1> })),
    fail: () => act(async () => reject(new TypeError('Failed to fetch dynamically imported module: /assets/Page.js'))),
  }
}

describe('lazy pages inside the student layout', () => {
  test('the guard decides before a protected page chunk is requested', async () => {
    const learn = controlledPage('Learn page')
    render(<TestApp path="/learn" routeProps={{ studentRoutes: [{ path: 'learn', element: <learn.Page /> }] }} />)
    await screen.findByRole('heading', { name: 'Welcome back to Pythagoras' })
    expect(location()).toBe('/sign-in?next=%2Flearn')
    expect(learn.factory).not.toHaveBeenCalled()
  })

  test('a downloading page shows the fallback inside the layout, then the page', async () => {
    restoreAs(student)
    const learn = controlledPage('Learn page')
    render(<TestApp path="/learn" routeProps={{ studentRoutes: [{ path: 'learn', element: <learn.Page /> }] }} />)
    await screen.findByRole('navigation', { name: 'Primary' })
    expect(await within(main()).findByText('Loading page…')).toBeVisible()
    await waitFor(() => expect(main()).toHaveAttribute('aria-busy', 'true'))
    expect(screen.getByTestId('page-loading')).toHaveTextContent('Loading page…')
    await learn.load()
    expect(await within(main()).findByRole('heading', { name: 'Learn page' })).toBeVisible()
    await waitFor(() => expect(main()).toHaveAttribute('aria-busy', 'false'))
    expect(screen.queryByTestId('page-loading')).not.toBeInTheDocument()
  })

  test('a failed chunk errors inside the layout, and navigating away clears it', async () => {
    restoreAs(student)
    const broken = controlledPage('Never shown')
    const user = userEvent.setup()
    render(<TestApp path="/learn" routeProps={{ studentRoutes: [{ path: 'learn', element: <broken.Page /> }] }} />)
    const nav = await screen.findByRole('navigation', { name: 'Primary' })
    await within(main()).findByText('Loading page…')
    await broken.fail()
    const alert = await within(main()).findByRole('alert')
    expect(within(alert).getByRole('heading', { name: 'This page could not be loaded' })).toBeVisible()
    expect(within(alert).getByRole('button', { name: 'Reload page' })).toBeVisible()
    // The layout (navigation, sign out) is still usable around the failed page.
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeVisible()

    await user.click(within(nav).getByRole('link', { name: 'Profile' }))
    expect(await within(main()).findByRole('heading', { name: 'Amina Yusuf' })).toBeVisible()
    expect(location()).toBe('/profile')
    expect(within(main()).queryByRole('alert')).not.toBeInTheDocument()
  })

  test('in-layout navigation to a not-yet-loaded page keeps the old page but shows a pending status', async () => {
    restoreAs(student)
    const quizzes = controlledPage('Quiz list page')
    const user = userEvent.setup()
    render(<TestApp path="/profile" routeProps={{ studentRoutes: [{ path: 'dawah/quizzes', element: <quizzes.Page /> }] }} />)
    await screen.findByRole('main')
    expect(await within(main()).findByRole('heading', { name: 'Amina Yusuf' })).toBeVisible()
    await waitFor(() => expect(main()).toHaveAttribute('aria-busy', 'false'))

    await user.click(within(screen.getByRole('navigation', { name: 'Primary' })).getByRole('link', { name: 'Quizzes' }))
    // React Router navigates in a transition: the previous page stays on screen...
    expect(await screen.findByTestId('page-loading')).toHaveTextContent('Loading page…')
    expect(main()).toHaveAttribute('aria-busy', 'true')
    expect(within(main()).getByRole('heading', { name: 'Amina Yusuf' })).toBeVisible()

    await quizzes.load()
    expect(await within(main()).findByRole('heading', { name: 'Quiz list page' })).toBeVisible()
    expect(location()).toBe('/dawah/quizzes')
    await waitFor(() => expect(screen.queryByTestId('page-loading')).not.toBeInTheDocument())
    expect(main()).toHaveAttribute('aria-busy', 'false')
  })

  test('hovering or focusing a navigation link preloads its page without a pending status', async () => {
    restoreAs(student)
    const classes = controlledPage('Classes page')
    const user = userEvent.setup()
    render(<TestApp path="/profile" routeProps={{ studentRoutes: [{ path: 'dawah/classes', element: <classes.Page /> }] }} />)
    await screen.findByRole('main')
    await within(main()).findByRole('heading', { name: 'Amina Yusuf' })
    const link = within(screen.getByRole('navigation', { name: 'Primary' })).getByRole('link', { name: 'Arabic classes' })
    expect(classes.factory).not.toHaveBeenCalled()
    await user.hover(link)
    expect(classes.factory).toHaveBeenCalledTimes(1)
    expect(screen.queryByTestId('page-loading')).not.toBeInTheDocument()
    await classes.load()
    // Already downloaded: the click renders the page at once, with no fallback.
    await user.click(link)
    expect(within(main()).getByRole('heading', { name: 'Classes page' })).toBeVisible()
    expect(classes.factory).toHaveBeenCalledTimes(1)
  })
})

describe('admin layout chunk', () => {
  test('a student on /admin is denied without the admin layout chunk ever being imported', async () => {
    restoreAs(student)
    render(<TestApp path="/admin" />)
    expect(await screen.findByRole('heading', { name: 'Access denied' })).toBeVisible()
    expect(chunks.adminLayout).toBe(0)
  })

  test('an admin loads the admin layout and the matched page together', async () => {
    restoreAs(admin)
    server.use(...adminDashboardHandlers().handlers)
    render(<TestApp path="/admin" />)
    expect(await screen.findByRole('heading', { name: 'Admin dashboard' }, { timeout: 5000 })).toBeVisible()
    expect(chunks.adminLayout).toBe(1)
    // The dashboard chunk was requested while the layout chunk was still downloading.
    expect(chunks.events.indexOf('dashboard:start')).toBeGreaterThan(-1)
    expect(chunks.events.indexOf('dashboard:start')).toBeLessThan(chunks.events.indexOf('layout:end'))
  })
})
