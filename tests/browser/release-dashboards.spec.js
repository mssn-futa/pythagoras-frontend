import { test, expect } from './test.js'

// Synthetic, test-only API (no real backend), shaped like the D0 envelopes and
// the D1-D4 list items the dashboards read.
const API = 'https://api.pythagoras.test'
const student = {
  id: 1, email: 'student@example.test', first_name: 'Amina', last_name: 'Yusuf', matric_number: 'CSC/21/001',
  department: 'Computer Science', level: '300', role: 'student', is_active: true,
}
const admin = { ...student, id: 2, email: 'admin@example.test', first_name: 'Bilal', last_name: 'Okafor', matric_number: null, role: 'admin' }
const page = (results, count = results.length, next = null) => ({ count, next, previous: null, results })

const corsFor = (route) => ({
  'Access-Control-Allow-Origin': route.request().headers().origin ?? '',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type, Accept',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
})

async function mockApi(browserPage, { user, failQuizzes = false } = {}) {
  const calls = []
  const reply = (route, status, data, message = 'OK.') =>
    route.fulfill({ status, headers: corsFor(route), contentType: 'application/json', body: JSON.stringify({ success: status < 400, data, message }) })

  await browserPage.route(`${API}/**`, async (route) => {
    const request = route.request()
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: corsFor(route) })
    const u = new URL(request.url())
    const q = Object.fromEntries(u.searchParams)
    const auth = (await request.allHeaders()).authorization ?? null
    calls.push({ method: request.method(), path: u.pathname, query: q, auth })

    switch (u.pathname) {
      case '/accounts/refresh/': return reply(route, 200, { access: 'access-1', refresh: 'refresh-1' })
      case '/accounts/me/': return reply(route, 200, user)
      case '/accounts/students/': return reply(route, 200, page([], q.is_active === 'true' ? 111 : 120))
      case '/dawah/events/':
        if (q.upcoming === 'true') {
          return reply(route, 200, page([
            { id: 1, title: "Jumu'ah khutbah: patience", status: 'published', location: 'Central mosque', start_time: '2026-11-20T12:00:00Z', end_time: '2026-11-20T14:00:00Z' },
            { id: 2, title: 'Weekly halaqah', status: 'published', location: '', start_time: '2026-11-22T16:00:00Z', end_time: '2026-11-22T17:00:00Z' },
          ]))
        }
        return reply(route, 200, page([], 7))
      case '/quiz/quizzes/':
        if (failQuizzes) return reply(route, 503, { code: 'SERVICE_UNAVAILABLE' }, 'Assessments are temporarily unavailable.')
        if (q.status) return reply(route, 200, page([], { published: 3, draft: 2, closed: 5 }[q.status]))
        return reply(route, 200, page([{ id: 45, title: 'Arabic week 1', time_limit: 30, deadline: '2036-11-30T20:00:00Z', status: 'published' }]))
      case '/quiz/classes/':
        if (q.page_size === '1') return reply(route, 200, page([], 4))
        return reply(route, 200, page([{ id: 2, code: 'ARB101', title: 'Arabic for beginners', status: 'published', module_count: 3 }]))
      case '/quiz/submissions/': return reply(route, 200, page([]))
      case '/dawah/broadcasts/': return reply(route, 200, page([], { queued: 1, processing: 2, uncertain: 0 }[q.state]))
      case '/dawah/automations/': return reply(route, 200, page([{ id: 1, enabled: true }, { id: 2, enabled: false }]))
      default: return reply(route, 404, { code: 'NOT_FOUND' }, 'Not found.')
    }
  })
  return calls
}

async function signedInAs(browserPage, user, options) {
  await browserPage.route('https://fonts.googleapis.com/**', (route) => route.fulfill({ contentType: 'text/css', body: '' }))
  const calls = await mockApi(browserPage, { user, ...options })
  await browserPage.addInitScript(() => sessionStorage.setItem('pythagoras.refreshToken', 'refresh-0'))
  return calls
}

/** Waits for an off-canvas drawer to finish sliding in (its left edge at 0). */
async function expectDrawerSettled(locator) {
  await expect.poll(async () => Math.round((await locator.boundingBox())?.x ?? -1)).toBe(0)
}

/** No element may stick out sideways (mobile layouts must not scroll horizontally). */
async function expectNoHorizontalOverflow(browserPage) {
  const overflow = await browserPage.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow).toBeLessThanOrEqual(1)
}

