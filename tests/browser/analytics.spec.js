import { test, expect } from './test.js'
import { mockGoogle } from './ga-stub.js'

// PLAT-08 (D1 "Phase 1 analytics"): the real app in a browser with a synthetic GA4 ID (/ga-harness, see
// tests/browser/vite.config.js). Google hosts are intercepted: the gtag script is a local stub that turns
// gtag('event', ...) into GA4-style /g/collect hits, so the spec can assert exactly what would be sent.
// A local stub proves gating and payload sanitization only, NOT receipt by a real GA4 property.
const BASE = '/ga-harness'
const ID = 'G-PLAT08TEST'
const API = 'https://api.pythagoras.test'
const KEY = 'pythagoras.analyticsConsent'

const cors = (route) => ({
  'Access-Control-Allow-Origin': route.request().headers().origin ?? '*',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type, Accept',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
})
const event = { id: 3, title: 'Friday khutbah', speakers: 'Guest speaker', category: 'jumuah', start_time: '2026-10-09T12:00:00Z', summary: 'Key takeaways' }
const resource = { id: 8, event_id: 3, title: 'Patience', type: 'doc', status: 'published', storage_status: 'ready', media_url: 'https://media.pythagoras.test/notes-8.pdf', duration: null, event }
const student = { id: 1, email: 'student@example.test', first_name: 'Amina', last_name: 'Yusuf', matric_number: 'CSC/21/001', department: 'Computer Science', level: '300', role: 'student', is_active: true }

async function mockApi(page, { register } = {}) {
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (route) => route.fulfill({ status: 200, contentType: 'text/css', body: '' }))
  await page.route(`${API}/**`, async (route) => {
    const request = route.request()
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors(route) })
    const path = new URL(request.url()).pathname
    const json = (status, data, success = status < 400) =>
      route.fulfill({ status, headers: cors(route), contentType: 'application/json', body: JSON.stringify({ success, data, message: success ? 'OK.' : 'Correct the highlighted fields.' }) })
    if (path === '/accounts/register/' && register) return json(...register())
    if (path === '/dawah/archive/') return json(200, { count: 1, next: null, previous: null, results: [resource] })
    if (path === '/dawah/events/') return json(200, { count: 0, next: null, previous: null, results: [] })
    if (path === '/dawah/events/3/') return json(200, { ...event, resources: [resource] })
    if (path === '/dawah/resources/8/') return json(200, resource)
    return json(404, { code: 'NOT_FOUND' })
  })
}

const settle = (page) => page.waitForTimeout(700) // > the observer's settle delay
const leaks = (value) => /\b3\b|\b8\b|utm|email|speaker|student|Amina|CSC|khutbah|Patience|#|\?/.test(JSON.stringify(value))

