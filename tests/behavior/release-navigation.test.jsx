import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import RouteBoundary from '../../src/routes/RouteBoundary.jsx'
import { isChunkLoadError } from '../../src/routes/chunkError.js'
import { lazyPage } from '../../src/routes/lazyPage.js'
import { server } from '../mocks/server.js'
import { admin, fail, ok, recorder, resetSession, sessionHandlers, storeRefreshToken, student, url, useApiOrigin } from '../fixtures/auth.js'
import { adminDashboardHandlers, emptyPage, page, studentDashboardHandlers } from '../fixtures/dashboard.js'
import { TestApp } from '../fixtures/TestApp.jsx'

beforeEach(useApiOrigin)
afterEach(resetSession)
// Let in-flight dashboard requests settle before handlers are reset, so none leaks into the next test.
afterEach(() => vi.waitFor(() => expect(screen.queryAllByText(/^Loading/)).toHaveLength(0)))

const location = () => screen.getByTestId('location').textContent
const hrefs = (nav) => [...nav.querySelectorAll('a')].map((a) => a.getAttribute('href'))

function restoreAs(user) {
  server.use(...sessionHandlers(recorder(), user))
  storeRefreshToken()
}

function useDashboards({ studentOverrides, counts } = {}) {
  const adminSide = adminDashboardHandlers(counts)
  const studentSide = studentDashboardHandlers(studentOverrides)
  // Earlier handlers take precedence: on "/" the student sources win for shared paths.
  server.use(...studentSide.handlers, ...adminSide.handlers)
  return { student: studentSide, admin: adminSide }
}

function useAdminDashboard(counts) {
  const side = adminDashboardHandlers(counts)
  server.use(...side.handlers)
  return side
}

/** Small screens: matchMedia reports no match for the desktop breakpoint. */
function mobileViewport() {
  vi.stubGlobal('matchMedia', (query) => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {} }))
}

const PROTOTYPE = /academics|empowerment|verif|activation|create-profile|prayer|hijri/i
const STALE_CLAIMS = /prayer|hijri|points earned|total points earned|streak|leaderboard|progress overview|continue listening|recent activity/i

function expectNoPrototypeLinks() {
  for (const link of screen.queryAllByRole('link')) expect(link.getAttribute('href')).not.toMatch(PROTOTYPE)
  expect(screen.queryByText(STALE_CLAIMS)).not.toBeInTheDocument()
}

