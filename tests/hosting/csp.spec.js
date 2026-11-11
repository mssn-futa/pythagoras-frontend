import { test as base, expect } from '@playwright/test'

// RELEASE-04: the production bundle under the generated CSP must raise no violations on the pages
// that use third-party origins, and the policy must actually block what it should (negative controls).
const API = 'https://api.pythagoras.test'
const MEDIA = 'https://media.pythagoras.test'
const R2 = 'https://r2.example.test'
const ID = 'abcdefghijk'
const EMBED = `https://www.youtube-nocookie.com/embed/${ID}`
const admin = { id: 2, email: 'admin@example.test', first_name: 'Bilal', last_name: 'Okafor', matric_number: null, department: 'Computer Science', level: '300', role: 'admin', is_active: true }
const eventPayload = { id: 3, title: 'Friday khutbah', speakers: 'Guest speaker', category: 'jumuah', start_time: '2026-10-09T12:00:00Z', summary: 'Key takeaways' }
const video = {
  id: 19, event_id: 3, title: 'Recorded lecture', type: 'vid', status: 'published', storage_status: 'not_applicable', media_url: null, duration: null,
  playback: { provider: 'youtube', video_id: ID, watch_url: `https://www.youtube.com/watch?v=${ID}`, embed_url: EMBED }, event: eventPayload,
}
const BENIGN_PREVIEW = '<p style="color:#b91c1c">Server <strong>preview</strong></p><blockquote>quoted</blockquote>'

const test = base.extend({
  violations: [async ({ page }, use) => {
    const seen = []
    page.on('console', (message) => {
      const text = message.text()
      if (/Refused to|Content Security Policy|violates the following/i.test(text)) seen.push(text)
    })
    page.on('pageerror', (error) => /Content Security Policy/i.test(error.message) && seen.push(error.message))
    await page.route(/fonts\.(googleapis|gstatic)\.com/, (route) => route.fulfill({ status: 200, contentType: 'text/css', body: '' }))
    await use(seen)
  }, { auto: true }],
})

const cors = (route) => ({
  'Access-Control-Allow-Origin': route.request().headers().origin ?? '*',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type, Accept',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, PUT, DELETE, OPTIONS',
})
const envelope = (data) => JSON.stringify({ success: true, data, message: 'OK.' })

async function mockApi(page, extra = () => null) {
  await page.route(`${API}/**`, async (route) => {
    const request = route.request()
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors(route) })
    const url = new URL(request.url())
    const custom = extra(url, request)
    const reply = (status, data) => route.fulfill({ status, headers: cors(route), contentType: 'application/json', body: envelope(data) })
    if (custom) return reply(...custom)
    if (url.pathname === '/accounts/refresh/') return reply(200, { access: 'a1', refresh: 'r1' })
    if (url.pathname === '/accounts/me/') return reply(200, admin)
    if (url.pathname === '/dawah/resources/19/') return reply(200, video)
    if (url.pathname === '/dawah/archive/' || url.pathname === '/dawah/events/') return reply(200, { count: 0, next: null, previous: null, results: [] })
    return reply(404, { code: 'NOT_FOUND' })
  })
}

test('the policy is delivered with the SPA fallback and blocks injected script/frames/connections', async ({ page, violations }) => {
  await mockApi(page)
  const response = await page.goto('/admin/quizzes/1')
  expect(response.status()).toBe(200)
  const csp = response.headers()['content-security-policy']
  expect(csp).toContain("script-src 'self'")
  expect(csp).toContain("frame-ancestors 'none'")
  await expect(page.locator('#root')).toBeAttached()

  // Negative controls: each must be refused, proving the policy is enforced in this browser.
  const outcome = await page.evaluate(async () => {
    const results = {}
    window.__inline = 0
    const script = document.createElement('script')
    script.textContent = 'window.__inline = 1'
    document.head.append(script)
    results.inlineScript = window.__inline
    results.evilFetch = await fetch('https://evil.test/x').then(() => 'allowed', () => 'blocked')
    const frame = document.createElement('iframe')
    frame.src = 'https://evil.test/frame'
    document.body.append(frame)
    await new Promise((resolve) => setTimeout(resolve, 300))
    return results
  })
  expect(outcome).toEqual({ inlineScript: 0, evilFetch: 'blocked' })
  expect(violations.filter((v) => /script-src/.test(v))).not.toHaveLength(0)
  expect(violations.filter((v) => /connect-src/.test(v))).not.toHaveLength(0)
  expect(violations.filter((v) => /frame-src/.test(v))).not.toHaveLength(0)
})

test('sign-in and public pages raise no violations', async ({ page, violations }) => {
  await mockApi(page)
  await page.goto('/sign-in')
  await expect(page.getByRole('button', { name: /sign in|log in/i }).first()).toBeVisible()
  await page.goto('/sign-up')
  await page.goto('/dawah')
  await expect(page.locator('#root')).not.toBeEmpty()
  expect(violations).toEqual([])
})

