import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http } from 'msw'
import { Link, MemoryRouter } from 'react-router-dom'
import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'
import App, { AppRoot } from '../../src/App.jsx'
import AnalyticsProvider from '../../src/features/analytics/AnalyticsProvider.jsx'
import { createAnalytics } from '../../src/features/analytics/analytics.js'
import { readAnalyticsConfig } from '../../src/features/analytics/config.js'
import { CONSENT_STORAGE_KEY, clearAnalyticsCookies } from '../../src/features/analytics/consent.js'
import { analyticsRouteTree, describeRoute, NOT_FOUND_TEMPLATE, PAGE_TITLES } from '../../src/features/analytics/routeTemplates.js'
import AuthProvider from '../../src/features/auth/AuthProvider.jsx'
import { preloadAllPages } from '../../src/routes/lazyPage.js'
import { preloadTreeFor } from '../../src/routes/routePreload.js'
import { adminSlotRoutes, studentSlotRoutes } from '../../src/routes/slots.js'
import { fail, ok, resetSession, student, url, useApiOrigin } from '../fixtures/auth.js'
import { LocationProbe } from '../fixtures/AppHarness.jsx'
import { server } from '../mocks/server.js'

// PLAT-08 (D1 "Phase 1 analytics"): consent gating, DNT, sanitized page views, sign_up once, withdrawal, failures.
const ID = 'G-PLAT08TEST'
const ORIGIN = window.location.origin
const SCRIPT = 'script[data-pythagoras-analytics]'

beforeAll(() => preloadAllPages())
beforeEach(useApiOrigin)
afterEach(() => {
  resetSession()
  document.querySelectorAll(SCRIPT).forEach((node) => node.remove())
  delete window.dataLayer
  delete window[`ga-disable-${ID}`]
  clearAnalyticsCookies(document)
})

// Stub domain pages: the real Layout, guards and route composition, without domain API traffic.
const Page = ({ name }) => (
  <div>
    <h1>{name}</h1>
    <Link to="/dawah">Archive</Link>
    <Link to="/dawah/events/42?utm_source=mail&email=student%40example.test#speaker">Event 42</Link>
    <Link to="/dawah/events/43">Event 43</Link>
    <Link to="/dawah/events/43?page=2">Event 43 page 2</Link>
    <Link to="/dawah/content/7">Content 7</Link>
    <Link to="/privacy">Privacy</Link>
    <Link to="/sign-up">Register</Link>
    <Link to="/no/such/page/CSC-21-001">Broken</Link>
  </div>
)
const studentRoutes = [
  { path: 'dawah', public: true, element: <Page name="Archive page" /> },
  { path: 'dawah/events/:id', public: true, element: <Page name="Event page" /> },
  { path: 'dawah/content/:id', public: true, element: <Page name="Content page" /> },
]

function renderApp(analytics, path = '/dawah') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AppRootWithRoutes analytics={analytics} />
      <LocationProbe />
    </MemoryRouter>,
  )
}

// The same composition as AppRoot (main.jsx), with the stub routes passed through App's props.
function AppRootWithRoutes({ analytics }) {
  return (
    <AnalyticsProvider analytics={analytics}>
      <AuthProvider onRegistered={analytics?.trackSignUp}>
        <App studentRoutes={studentRoutes} adminRoutes={[]} />
      </AuthProvider>
    </AnalyticsProvider>
  )
}

const commands = () => (window.dataLayer ?? []).map((entry) => Array.from(entry))
const events = (name) => commands().filter(([kind, event]) => kind === 'event' && event === name).map(([, , params]) => params)
const pageViews = () => events('page_view')
const settle = () => new Promise((resolve) => setTimeout(resolve, 450)) // > RouteAnalytics settle delay
const grant = () => localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify({ v: 1, choice: 'granted', at: '2026-11-01T00:00:00.000Z' }))
const stored = () => JSON.parse(localStorage.getItem(CONSENT_STORAGE_KEY))
const leaks = (text) => /42|43|CSC|student|example\.test|utm|email|speaker|\?|#/.test(text)