describe('student and public navigation', () => {
  test('anonymous visitors see the Da’wah archive plus sign in and sign up only', async () => {
    // /dawah is public; answer its archive and upcoming-events requests.
    server.use(...studentDashboardHandlers().handlers)
    server.use(http.get(url('/dawah/archive/'), () => ok(emptyPage)))
    render(<TestApp path="/dawah" />)
    const nav = await screen.findByRole('navigation', { name: 'Primary' })
    expect(hrefs(nav)).toEqual(['/dawah'])
    expect(within(nav).getByRole('link', { name: "Da'wah archive" })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/sign-in')
    expect(screen.getByRole('link', { name: 'Sign up' })).toHaveAttribute('href', '/sign-up')
    expect(screen.queryByRole('button', { name: 'Sign out' })).not.toBeInTheDocument()
    expectNoPrototypeLinks()
  })

  test('while the session is restoring the sidebar claims neither signed-in nor signed-out', async () => {
    let releaseMe
    const meGate = new Promise((resolve) => { releaseMe = resolve })
    const [refresh] = sessionHandlers(recorder(), student)
    server.use(refresh, http.get(url('/accounts/me/'), async () => { await meGate; return ok(student) }))
    server.use(...studentDashboardHandlers().handlers, http.get(url('/dawah/archive/'), () => ok(emptyPage)))
    storeRefreshToken()
    render(<TestApp path="/dawah" />)
    expect(await screen.findByTestId('session-skeleton')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Sign in' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Sign up' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Sign out' })).not.toBeInTheDocument()
    releaseMe()
    expect(await screen.findByRole('button', { name: 'Sign out' })).toBeVisible()
    expect(screen.queryByTestId('session-skeleton')).not.toBeInTheDocument()
  })

  test('students get every mounted Phase 1 destination, highlighted by section', async () => {
    restoreAs(student)
    useDashboards()
    const user = userEvent.setup()
    render(<TestApp path="/" />)
    const nav = await screen.findByRole('navigation', { name: 'Primary' })
    await waitFor(() => expect(hrefs(nav)).toEqual(['/', '/dawah', '/dawah/quizzes', '/dawah/classes', '/profile/results', '/profile']))
    expect(within(nav).getByRole('link', { name: 'Home' })).toHaveAttribute('aria-current', 'page')
    expect(within(nav).queryByRole('link', { name: 'Admin panel' })).not.toBeInTheDocument()

    await user.click(within(nav).getByRole('link', { name: 'My results' }))
    expect(location()).toBe('/profile/results')
    const current = await screen.findByRole('navigation', { name: 'Primary' })
    await waitFor(() => expect(within(current).getByRole('link', { name: 'My results' })).toHaveAttribute('aria-current', 'page'))
    // /profile/results must not also highlight Profile (exact match), nor Home.
    expect(within(current).getByRole('link', { name: 'Profile' })).not.toHaveAttribute('aria-current')
    expect(within(current).getByRole('link', { name: 'Home' })).not.toHaveAttribute('aria-current')
    expectNoPrototypeLinks()
  })

  test('admins also get an Admin panel link from the student layout', async () => {
    restoreAs(admin)
    useDashboards()
    render(<TestApp path="/" />)
    const nav = await screen.findByRole('navigation', { name: 'Primary' })
    await waitFor(() => expect(hrefs(nav)).toContain('/admin'))
  })

  test('the mobile menu is inert while closed, opens with focus inside, and closes on Escape and navigation', async () => {
    mobileViewport()
    restoreAs(student)
    useDashboards()
    const user = userEvent.setup()
    render(<TestApp path="/" />)
    await screen.findByRole('heading', { name: 'Welcome, Amina' })
    const toggle = screen.getByRole('button', { name: 'Open menu' })
    const panel = document.getElementById(toggle.getAttribute('aria-controls'))
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(panel).toHaveAttribute('inert')

    expect(screen.getByRole('main')).not.toHaveAttribute('inert')

    await user.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    expect(toggle).toHaveAccessibleName('Close menu')
    expect(panel).not.toHaveAttribute('inert')
    // The page behind the open menu is inert; the toggle itself stays usable.
    expect(screen.getByRole('main')).toHaveAttribute('inert')
    expect(screen.getByRole('button', { name: 'Dark mode' })).toHaveAttribute('inert')
    expect(toggle).not.toHaveAttribute('inert')
    await waitFor(() => expect(panel.contains(document.activeElement)).toBe(true))

    await user.keyboard('{Escape}')
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(toggle).toHaveAccessibleName('Open menu')
    expect(panel).toHaveAttribute('inert')
    expect(screen.getByRole('main')).not.toHaveAttribute('inert')
    await waitFor(() => expect(toggle).toHaveFocus())

    // The toggle closes the menu too.
    await user.click(toggle)
    await user.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'false')

    await user.click(toggle)
    await waitFor(() => expect(panel).not.toHaveAttribute('inert'))
    await user.click(within(panel).getByRole('link', { name: 'Arabic classes' }))
    expect(location()).toBe('/dawah/classes')
    await waitFor(() => expect(screen.getByRole('button', { name: 'Open menu' })).toHaveAttribute('aria-expanded', 'false'))
  })
})

describe('admin navigation', () => {
  test('lists only mounted admin destinations with the current section highlighted', async () => {
    restoreAs(admin)
    useAdminDashboard()
    render(<TestApp path="/admin" />)
    const nav = await screen.findByRole('navigation', { name: 'Admin sections' })
    expect(hrefs(nav)).toEqual([
      '/admin', '/admin/students', '/admin/events', '/admin/content', '/admin/quizzes', '/admin/classes', '/admin/communication', '/', '/profile',
    ])
    expect(within(nav).getByRole('link', { name: 'Dashboard' })).toHaveAttribute('aria-current', 'page')
    expect(within(nav).getAllByRole('link').filter((a) => a.getAttribute('aria-current') === 'page')).toHaveLength(1)
    expectNoPrototypeLinks()
  })

  test('deep links highlight their section (communication automations → Communication)', async () => {
    restoreAs(admin)
    server.use(http.get(url('/dawah/automations/'), () => ok(emptyPage)))
    render(<TestApp path="/admin/communication/automations" />)
    const nav = await screen.findByRole('navigation', { name: 'Admin sections' })
    expect(within(nav).getByRole('link', { name: 'Communication' })).toHaveAttribute('aria-current', 'page')
    expect(within(nav).getByRole('link', { name: 'Dashboard' })).not.toHaveAttribute('aria-current')
  })

  test('the mobile admin menu is inert when closed, makes the page inert when open, and closes on Escape', async () => {
    mobileViewport()
    restoreAs(admin)
    useAdminDashboard()
    const user = userEvent.setup()
    render(<TestApp path="/admin" />)
    await screen.findByRole('heading', { name: 'Admin dashboard' })
    const toggle = screen.getByRole('button', { name: 'Open admin menu' })
    const panel = document.getElementById(toggle.getAttribute('aria-controls'))
    expect(panel).toHaveAttribute('inert')
    await user.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    expect(toggle).toHaveAccessibleName('Close admin menu')
    expect(panel).not.toHaveAttribute('inert')
    // The header (with the toggle, now under the drawer) and the page are inert while it is open.
    expect(toggle.closest('header')).toHaveAttribute('inert')
    expect(screen.getByRole('main').closest('[inert]')).not.toBeNull()
    await user.keyboard('{Escape}')
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(toggle.closest('header')).not.toHaveAttribute('inert')
    await waitFor(() => expect(toggle).toHaveFocus())
    await user.click(toggle)
    await user.click(within(panel).getByRole('button', { name: 'Close admin menu' }))
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
  })
})

describe('student dashboard', () => {
  const panel = (name) => screen.getByRole('region', { name })

  test('shows the current identity and live panels from the feature services', async () => {
    restoreAs(student)
    const { student: sources } = useDashboards()
    render(<TestApp path="/" />)
    expect(await screen.findByRole('heading', { name: 'Welcome, Amina' })).toBeVisible()
    const identity = screen.getByRole('region', { name: 'Welcome, Amina' })
    expect(within(identity).getByText('CSC/21/001')).toBeVisible()
    expect(within(identity).getByText('Computer Science')).toBeVisible()
    expect(within(identity).getByText('300')).toBeVisible()

    const events = panel('Upcoming events')
    expect(await within(events).findByRole('link', { name: /Event 1/ })).toHaveAttribute('href', '/dawah/events/1')
    expect(within(events).getByText('20 Nov 2026, 13:00 WAT · Central mosque')).toBeVisible()
    expect(await within(panel('Available quizzes')).findByRole('link', { name: /Arabic week 1/ })).toHaveAttribute('href', '/dawah/quizzes/45')
    expect(within(panel('Available quizzes')).getByText('Closes 30 Nov 2036, 21:00 WAT · 30 minutes')).toBeVisible()
    expect(await within(panel('Arabic classes')).findByRole('link', { name: /Arabic for beginners/ })).toHaveAttribute('href', '/dawah/classes/2')
    expect(within(panel('Arabic classes')).getByText('ARB102 · 3 modules')).toBeVisible()
    const results = panel('Recent results')
    expect(await within(results).findByRole('link', { name: /Arabic week 1/ })).toHaveAttribute('href', '/profile/results/9')
    expect(within(results).getByText(/2 \/ 3 points/)).toBeVisible()

    // Each panel's "view all" goes to a mounted destination.
    expect(within(events).getByRole('link', { name: 'Open the archive' })).toHaveAttribute('href', '/dawah')
    expect(within(results).getByRole('link', { name: 'All results' })).toHaveAttribute('href', '/profile/results')

    // Exact requests: public upcoming events carry no bearer; the rest are authenticated.
    const [eventCall] = sources.callsTo('/dawah/events/')
    expect(eventCall.query).toEqual({ upcoming: 'true', page_size: '5' })
    expect(eventCall.auth).toBeNull()
    expect(sources.callsTo('/quiz/quizzes/')[0]).toMatchObject({ query: { page: '1', page_size: '5' }, auth: 'Bearer access-2' })
    expect(sources.callsTo('/quiz/classes/')[0]).toMatchObject({ query: { page: '1', page_size: '5' }, auth: 'Bearer access-2' })
    expect(sources.callsTo('/quiz/submissions/')[0]).toMatchObject({ query: { page: '1', page_size: '3' }, auth: 'Bearer access-2' })
    expectNoPrototypeLinks()
    expect(screen.queryByText(/\b\d+%/)).not.toBeInTheDocument()
  })

  test('each panel loads independently: one pending source does not hold the others', async () => {
    restoreAs(student)
    let release
    const held = new Promise((resolve) => { release = resolve })
    useDashboards({ studentOverrides: { events: async () => { await held; return ok(emptyPage) } } })
    render(<TestApp path="/" />)
    expect(await within(await screen.findByRole('region', { name: 'Available quizzes' })).findByRole('link', { name: /Arabic week 1/ })).toBeVisible()
    expect(within(panel('Upcoming events')).getByRole('status')).toHaveTextContent('Loading upcoming events…')
    await act(async () => release())
    expect(await within(panel('Upcoming events')).findByText('No upcoming events have been published yet.')).toBeVisible()
  })

  test('empty sources show honest empty states, not placeholders', async () => {
    restoreAs(student)
    useDashboards({ studentOverrides: { events: emptyPage, quizzes: emptyPage, classes: emptyPage, results: emptyPage } })
    render(<TestApp path="/" />)
    await screen.findByRole('heading', { name: 'Welcome, Amina' })
    expect(await within(panel('Upcoming events')).findByText('No upcoming events have been published yet.')).toBeVisible()
    expect(await within(panel('Available quizzes')).findByText('No quizzes are open right now.')).toBeVisible()
    expect(await within(panel('Arabic classes')).findByText('No Arabic classes are open yet.')).toBeVisible()
    expect(await within(panel('Recent results')).findByText('You have not submitted a quiz yet.')).toBeVisible()
  })

  test('an admin viewing "/" asks for published quizzes and never sees drafts or past deadlines as available', async () => {
    restoreAs(admin)
    const { student: sources } = useDashboards({
      studentOverrides: {
        quizzes: page([
          { id: 1, title: 'Draft quiz', status: 'draft' },
          { id: 2, title: 'Live quiz', status: 'published', deadline: '2036-01-01T00:00:00Z' },
          { id: 3, title: 'Expired quiz', status: 'published', deadline: '2020-01-01T00:00:00Z' },
        ]),
        classes: page([{ id: 3, code: 'X', title: 'Closed class', status: 'closed' }]),
      },
    })
    render(<TestApp path="/" />)
    expect(await within(await screen.findByRole('region', { name: 'Available quizzes' })).findByText('Live quiz')).toBeVisible()
    expect(screen.queryByText('Draft quiz')).not.toBeInTheDocument()
    expect(screen.queryByText('Expired quiz')).not.toBeInTheDocument()
    expect(sources.callsTo('/quiz/quizzes/')[0].query).toEqual({ status: 'published', page_size: '5' })
    expect(await within(panel('Arabic classes')).findByText('No Arabic classes are open yet.')).toBeVisible()
  })

  test('students never see a quiz past its deadline as available', async () => {
    restoreAs(student)
    useDashboards({ studentOverrides: { quizzes: page([{ id: 3, title: 'Expired quiz', status: 'published', deadline: '2020-01-01T00:00:00Z' }]) } })
    render(<TestApp path="/" />)
    expect(await within(await screen.findByRole('region', { name: 'Available quizzes' })).findByText('No quizzes are open right now.')).toBeVisible()
  })

  test('a failing source shows an error with retry on that panel only', async () => {
    restoreAs(student)
    let failures = 1
    useDashboards({
      studentOverrides: {
        quizzes: () => (failures-- > 0 ? fail(500, 'SERVER_ERROR', 'Quiz service unavailable.') : ok(page([{ id: 7, title: 'Recovered quiz', status: 'published' }]))),
        results: () => HttpResponse.error(),
      },
    })
    const user = userEvent.setup()
    render(<TestApp path="/" />)
    const quizzes = await screen.findByRole('region', { name: 'Available quizzes' })
    const alert = await within(quizzes).findByRole('alert')
    expect(alert).toHaveTextContent('Quizzes could not be loaded')
    expect(alert).toHaveTextContent('Quiz service unavailable.')
    expect(await within(panel('Recent results')).findByRole('alert')).toHaveTextContent('The server could not be reached')
    // Other panels are unaffected.
    expect(await within(panel('Upcoming events')).findByRole('link', { name: /Event 1/ })).toBeVisible()
    await user.click(within(quizzes).getByRole('button', { name: 'Try again' }))
    expect(await within(quizzes).findByRole('link', { name: /Recovered quiz/ })).toBeVisible()
    expect(within(quizzes).queryByRole('alert')).not.toBeInTheDocument()
  })
})

describe('admin dashboard', () => {
  const card = (name) => screen.getByRole('article', { name })
  const value = async (name) => (await within(await screen.findByRole('article', { name })).findByTestId('count-value')).textContent

  test('every card shows the server `count` of its filtered list', async () => {
    restoreAs(admin)
    const side = useAdminDashboard()
    render(<TestApp path="/admin" />)
    expect(await screen.findByRole('heading', { name: 'Admin dashboard' })).toBeVisible()
    expect(screen.getByText(/Signed in as/)).toHaveTextContent('Signed in as Bilal Okafor.')
    expect(await value('Registered students')).toBe('120')
    expect(await value('Active students')).toBe('111')
    expect(await value('Published events')).toBe('7')
    expect(await value('Published quizzes')).toBe('3')
    expect(await value('Draft quizzes')).toBe('2')
    expect(await value('Closed quizzes')).toBe('5')
    expect(await value('Arabic classes')).toBe('4')
    expect(await value('Broadcasts in progress')).toBe('≈approximately 3') // queued 1 + processing 2, two snapshots
    expect(within(card('Broadcasts in progress')).getByText(/Approximate: queued plus processing/)).toBeVisible()
    expect(await value('Uncertain broadcasts')).toBe('1')
    expect(await value('Automations')).toBe('2')
    expect(within(card('Automations')).getByText('enabled of 3 rules')).toBeVisible()

    const queries = side.calls.map((call) => `${call.path}?${new URLSearchParams(call.query)}`).sort()
    expect(queries).toEqual([
      '/accounts/students/?is_active=true&page_size=1',
      '/accounts/students/?page_size=1',
      '/dawah/automations/?page=1&page_size=100',
      '/dawah/broadcasts/?kind=history&state=processing&page_size=1',
      '/dawah/broadcasts/?kind=history&state=queued&page_size=1',
      '/dawah/broadcasts/?kind=history&state=uncertain&page_size=1',
      '/dawah/events/?status=published&page_size=1',
      '/quiz/classes/?page_size=1',
      '/quiz/quizzes/?status=closed&page_size=1',
      '/quiz/quizzes/?status=draft&page_size=1',
      '/quiz/quizzes/?status=published&page_size=1',
    ])
    expect(side.calls.every((call) => call.auth === 'Bearer access-2')).toBe(true)
  })

  test('cards link to working admin destinations and shortcuts are real routes', async () => {
    restoreAs(admin)
    useAdminDashboard()
    render(<TestApp path="/admin" />)
    await screen.findByRole('heading', { name: 'Admin dashboard' })
    expect(within(card('Registered students')).getByRole('link', { name: 'Manage students' })).toHaveAttribute('href', '/admin/students')
    expect(within(card('Uncertain broadcasts')).getByRole('link', { name: 'Investigate in history' })).toHaveAttribute('href', '/admin/communication/history')
    const shortcuts = screen.getByRole('region', { name: 'Shortcuts' })
    expect(hrefs(shortcuts)).toEqual([
      '/admin/students', '/admin/events/new', '/admin/content', '/admin/quizzes/new', '/admin/classes/new', '/admin/communication', '/admin/communication/automations/new',
    ])
  })

  test('a failing or malformed source errors on its own card and never shows a number', async () => {
    restoreAs(admin)
    let classFailures = 1
    useAdminDashboard({
      publishedEvents: () => fail(500, 'SERVER_ERROR', 'Events are unavailable.'),
      quizzes: (request) => (new URL(request.url).searchParams.get('status') === 'draft' ? ok({ results: [] }) : ok(page([], 6))),
      classes: () => (classFailures-- > 0 ? fail(403, 'PERMISSION_DENIED', 'Forbidden.') : ok(page([], 9))),
      broadcasts: (request) => (new URL(request.url).searchParams.get('state') === 'processing' ? HttpResponse.error() : ok(page([], 1))),
    })
    const user = userEvent.setup()
    render(<TestApp path="/admin" />)
    await screen.findByRole('heading', { name: 'Admin dashboard' })

    const events = await within(card('Published events')).findByRole('alert')
    expect(events).toHaveTextContent('Published events unavailable')
    expect(events).toHaveTextContent('Events are unavailable.')
    // A list without `count` is a contract error, not zero.
    expect(await within(card('Draft quizzes')).findByRole('alert')).toHaveTextContent('unexpected response')
    // A sum fails closed when either half fails.
    expect(await within(card('Broadcasts in progress')).findByRole('alert')).toBeVisible()
    for (const name of ['Published events', 'Draft quizzes', 'Broadcasts in progress']) {
      expect(within(card(name)).queryByTestId('count-value')).not.toBeInTheDocument()
    }
    // Unaffected cards still show live numbers.
    expect(await value('Published quizzes')).toBe('6')
    expect(await value('Uncertain broadcasts')).toBe('1')

    expect(await within(card('Arabic classes')).findByRole('alert')).toHaveTextContent('You do not have access')
    await user.click(within(card('Arabic classes')).getByRole('button', { name: 'Try again' }))
    expect(await value('Arabic classes')).toBe('9')
  })

  test('shows a loading state per card while its count is pending', async () => {
    restoreAs(admin)
    let release
    const held = new Promise((resolve) => { release = resolve })
    useAdminDashboard({ students: async () => { await held; return ok(page([], 42)) } })
    render(<TestApp path="/admin" />)
    expect(await value('Active students')).toBe('111')
    expect(within(card('Registered students')).getByRole('status')).toHaveTextContent('Loading…')
    await act(async () => release())
    expect(await value('Registered students')).toBe('42')
  })

  test('automations show only the total when not every rule fits on one page', async () => {
    restoreAs(admin)
    useAdminDashboard({ automations: page([{ id: 1, enabled: true }], 150, 'https://api.pythagoras.test/dawah/automations/?page=2') })
    render(<TestApp path="/admin" />)
    expect(await value('Automations')).toBe('150')
    expect(within(card('Automations')).getByText(/rules in total/)).toBeVisible()
  })
})

describe('route-level code splitting', () => {
  function renderBoundary(Page, onReload = vi.fn()) {
    render(
      <MemoryRouter initialEntries={['/page']}>
        <RouteBoundary onReload={onReload}>
          <Routes>
            <Route path="/page" element={<Page />} />
          </Routes>
        </RouteBoundary>
      </MemoryRouter>,
    )
    return onReload
  }

  test('a pending chunk shows an accessible loading status', async () => {
    let resolve
    const Page = lazyPage(() => new Promise((r) => { resolve = r }))
    renderBoundary(Page)
    expect(await screen.findByRole('status')).toHaveTextContent('Loading page…')
    await act(async () => resolve({ default: () => <h1>Loaded page</h1> }))
    expect(await screen.findByRole('heading', { name: 'Loaded page' })).toBeVisible()
  })

  test('a chunk that fails to download shows a reload prompt instead of a blank screen', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const Page = lazyPage(() => Promise.reject(new TypeError('Failed to fetch dynamically imported module: /assets/Page-abc.js')))
    const onReload = renderBoundary(Page)
    const alert = await screen.findByRole('alert')
    expect(within(alert).getByRole('heading', { name: 'This page could not be loaded' })).toBeVisible()
    await userEvent.click(within(alert).getByRole('button', { name: 'Reload page' }))
    expect(onReload).toHaveBeenCalledTimes(1)
  })

  test('other render errors are contained by the same boundary', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const Broken = () => {
      throw new Error('boom')
    }
    renderBoundary(Broken)
    expect(await screen.findByRole('heading', { name: 'Something went wrong on this page' })).toBeVisible()
  })

  test('recognises chunk load errors across browsers', () => {
    expect(isChunkLoadError(new TypeError('Failed to fetch dynamically imported module: x'))).toBe(true)
    expect(isChunkLoadError(new TypeError('error loading dynamically imported module'))).toBe(true)
    expect(isChunkLoadError(new TypeError('Importing a module script failed.'))).toBe(true)
    expect(isChunkLoadError(new Error('boom'))).toBe(false)
  })

  test('domain route modules are lazily loaded pages', async () => {
    const { adminSlotRoutes, studentSlotRoutes } = await import('../../src/routes/slots.js')
    const pages = (routes) => routes.flatMap((route) => [route.element, ...(route.children ? pages(route.children) : [])])
    for (const route of [...studentSlotRoutes, ...adminSlotRoutes]) {
      if (route.children) continue // the communication tab shell stays eager; its tabs are lazy below
      expect(typeof route.element.type.preload, route.path).toBe('function')
    }
    const tabs = adminSlotRoutes.find((route) => route.path === 'communication').children
    for (const tab of tabs) expect(typeof tab.element.props.children.type.preload).toBe('function')
    expect(pages(studentSlotRoutes).length).toBeGreaterThan(0)
  })

  test('a page whose chunk is already loaded renders without a loading flash', async () => {
    const Page = lazyPage(() => Promise.resolve({ default: () => <h1>Ready page</h1> }))
    await Page.preload()
    renderBoundary(Page)
    expect(screen.getByRole('heading', { name: 'Ready page' })).toBeVisible()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })
})