test('no Google request before consent; sanitized page views only after Accept; withdrawal stops them', async ({ page, context, baseURL }) => {
  const google = await mockGoogle(page)
  await mockApi(page)
  await page.goto(`${BASE}/dawah/events/3?utm_source=mail&email=student%40example.test#speaker`)
  await expect(page.getByRole('heading', { name: 'Friday khutbah' })).toBeVisible()
  const banner = page.getByRole('region', { name: 'Help us improve Pythagoras?' })
  await expect(banner).toBeVisible()
  await page.getByRole('link', { name: 'Back to archive' }).click()
  await expect(page.getByRole('link', { name: 'Patience', exact: true })).toBeVisible()
  await settle(page)
  expect(google.requests).toEqual([])
  expect(await page.locator('script[src*="googletagmanager"]').count()).toBe(0)
  expect(await page.evaluate(() => window.dataLayer)).toBeUndefined()

  await banner.getByRole('button', { name: 'Accept' }).click()
  await expect(banner).toBeHidden()
  await expect.poll(() => google.scripts()).toEqual([`https://www.googletagmanager.com/gtag/js?id=${ID}`])
  await settle(page)
  expect(google.hits).toEqual([]) // the pages seen before consent are not replayed
  expect(await page.evaluate((key) => JSON.parse(localStorage.getItem(key)).choice, KEY)).toBe('granted')

  await page.getByRole('link', { name: 'Patience', exact: true }).click() // /dawah/content/8
  await expect(page).toHaveURL(`${BASE}/dawah/content/8`)
  await expect.poll(() => google.views().length).toBe(1)
  await page.getByRole('link', { name: 'Back to archive' }).click()
  await expect.poll(() => google.views().length).toBe(2)
  await page.goBack() // popstate navigation, no reload
  await expect.poll(() => google.views().length).toBe(3)
  await settle(page)

  const origin = new URL(baseURL).origin
  expect(google.views().map(({ en, dl, dt, dr }) => ({ en, dl, dt, dr }))).toEqual([
    { en: 'page_view', dl: `${origin}/dawah/content/:id`, dt: 'Content details', dr: `${origin}/dawah` },
    { en: 'page_view', dl: `${origin}/dawah`, dt: "Da'wah archive", dr: `${origin}/dawah/content/:id` },
    { en: 'page_view', dl: `${origin}/dawah/content/:id`, dt: 'Content details', dr: `${origin}/dawah` },
  ])
  // The stub's enhanced-measurement-like history hits (push, push, popstate) only ever saw templates.
  expect(google.probes().map(({ dl }) => dl)).toEqual([`${origin}/dawah/content/:id`, `${origin}/dawah`, `${origin}/dawah/content/:id`])
  expect(leaks(google.hits.map(({ dl, dt, dr }) => [dl.replace(origin, ''), dt, dr.replace(origin, '')]))).toBe(false)
  expect(google.scripts()).toHaveLength(1)

  // Withdraw from the privacy settings: GA cookies (written by the tag) expire, one reload unloads the tag, no loop.
  await page.goto(`${BASE}/privacy`)
  await expect(page.getByTestId('analytics-status')).toHaveText(/Analytics is on/)
  await expect.poll(() => google.views().length).toBe(4)
  expect(google.views()[3]).toMatchObject({ dl: `${origin}/privacy`, dt: 'Privacy settings' })
  expect(google.views()[3].dr ?? '').not.toMatch(/content\/8/)
  const gaCookies = async () => (await context.cookies(origin)).map((cookie) => cookie.name).filter((name) => name.startsWith('_ga')).sort()
  await expect.poll(gaCookies).toEqual(['_ga', '_ga_PLAT08TEST'])
  const hitsBefore = google.hits.length
  const navigations = []
  page.on('framenavigated', (frame) => frame === page.mainFrame() && navigations.push(frame.url()))
  await page.getByRole('button', { name: 'Withdraw consent' }).click()
  await expect(page.getByRole('status')).toHaveText('Consent withdrawn. Analytics cookies were removed and the Google tag was unloaded.')
  await page.waitForTimeout(1500)
  expect(navigations).toEqual([`${origin}${BASE}/privacy`]) // exactly one reload
  expect(await gaCookies()).toEqual([])
  expect(await page.locator('script[src*="googletagmanager"]').count()).toBe(0)
  expect(await page.evaluate(() => window.dataLayer)).toBeUndefined()
  await expect(page.getByTestId('analytics-status')).toHaveText(/Analytics is off/)
  await page.goBack()
  await page.goForward()
  await settle(page)
  expect(google.hits).toHaveLength(hitsBefore)
  expect(google.scripts()).toHaveLength(2) // the start-up load on /privacy; none after the withdrawal
  await expect(page.getByRole('region', { name: 'Help us improve Pythagoras?' })).toBeHidden()
})

test('sign_up is sent once after the register API succeeds, without personal data', async ({ page }) => {
  await page.addInitScript((key) => localStorage.setItem(key, JSON.stringify({ v: 1, choice: 'granted', at: new Date().toISOString() })), KEY)
  const google = await mockGoogle(page)
  const replies = [
    () => [400, { code: 'VALIDATION_ERROR', fields: { email: ['An account with this email already exists.'] } }],
    () => [201, student],
  ]
  await mockApi(page, { register: () => replies.shift()() })
  await page.goto(`${BASE}/sign-up`)
  for (const [label, value] of [['First name', 'Amina'], ['Last name', 'Yusuf'], ['Email', 'student@example.test'], ['Password', 'a-Strong-pass-1'], ['Confirm password', 'a-Strong-pass-1']]) {
    await page.getByLabel(label, { exact: true }).fill(value)
  }
  await page.getByRole('button', { name: 'Create account' }).click()
  await expect(page.getByText('An account with this email already exists.')).toBeVisible()
  await settle(page)
  expect(google.hits.filter((hit) => hit.en === 'sign_up')).toEqual([])

  await page.getByRole('button', { name: 'Create account' }).click()
  await expect(page.getByText('Account created. Sign in to continue.')).toBeVisible()
  await expect.poll(() => google.hits.filter((hit) => hit.en === 'sign_up').length).toBe(1)
  await settle(page)
  const signUps = google.hits.filter((hit) => hit.en === 'sign_up')
  expect(signUps).toHaveLength(1)
  expect(signUps[0]['ep.method']).toBe('email')
  expect(JSON.stringify(google.requests)).not.toMatch(/Amina|Yusuf|student|example\.test|CSC|Strong/)
})