test('YouTube privacy-enhanced embed frame loads under frame-src without violations', async ({ page, violations }) => {
  const frames = []
  await page.route(`${EMBED}**`, (route) => {
    frames.push(route.request().url())
    return route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>blank</title>' })
  })
  await mockApi(page)
  await page.goto('/dawah/content/19')
  await expect(page.locator('iframe')).toHaveAttribute('src', EMBED)
  await page.locator('iframe').scrollIntoViewIfNeeded()
  await expect.poll(() => frames.length).toBeGreaterThan(0)
  expect(violations).toEqual([])
})

test('rich editor and sandboxed srcdoc preview raise no violations and styles apply', async ({ page, violations }) => {
  await page.addInitScript(() => sessionStorage.setItem('pythagoras.refreshToken', 'refresh-0'))
  let broadcast = null
  await mockApi(page, (url, request) => {
    if (url.pathname === '/dawah/broadcasts/' && request.method() === 'POST') {
      const body = request.postDataJSON()
      broadcast = {
        id: 7, state: 'draft', version: 1, created_at: '2026-11-10T09:00:00Z', updated_at: '2026-11-10T09:00:00Z', queued_at: null,
        recipient_count: 0, counts: { queued: 0, sent: 0, failed: 0, uncertain: 0, skipped: 0 }, eligible_actions: ['edit', 'delete', 'preview', 'queue'],
        subject: body.subject, body_format: body.body_format, body_html: body.body_html, body: 'Hello', audience: body.audience,
      }
      return [201, broadcast]
    }
    if (url.pathname === '/dawah/broadcasts/7/') return [200, broadcast]
    if (url.pathname === '/dawah/broadcasts/7/preview/') {
      return [200, { subject: broadcast.subject, body: 'Hello', body_format: 'rich', body_html: broadcast.body_html, rendered_text: 'Hello', rendered_html: BENIGN_PREVIEW, audience_count: 3 }]
    }
    return null
  })
  await page.goto('/admin/communication')
  await page.getByLabel('Subject').fill('Weekly summary')
  await page.getByRole('radio', { name: 'Rich text' }).check()
  const editor = page.getByRole('textbox', { name: 'Message (rich text)' })
  await expect(editor).toBeVisible()
  await editor.click()
  await page.getByRole('button', { name: 'Bold' }).click()
  await page.keyboard.type('Hello world')
  await page.getByRole('button', { name: 'Link' }).click()
  await page.getByLabel(/Link address/).fill('https://example.test/page')
  await page.getByRole('button', { name: 'Apply link' }).click()
  await page.getByRole('button', { name: /Save draft|Save/ }).first().click()
  await page.getByRole('button', { name: /Preview/ }).first().click()
  const frame = page.frameLocator('[data-testid="preview-frame"]')
  await expect(frame.getByText('preview')).toBeVisible()
  // Inline style attribute from server HTML applies inside the sandbox (inherits the parent policy).
  await expect(frame.locator('p').first()).toHaveCSS('color', 'rgb(185, 28, 28)')
  expect(violations).toEqual([])
})

test('direct R2 PUT is allowed to the S3 presign origin without bearer, other hosts are refused', async ({ page, violations }) => {
  await mockApi(page)
  const puts = []
  await page.route(`${R2}/**`, (route) => {
    const request = route.request()
    const headers = { 'Access-Control-Allow-Origin': request.headers().origin ?? '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'PUT, GET, OPTIONS', 'Access-Control-Expose-Headers': 'ETag' }
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers })
    puts.push({ method: request.method(), auth: request.headers().authorization ?? null })
    return route.fulfill({ status: 200, headers: { ...headers, ETag: '"abc"' }, body: '' })
  })
  await page.goto('/sign-in')
  const result = await page.evaluate(async (r2) => {
    const status = await new Promise((resolve) => {
      const xhr = new XMLHttpRequest()
      xhr.open('PUT', `${r2}/staging/abc?X-Amz-Signature=synthetic`)
      xhr.withCredentials = false
      xhr.setRequestHeader('Content-Type', 'audio/mpeg')
      xhr.onload = () => resolve(xhr.status)
      xhr.onerror = () => resolve('error')
      xhr.send(new Blob(['x']))
    })
    const other = await fetch('https://other-bucket.example.test/x', { method: 'PUT', body: 'x' }).then(() => 'allowed', () => 'blocked')
    return { status, other }
  }, R2)
  expect(result).toEqual({ status: 200, other: 'blocked' })
  expect(puts).toEqual([{ method: 'PUT', auth: null }])
  // Only the deliberate other-host control is reported (Chromium logs one violation as two console lines).
  expect(violations).not.toHaveLength(0)
  for (const violation of violations) expect(violation).toContain('other-bucket.example.test')
})

test('media and image origins are covered by media-src/img-src', async ({ page, violations }) => {
  await mockApi(page)
  await page.route(`${MEDIA}/**`, (route) => route.fulfill({ status: 200, contentType: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64') }))
  await page.goto('/sign-in')
  const loaded = await page.evaluate((media) => new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve('loaded')
    img.onerror = () => resolve('error')
    img.src = `${media}/events/1.png`
  }), MEDIA)
  expect(loaded).toBe('loaded')
  expect(violations).toEqual([])
})
