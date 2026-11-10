import { test, expect } from './test.js'

// Synthetic, test-only API shaped like D1/D4 examples.
const API = 'https://api.pythagoras.test'
const admin = {
  id: 2, email: 'admin@example.test', first_name: 'Bilal', last_name: 'Okafor', matric_number: null,
  department: 'Computer Science', level: '300', role: 'admin', is_active: true,
}
const hostile = '<script>window.__pwned = true</script>Read the <b>recording</b>'

const corsFor = (route) => ({
  'Access-Control-Allow-Origin': route.request().headers().origin ?? '',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type, Accept',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
})

async function mockApi(page) {
  const calls = []
  let broadcast = null
  const reply = (route, status, data, message = 'OK.') =>
    route.fulfill({ status, headers: corsFor(route), contentType: 'application/json', body: JSON.stringify({ success: true, data, message }) })

  await page.route(`${API}/**`, async (route) => {
    const request = route.request()
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: corsFor(route) })
    const path = new URL(request.url()).pathname
    const body = request.postDataJSON?.() ?? null
    calls.push({ method: request.method(), path, body })

    if (path === '/accounts/refresh/') return reply(route, 200, { access: 'access-1', refresh: 'refresh-1' })
    if (path === '/accounts/me/') return reply(route, 200, admin)
    if (path === '/dawah/broadcasts/' && request.method() === 'POST') {
      broadcast = {
        id: 7, state: 'draft', version: 1, body_format: 'plain', created_at: '2026-11-10T09:00:00Z', updated_at: '2026-11-10T09:00:00Z',
        queued_at: null, recipient_count: 0, counts: { queued: 0, sent: 0, failed: 0, uncertain: 0, skipped: 0 }, ...body,
      }
      return reply(route, 201, broadcast, 'Saved.')
    }
    if (path === '/dawah/broadcasts/7/') return reply(route, 200, broadcast)
    if (path === '/dawah/broadcasts/7/preview/') {
      return reply(route, 200, { subject: broadcast.subject, body: broadcast.body, rendered_text: broadcast.body, rendered_html: broadcast.body, audience_count: 42 })
    }
    if (path === '/dawah/broadcasts/7/queue/') {
      broadcast = { ...broadcast, state: 'queued', queued_at: '2026-11-10T10:00:00Z', recipient_count: 42, counts: { queued: 42, sent: 0, failed: 0, uncertain: 0, skipped: 0 } }
      return reply(route, 202, broadcast, 'Broadcast queued. Delivery is pending.')
    }
    if (path === '/dawah/broadcasts/7/deliveries/') {
      return reply(route, 200, {
        count: 2, next: null, previous: null,
        results: [
          { id: 1, student_id: 5, snapshot_email: 'a@example.test', state: 'queued', attempt_count: 0 },
          { id: 2, student_id: 6, snapshot_email: 'b@example.test', state: 'failed', attempt_count: 3, error_code: 'invalid_recipient' },
        ],
      })
    }
    return route.fulfill({ status: 404, headers: corsFor(route), contentType: 'application/json', body: JSON.stringify({ success: false, data: { code: 'NOT_FOUND' }, message: 'Not found.' }) })
  })
  return { calls, count: (method, path) => calls.filter((c) => c.method === method && c.path === path).length }
}

test('admin composes, saves, previews safely, confirms queueing and sees queued (not delivered)', async ({ page }) => {
  await page.route('https://fonts.googleapis.com/**', (route) => route.fulfill({ contentType: 'text/css', body: '' }))
  await page.addInitScript(() => sessionStorage.setItem('pythagoras.refreshToken', 'refresh-0'))
  const api = await mockApi(page)

  await page.goto('/admin/communication')
  await expect(page.getByRole('heading', { name: 'Communication' })).toBeVisible()

  await page.getByLabel('Subject').fill('Weekly Da’wah summary')
  await page.getByLabel('Message (plain text)').fill(hostile)
  await page.getByRole('radio', { name: 'One level' }).check()
  await page.getByLabel('Level', { exact: true }).selectOption('300')
  await page.getByRole('button', { name: 'Save draft' }).click()

  await expect(page).toHaveURL('/admin/communication/drafts/7')
  await expect(page.getByText('Draft saved.')).toBeVisible()
  expect(api.calls.find((c) => c.method === 'POST' && c.path === '/dawah/broadcasts/').body).toEqual({
    subject: 'Weekly Da’wah summary', body: hostile, audience: { type: 'level', level: '300' },
  })

  await page.getByRole('button', { name: 'Preview' }).click()
  await expect(page.getByTestId('preview-body')).toHaveText(hostile)
  await expect(page.getByText(/About 42 recipients/)).toBeVisible()
  expect(await page.evaluate(() => window.__pwned)).toBeUndefined()
  expect(await page.locator('[data-testid=preview-body] b, [data-testid=preview-body] script').count()).toBe(0)

  await page.getByRole('button', { name: 'Queue for sending…' }).click()
  const dialog = page.getByRole('dialog', { name: 'Queue this broadcast?' })
  await expect(dialog.getByText('Level: 300 level')).toBeVisible()
  await expect(dialog.getByText(/cannot be changed/)).toBeVisible()
  expect(api.count('POST', '/dawah/broadcasts/7/queue/')).toBe(0)
  await dialog.getByRole('button', { name: 'Queue broadcast' }).click()

  await expect(page).toHaveURL('/admin/communication/history/7')
  await expect(page.getByText(/Queued\. Delivery is pending/)).toBeVisible()
  expect(api.calls.find((c) => c.path === '/dawah/broadcasts/7/queue/').body).toEqual({ version: 1 })
  await expect(page.getByText('42 recipients: 42 queued, 0 Resend accepted, 0 failed, 0 uncertain, 0 skipped')).toBeVisible()
  await expect(page.getByRole('table').getByText('Failed (not accepted)')).toBeVisible()
  await expect(page.getByRole('checkbox')).toHaveCount(1)
  await expect(page.getByText(/delivered/i)).toHaveCount(0)

  // No horizontal page scroll at either viewport.
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})