test('student dashboard: live panels, independent error, working navigation', async ({ page: browserPage, isMobile }, testInfo) => {
  const calls = await signedInAs(browserPage, student, { failQuizzes: true })
  await browserPage.goto('/')

  await expect(browserPage.getByRole('heading', { name: 'Welcome, Amina' })).toBeVisible()
  const events = browserPage.getByRole('region', { name: 'Upcoming events' })
  await expect(events.getByRole('link', { name: /Jumu'ah khutbah: patience/ })).toBeVisible()
  await expect(events.getByText('20 Nov 2026, 13:00 WAT · Central mosque')).toBeVisible()
  await expect(browserPage.getByRole('region', { name: 'Arabic classes' }).getByRole('link', { name: /Arabic for beginners/ })).toBeVisible()
  await expect(browserPage.getByRole('region', { name: 'Recent results' }).getByText('You have not submitted a quiz yet.')).toBeVisible()
  const quizzes = browserPage.getByRole('region', { name: 'Available quizzes' })
  await expect(quizzes.getByRole('alert')).toContainText('Assessments are temporarily unavailable.')
  await expect(browserPage.getByText(/prayer|hijri/i)).toHaveCount(0)
  await expectNoHorizontalOverflow(browserPage)
  await browserPage.screenshot({ path: testInfo.outputPath('student-dashboard.png'), fullPage: true })

  // Upcoming events are a public read: no bearer header.
  expect(calls.find((c) => c.path === '/dawah/events/').auth).toBeNull()
  expect(calls.find((c) => c.path === '/quiz/classes/').auth).toBe('Bearer access-1')

  const nav = browserPage.getByRole('navigation', { name: 'Primary' })
  if (isMobile) {
    await expect(nav).not.toBeInViewport()
    const toggle = browserPage.locator('button[aria-controls="student-navigation"]')
    await toggle.click()
    await expect(toggle).toHaveAttribute('aria-expanded', 'true')
    await expect(toggle).toHaveAccessibleName('Close menu')
    await expect(browserPage.getByRole('main')).toHaveAttribute('inert', '')
    await expect(nav).toBeInViewport()
    await expectDrawerSettled(browserPage.locator('#student-navigation'))
    await browserPage.screenshot({ path: testInfo.outputPath('student-menu-open.png') })
  }
  await expect(nav.getByRole('link', { name: 'Home' })).toHaveAttribute('aria-current', 'page')
  // Hold the class catalogue's code back: the navigation runs in a transition, so the
  // dashboard stays up while a pending status says the next page is loading.
  let releaseChunk
  const chunkGate = new Promise((resolve) => { releaseChunk = resolve })
  await browserPage.route(/ClassCatalogPage[-.][^/]*$/, async (route) => { await chunkGate; await route.continue() })
  await nav.getByRole('link', { name: 'Arabic classes' }).click()
  await expect(browserPage.getByTestId('page-loading')).toHaveText('Loading page…')
  await expect(browserPage.getByRole('main')).toHaveAttribute('aria-busy', 'true')
  await expect(browserPage.getByRole('heading', { name: 'Welcome, Amina' })).toBeVisible()
  await browserPage.screenshot({ path: testInfo.outputPath('student-navigation-pending.png') })
  releaseChunk()
  await expect(browserPage).toHaveURL('/dawah/classes')
  await expect(browserPage.getByTestId('page-loading')).toHaveCount(0)
  await expect(browserPage.getByRole('main')).toHaveAttribute('aria-busy', 'false')
  await expect(browserPage.getByRole('link', { name: /Arabic for beginners/ }).first()).toBeVisible()
  if (isMobile) await expect(browserPage.getByRole('button', { name: 'Open menu' })).toHaveAttribute('aria-expanded', 'false')
  else await expect(nav.getByRole('link', { name: 'Arabic classes' })).toHaveAttribute('aria-current', 'page')
})

test('admin dashboard: live counts, shortcuts and admin navigation', async ({ page: browserPage, isMobile }, testInfo) => {
  const calls = await signedInAs(browserPage, admin)
  await browserPage.goto('/admin')

  await expect(browserPage.getByRole('heading', { name: 'Admin dashboard' })).toBeVisible()
  const card = (name) => browserPage.getByRole('article', { name })
  await expect(card('Registered students').getByTestId('count-value')).toHaveText('120')
  await expect(card('Published events').getByTestId('count-value')).toHaveText('7')
  await expect(card('Draft quizzes').getByTestId('count-value')).toHaveText('2')
  await expect(card('Arabic classes').getByTestId('count-value')).toHaveText('4')
  await expect(card('Broadcasts in progress').getByTestId('count-value')).toHaveText('≈approximately 3')
  await expect(card('Uncertain broadcasts').getByTestId('count-value')).toHaveText('0')
  await expect(card('Automations').getByTestId('count-value')).toHaveText('1')
  await expect(card('Automations')).toContainText('enabled of 2 rules')
  await expectNoHorizontalOverflow(browserPage)
  await browserPage.screenshot({ path: testInfo.outputPath('admin-dashboard.png'), fullPage: true })
  expect(calls.filter((c) => c.path === '/quiz/quizzes/').map((c) => c.query.page_size)).toEqual(['1', '1', '1'])

  const nav = browserPage.getByRole('navigation', { name: 'Admin sections' })
  if (isMobile) {
    const toggle = browserPage.locator('button[aria-controls="admin-navigation"]')
    await toggle.click()
    await expect(toggle).toHaveAccessibleName('Close admin menu')
    await expect(nav).toBeInViewport()
    await expectDrawerSettled(browserPage.locator('#admin-navigation'))
    await browserPage.screenshot({ path: testInfo.outputPath('admin-menu-open.png') })
    await browserPage.keyboard.press('Escape')
    await expect(toggle).toHaveAttribute('aria-expanded', 'false')
    await expect(toggle).toBeFocused()
    await toggle.click()
  }
  await expect(nav.getByRole('link', { name: 'Dashboard' })).toHaveAttribute('aria-current', 'page')
  await nav.getByRole('link', { name: 'Students' }).click()
  await expect(browserPage).toHaveURL('/admin/students')
  await expect(browserPage.getByRole('heading', { name: 'Student Management' })).toBeVisible()

  // Deep link + reload keeps the section highlighted and the guard admits the admin again.
  await browserPage.goto('/admin/communication/automations')
  await browserPage.reload()
  if (isMobile) await browserPage.getByRole('button', { name: 'Open admin menu' }).click()
  await expect(nav.getByRole('link', { name: 'Communication' })).toHaveAttribute('aria-current', 'page')
})