test('Global Privacy Control counts as a decline: no prompt and no Google request', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(Navigator.prototype, 'globalPrivacyControl', { get: () => true, configurable: true }))
  const google = await mockGoogle(page)
  await mockApi(page)
  await page.goto(`${BASE}/dawah`)
  await expect(page.getByRole('link', { name: 'Patience', exact: true })).toBeVisible()
  await page.getByRole('link', { name: 'Patience', exact: true }).click()
  await expect(page).toHaveURL(`${BASE}/dawah/content/8`)
  await settle(page)
  await expect(page.getByRole('region', { name: 'Help us improve Pythagoras?' })).toHaveCount(0)
  await page.goto(`${BASE}/privacy`)
  await expect(page.getByTestId('analytics-status')).toHaveText(/Do Not Track or Global Privacy Control/)
  await expect(page.getByRole('button', { name: 'Allow analytics' })).toHaveCount(0)
  expect(google.requests).toEqual([])
})

test('Decline, and a blocked tag after Accept, leave the product fully working', async ({ page }) => {
  const google = await mockGoogle(page, { blockScript: true })
  await mockApi(page)
  await page.goto(`${BASE}/dawah`)
  await page.getByRole('button', { name: 'Decline' }).click()
  await page.getByRole('link', { name: 'Patience', exact: true }).click()
  await expect(page).toHaveURL(`${BASE}/dawah/content/8`)
  await settle(page)
  expect(google.requests).toEqual([])
  await page.reload()
  await expect(page.getByRole('link', { name: 'Back to archive' })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Help us improve Pythagoras?' })).toHaveCount(0)

  // Change of mind with an ad blocker: the tag fails to load, navigation keeps working, nothing is sent.
  await page.goto(`${BASE}/privacy`)
  await page.getByRole('button', { name: 'Allow analytics' }).click()
  await expect.poll(() => google.scripts().length).toBe(1)
  await page.goBack()
  await expect(page.getByRole('link', { name: 'Back to archive' })).toBeVisible()
  await page.getByRole('link', { name: 'Back to archive' }).click()
  await expect(page.getByRole('link', { name: 'Patience', exact: true })).toBeVisible()
  expect(google.hits).toEqual([])
})

test('the banner sits below dialogs and drawers and steps aside while a modal dialog is open', async ({ page }) => {
  await mockGoogle(page)
  await mockApi(page)
  await page.goto(`${BASE}/dawah`)
  const banner = page.getByRole('region', { name: 'Help us improve Pythagoras?' })
  await expect(banner).toBeVisible()

  // A bottom-aligned z-50 sheet (like the admin ConfirmDialog on phones), first WITHOUT aria-modal: it must be on top.
  const addSheet = (modal) =>
    page.evaluate((isModal) => {
      const overlay = document.createElement('div')
      overlay.id = 'sheet'
      overlay.className = 'fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4'
      overlay.innerHTML = '<div role="dialog" aria-label="Bottom sheet" class="w-full max-w-md rounded-2xl bg-white p-6"><button type="button" id="sheet-action">Sheet action</button></div>'
      if (isModal) overlay.firstElementChild.setAttribute('aria-modal', 'true')
      overlay.querySelector('button').addEventListener('click', () => overlay.remove())
      document.body.appendChild(overlay)
    }, modal)
  const onTop = () =>
    page.evaluate(() => {
      const box = document.getElementById('sheet-action').getBoundingClientRect()
      return document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2)?.id
    })

  await addSheet(false)
  await expect(banner).toBeVisible()
  expect(await onTop()).toBe('sheet-action')
  await page.getByRole('button', { name: 'Sheet action' }).click()
  await expect(page.locator('#sheet')).toHaveCount(0)

  await addSheet(true)
  await expect(banner).toBeHidden()
  expect(await onTop()).toBe('sheet-action')
  await page.getByRole('button', { name: 'Sheet action' }).click()
  await expect(banner).toBeVisible()
})