describe('configuration', () => {
  test('a public GA4 measurement ID enables analytics; anything else keeps it fully off', () => {
    expect(readAnalyticsConfig({ VITE_GA_MEASUREMENT_ID: ' g-abc123 ' })).toEqual({ measurementId: 'G-ABC123' })
    for (const value of [undefined, '', 'UA-1234-1', 'G-', 'G-abc"><script>', 'GTM-ABC123']) {
      expect(readAnalyticsConfig({ VITE_GA_MEASUREMENT_ID: value })).toBeNull()
    }
  })

  test('without a measurement ID there is no banner, no script, no dataLayer, and settings say so', async () => {
    const user = userEvent.setup()
    renderApp(createAnalytics(null))
    expect(await screen.findByRole('heading', { name: 'Archive page' })).toBeVisible()
    expect(screen.queryByTestId('analytics-consent')).toBeNull()
    await user.click(screen.getByRole('link', { name: 'Event 43' }))
    await settle()
    await user.click(screen.getByRole('link', { name: 'Privacy' }))
    expect(await screen.findByTestId('analytics-status')).toHaveTextContent('Analytics is not used on this site.')
    expect(screen.queryByRole('button', { name: /allow analytics/i })).toBeNull()
    expect(document.querySelector(SCRIPT)).toBeNull()
    expect(window.dataLayer).toBeUndefined()
  })
})

describe('before consent', () => {
  test('the banner asks, and nothing loads or is recorded while undecided', async () => {
    const user = userEvent.setup()
    const analytics = createAnalytics({ measurementId: ID })
    renderApp(analytics)
    const banner = await screen.findByRole('region', { name: 'Help us improve Pythagoras?' })
    expect(banner).toHaveAccessibleDescription(/No names, emails, matric numbers/)
    expect(screen.getByRole('button', { name: 'Accept' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Decline' })).toBeVisible()
    await user.click(screen.getByRole('link', { name: 'Event 42' }))
    await settle()
    expect(analytics.trackSignUp()).toBe(false)
    expect(document.querySelector(SCRIPT)).toBeNull()
    expect(window.dataLayer).toBeUndefined()
    expect(localStorage.getItem(CONSENT_STORAGE_KEY)).toBeNull()
  })

  test('the banner links to privacy settings, which hide the banner and offer the same choice', async () => {
    const user = userEvent.setup()
    renderApp(createAnalytics({ measurementId: ID }))
    await user.click(await screen.findByRole('link', { name: 'privacy settings' }))
    expect(await screen.findByRole('heading', { name: 'Privacy settings' })).toBeVisible()
    expect(screen.queryByTestId('analytics-consent')).toBeNull()
    expect(screen.getByTestId('analytics-status')).toHaveTextContent('You have not chosen yet.')
    expect(screen.getByRole('button', { name: 'Allow analytics' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Decline' })).toBeVisible()
  })
})

describe('Do Not Track / Global Privacy Control', () => {
  const fakeWindow = (navigator) => ({ navigator, location: window.location, addEventListener() {} })

  test.each([[{ doNotTrack: '1' }], [{ globalPrivacyControl: true }]])('%j counts as a decline without prompting, even over a stored opt-in', async (navigator) => {
    grant()
    const win = fakeWindow(navigator)
    const user = userEvent.setup()
    const analytics = createAnalytics({ measurementId: ID }, { win, doc: document, storage: localStorage })
    renderApp(analytics)
    expect(await screen.findByRole('heading', { name: 'Archive page' })).toBeVisible()
    expect(screen.queryByTestId('analytics-consent')).toBeNull()
    await user.click(screen.getByRole('link', { name: 'Event 42' }))
    await settle()
    analytics.accept()
    expect(analytics.trackSignUp()).toBe(false)
    await user.click(screen.getByRole('link', { name: 'Privacy' }))
    expect(await screen.findByTestId('analytics-status')).toHaveTextContent(/Do Not Track or Global Privacy Control/)
    expect(screen.queryByRole('button', { name: /allow analytics/i })).toBeNull()
    expect(document.querySelector(SCRIPT)).toBeNull()
    expect(win.dataLayer).toBeUndefined()
    expect(stored().choice).toBe('granted') // untouched: the browser signal wins while it is on
  })
})

describe('after consent', () => {
  test('Accept injects gtag once with safe config, stores a versioned choice and replays nothing', async () => {
    const user = userEvent.setup()
    const analytics = createAnalytics({ measurementId: ID })
    renderApp(analytics, '/dawah/events/42?utm_source=mail#x')
    await screen.findByRole('heading', { name: 'Event page' })
    await settle() // this pre-consent page view is dropped, never replayed
    await user.click(screen.getByRole('button', { name: 'Accept' }))

    expect(screen.queryByTestId('analytics-consent')).toBeNull()
    const scripts = document.querySelectorAll(SCRIPT)
    expect(scripts).toHaveLength(1)
    expect(scripts[0].src).toBe(`https://www.googletagmanager.com/gtag/js?id=${ID}`)
    expect(scripts[0].async).toBe(true)
    expect(stored()).toEqual({ v: 1, choice: 'granted', at: expect.any(String) })

    const [consent, js, set, config, ...rest] = commands()
    expect(consent).toEqual(['consent', 'default', { analytics_storage: 'granted', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' }])
    expect(js[0]).toBe('js')
    expect(set).toEqual(['set', { page_location: `${ORIGIN}/dawah/events/:id`, page_title: 'Event details' }])
    expect(config).toEqual(['config', ID, { send_page_view: false, allow_google_signals: false, allow_ad_personalization_signals: false }])
    expect(rest).toEqual([])
    expect(pageViews()).toEqual([])

    analytics.accept()
    expect(document.querySelectorAll(SCRIPT)).toHaveLength(1)
    expect(commands().filter(([kind]) => kind === 'config')).toHaveLength(1)
  })

  test('one page_view per completed navigation, with route templates and generic titles only', async () => {
    grant()
    const user = userEvent.setup()
    renderApp(createAnalytics({ measurementId: ID }), '/dawah')
    await screen.findByRole('heading', { name: 'Archive page' })
    expect(document.querySelectorAll(SCRIPT)).toHaveLength(1) // stored consent loads the tag at start-up
    await waitFor(() => expect(pageViews()).toHaveLength(1))

    await user.click(screen.getByRole('link', { name: 'Event 42' }))
    await waitFor(() => expect(pageViews()).toHaveLength(2))
    await user.click(screen.getByRole('link', { name: 'Event 43' }))
    await waitFor(() => expect(pageViews()).toHaveLength(3))
    await user.click(screen.getByRole('link', { name: 'Event 43 page 2' })) // query-only change: same page
    await user.click(screen.getByRole('link', { name: 'Content 7' }))
    await waitFor(() => expect(pageViews()).toHaveLength(4))
    await user.click(screen.getByRole('link', { name: 'Broken' }))
    await waitFor(() => expect(pageViews()).toHaveLength(5))
    await settle()

    expect(pageViews()).toEqual([
      { page_location: `${ORIGIN}/dawah`, page_title: "Da'wah archive" },
      { page_location: `${ORIGIN}/dawah/events/:id`, page_title: 'Event details', page_referrer: `${ORIGIN}/dawah` },
      { page_location: `${ORIGIN}/dawah/events/:id`, page_title: 'Event details', page_referrer: `${ORIGIN}/dawah/events/:id` },
      { page_location: `${ORIGIN}/dawah/content/:id`, page_title: 'Content details', page_referrer: `${ORIGIN}/dawah/events/:id` },
      { page_location: `${ORIGIN}${NOT_FOUND_TEMPLATE}`, page_title: 'Page not found', page_referrer: `${ORIGIN}/dawah/content/:id` },
    ])
    expect(leaks(JSON.stringify(commands().slice(2)))).toBe(false) // everything after the gtag('js', Date) command
  })

  test('a guard redirect counts once, as its final page (/profile → /sign-in?next=...)', async () => {
    grant()
    renderApp(createAnalytics({ measurementId: ID }), '/profile')
    expect(await screen.findByLabelText('Email or matric number')).toBeVisible()
    expect(screen.getByTestId('location')).toHaveTextContent('/sign-in?next=%2Fprofile')
    await waitFor(() => expect(pageViews()).toHaveLength(1))
    await settle()
    expect(pageViews()).toEqual([{ page_location: `${ORIGIN}/sign-in`, page_title: 'Sign in' }])
  })

  test('the observer waits for session restoration before reporting a guarded page', async () => {
    grant()
    sessionStorage.setItem('pythagoras.refreshToken', 'refresh-1')
    let releaseRefresh
    const gate = new Promise((resolve) => (releaseRefresh = resolve))
    server.use(
      http.post(url('/accounts/refresh/'), async () => {
        await gate
        return ok({ access: 'access-2', refresh: 'refresh-2' })
      }),
      http.get(url('/accounts/me/'), () => ok(student)),
    )
    renderApp(createAnalytics({ measurementId: ID }), '/profile')
    await settle()
    expect(pageViews()).toEqual([])
    releaseRefresh()
    expect(await screen.findByRole('heading', { name: 'Amina Yusuf' })).toBeVisible()
    await waitFor(() => expect(pageViews()).toHaveLength(1))
    expect(pageViews()[0]).toEqual({ page_location: `${ORIGIN}/profile`, page_title: 'Profile' })
    expect(JSON.stringify(commands().slice(1))).not.toMatch(/Amina|Yusuf|CSC|example\.test/)
  })
})

describe('decline and withdrawal', () => {
  test('Decline stores the choice, loads nothing and is remembered on the next visit', async () => {
    const user = userEvent.setup()
    const first = renderApp(createAnalytics({ measurementId: ID }))
    await user.click(await screen.findByRole('button', { name: 'Decline' }))
    expect(screen.queryByTestId('analytics-consent')).toBeNull()
    expect(stored().choice).toBe('denied')
    await user.click(screen.getByRole('link', { name: 'Event 42' }))
    await settle()
    expect(document.querySelector(SCRIPT)).toBeNull()
    expect(window.dataLayer).toBeUndefined()
    first.unmount()

    renderApp(createAnalytics({ measurementId: ID }))
    expect(await screen.findByRole('heading', { name: 'Archive page' })).toBeVisible()
    expect(screen.queryByTestId('analytics-consent')).toBeNull()
  })

  test('withdrawal expires _ga cookies, sets the GA opt-out, stops events and keeps the app running', async () => {
    grant()
    document.cookie = '_ga=GA1.1.123.456; path=/'
    document.cookie = '_ga_PLAT08TEST=GS1.1.789; path=/'
    document.cookie = 'theme=dark; path=/'
    const user = userEvent.setup()
    const analytics = createAnalytics({ measurementId: ID })
    renderApp(analytics, '/dawah')
    await waitFor(() => expect(pageViews()).toHaveLength(1))
    await user.click(screen.getByRole('link', { name: 'Privacy' }))
    expect(await screen.findByTestId('analytics-status')).toHaveTextContent('Analytics is on.')
    await waitFor(() => expect(pageViews()).toHaveLength(2))

    await user.click(screen.getByRole('button', { name: 'Withdraw consent' }))
    expect(screen.getByRole('status')).toHaveTextContent('Consent withdrawn. Analytics cookies were removed.')
    expect(screen.getByTestId('analytics-status')).toHaveTextContent('Analytics is off.')
    expect(document.cookie).not.toMatch(/_ga/)
    expect(document.cookie).toContain('theme=dark')
    expect(window[`ga-disable-${ID}`]).toBe(true)
    expect(commands().at(-1)).toEqual(['consent', 'update', { analytics_storage: 'denied' }])
    expect(stored().choice).toBe('denied')

    await user.click(screen.getByRole('link', { name: /Da'wah/ }))
    expect(await screen.findByRole('heading', { name: 'Archive page' })).toBeVisible()
    await settle()
    expect(pageViews()).toHaveLength(2)
    expect(analytics.trackSignUp()).toBe(false)
    expect(screen.queryByTestId('analytics-consent')).toBeNull() // no re-prompt loop
    document.cookie = 'theme=; Max-Age=0; path=/'

    // Allowing again resumes without a second tag or config.
    await user.click(screen.getByRole('link', { name: 'Privacy' }))
    await user.click(await screen.findByRole('button', { name: 'Allow analytics' }))
    expect(window[`ga-disable-${ID}`]).toBe(false)
    expect(document.querySelectorAll(SCRIPT)).toHaveLength(1)
    expect(commands().filter(([kind]) => kind === 'config')).toHaveLength(1)
    expect(commands().at(-1)).toEqual(['consent', 'update', { analytics_storage: 'granted' }])
  })

  test('a withdrawal in another tab stops this tab too', async () => {
    grant()
    const analytics = createAnalytics({ measurementId: ID })
    expect(analytics.getSnapshot().active).toBe(true)
    localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify({ v: 1, choice: 'denied', at: '2026-11-02T00:00:00.000Z' }))
    act(() => window.dispatchEvent(new StorageEvent('storage', { key: CONSENT_STORAGE_KEY })))
    expect(analytics.getSnapshot()).toMatchObject({ choice: 'denied', active: false })
    expect(window[`ga-disable-${ID}`]).toBe(true)
    expect(analytics.trackSignUp()).toBe(false)
  })

  test('an outdated preference version asks again', () => {
    localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify({ v: 0, choice: 'granted' }))
    expect(createAnalytics({ measurementId: ID }).getSnapshot().choice).toBe('unset')
    expect(document.querySelector(SCRIPT)).toBeNull()
  })
})

describe('sign_up', () => {
  async function submitRegistration(user) {
    for (const [label, value] of [['First name', 'Amina'], ['Last name', 'Yusuf'], ['Email', 'student@example.test'], ['Password', 'a-Strong-pass-1'], ['Confirm password', 'a-Strong-pass-1']]) {
      const field = await screen.findByLabelText(new RegExp(`^${label}$`))
      await user.clear(field)
      await user.type(field, value)
    }
    await user.click(screen.getByRole('button', { name: 'Create account' }))
  }

  test('is sent once, after the register API succeeds, never for failures or retries', async () => {
    grant()
    const responses = [
      () => fail(400, 'VALIDATION_ERROR', 'Correct the highlighted fields.', { email: ['An account with this email already exists.'] }),
      () => fail(503, 'SERVER_ERROR', 'Service unavailable.'),
      () => ok({ ...student }, 'User registered successfully.', { status: 201 }),
    ]
    server.use(http.post(url('/accounts/register/'), () => responses.shift()()))
    const user = userEvent.setup()
    renderApp(createAnalytics({ measurementId: ID }), '/sign-up')

    await submitRegistration(user)
    expect(await screen.findByText('An account with this email already exists.')).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Create account' }))
    expect(await screen.findByText('Service unavailable.')).toBeVisible()
    expect(events('sign_up')).toEqual([])

    await user.click(screen.getByRole('button', { name: 'Create account' }))
    expect(await screen.findByText('Account created. Sign in to continue.')).toBeVisible()
    expect(events('sign_up')).toEqual([{ method: 'email' }])
    await settle()
    expect(events('sign_up')).toHaveLength(1)
    expect(JSON.stringify(commands().slice(1))).not.toMatch(/Amina|Yusuf|example\.test|Strong/)
  })

  test('a registration before consent is not replayed when consent is given later', async () => {
    server.use(http.post(url('/accounts/register/'), () => ok({ ...student }, 'User registered successfully.', { status: 201 })))
    const user = userEvent.setup()
    renderApp(createAnalytics({ measurementId: ID }), '/sign-up')
    await submitRegistration(user)
    expect(await screen.findByText('Account created. Sign in to continue.')).toBeVisible()
    await settle() // the /sign-in navigation completes before consent too
    await user.click(screen.getByRole('button', { name: 'Accept' }))
    await settle()
    expect(document.querySelectorAll(SCRIPT)).toHaveLength(1)
    expect(events('sign_up')).toEqual([])
    expect(pageViews()).toEqual([])
  })

  test('login is not a sign-up', async () => {
    grant()
    server.use(http.post(url('/accounts/login/'), () => ok({ user: student, tokens: { access: 'a', refresh: 'r' } })))
    const user = userEvent.setup()
    renderApp(createAnalytics({ measurementId: ID }), '/sign-in?next=%2Fdawah')
    await screen.findByLabelText('Email or matric number')
    await settle()
    await user.type(screen.getByLabelText('Email or matric number'), 'CSC/21/001')
    await user.type(screen.getByLabelText('Password', { exact: true }), 'synthetic-password')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))
    expect(await screen.findByRole('heading', { name: 'Archive page' })).toBeVisible()
    await settle()
    expect(events('sign_up')).toEqual([])
    expect(pageViews().map((view) => view.page_location)).toEqual([`${ORIGIN}/sign-in`, `${ORIGIN}/dawah`])
  })
})

describe('failures never break the product', () => {
  test('blocked tag, throwing dataLayer and unusable storage are all swallowed', async () => {
    const throwing = { getItem: () => { throw new Error('denied') }, setItem: () => { throw new Error('denied') } }
    window.dataLayer = { push: () => { throw new Error('blocked') } }
    const user = userEvent.setup()
    const analytics = createAnalytics({ measurementId: ID }, { win: window, doc: document, storage: throwing })
    renderApp(analytics)
    await user.click(await screen.findByRole('button', { name: 'Accept' }))
    // An ad blocker / network failure fires the script's error event.
    act(() => document.querySelector(SCRIPT).dispatchEvent(new Event('error')))
    expect(analytics.getSnapshot()).toMatchObject({ choice: 'granted', scriptStatus: 'failed' })
    await user.click(screen.getByRole('link', { name: 'Event 42' }))
    expect(await screen.findByRole('heading', { name: 'Event page' })).toBeVisible()
    await settle()
    expect(analytics.trackSignUp()).toBe(true)
    await user.click(screen.getByRole('link', { name: 'Privacy' }))
    await user.click(await screen.findByRole('button', { name: 'Withdraw consent' }))
    expect(screen.getByTestId('analytics-status')).toHaveTextContent('Analytics is off.')
  })

  test('a throwing registration observer does not turn a created account into an error', async () => {
    server.use(http.post(url('/accounts/register/'), () => ok({ ...student }, 'User registered successfully.', { status: 201 })))
    const onRegistered = vi.fn(() => { throw new Error('analytics down') })
    const user = userEvent.setup()
    render(
      <MemoryRouter initialEntries={['/sign-up']}>
        <AnalyticsProvider analytics={null}>
          <AuthProvider onRegistered={onRegistered}>
            <App studentRoutes={studentRoutes} adminRoutes={[]} />
          </AuthProvider>
        </AnalyticsProvider>
      </MemoryRouter>,
    )
    for (const [label, value] of [['First name', 'Amina'], ['Last name', 'Yusuf'], ['Email', 'student@example.test'], ['Password', 'a-Strong-pass-1'], ['Confirm password', 'a-Strong-pass-1']]) {
      await user.type(await screen.findByLabelText(new RegExp(`^${label}$`)), value)
    }
    await user.click(screen.getByRole('button', { name: 'Create account' }))
    expect(await screen.findByText('Account created. Sign in to continue.')).toBeVisible()
    expect(onRegistered).toHaveBeenCalledTimes(1)
    expect(onRegistered).toHaveBeenCalledWith() // no user data reaches observers
  })

  test('AppRoot without a controller (tests, misconfiguration) renders normally', async () => {
    render(
      <MemoryRouter initialEntries={['/privacy']}>
        <AppRoot />
      </MemoryRouter>,
    )
    expect(await screen.findByTestId('analytics-status')).toHaveTextContent('Analytics is not used on this site.')
  })
})

describe('route templates', () => {
  const tree = analyticsRouteTree(preloadTreeFor(studentSlotRoutes, adminSlotRoutes))

  function templates(routes, base = '') {
    return routes.flatMap((route) => {
      const path = route.index ? base || '/' : `${base}/${route.path ?? ''}`.replace(/\/+/g, '/').replace(/(.)\/$/, '$1')
      return [path, ...(route.children ? templates(route.children, path === '/' ? '' : path) : [])]
    })
  }

  test('every mounted route has a generic title', () => {
    const all = [...new Set(templates(tree))]
    expect(all.length).toBeGreaterThan(40)
    expect(all.filter((template) => !PAGE_TITLES[template])).toEqual([])
    for (const title of Object.values(PAGE_TITLES)) expect(title).not.toMatch(/:|\d/)
  })

  test.each([
    ['/dawah/events/42', '/dawah/events/:id', 'Event details'],
    ['/dawah/classes/9/modules/3', '/dawah/classes/:id/modules/:moduleId', 'Class module'],
    ['/admin/events/new', '/admin/events/new', 'Admin new event'],
    ['/admin/events/5/resources/8', '/admin/events/:eventId/resources/:resourceId', 'Admin event resource'],
    ['/admin/communication/drafts/77', '/admin/communication/drafts/:id', 'Admin broadcast draft'],
    ['/admin', '/admin', 'Admin dashboard'],
    ['/', '/', 'Home'],
    ['/profile/results/12', '/profile/results/:id', 'Quiz result'],
    ['/students/amina@example.test', NOT_FOUND_TEMPLATE, 'Page not found'],
  ])('%s → %s', (pathname, template, title) => {
    expect(describeRoute(tree, pathname)).toEqual({ template, title })
  })
})
