import { Buffer } from 'node:buffer'
import { test, expect } from './test.js'

// Synthetic, test-only backend: Pythagoras API, a media host and a fake R2 host.
const API = 'https://api.pythagoras.test'
const MEDIA = 'https://media.pythagoras.test'
const R2 = 'https://r2.example.test'
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64')
const PDF_BYTES = Buffer.from('%PDF-1.1\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF')

const eventPayload = { id: 3, title: 'Friday khutbah', speakers: 'Guest speaker', category: 'jumuah', start_time: '2026-10-09T12:00:00Z', summary: 'Key takeaways' }
const docResource = {
  id: 30, event_id: 3, title: 'Khutbah slides', type: 'doc', status: 'published', storage_status: 'ready',
  media_url: `${MEDIA}/docs/slides.pdf`, file_name: 'khutbah-slides.pdf', content_type: 'application/pdf', size_bytes: 1572864, event: eventPayload,
}
const unsafeDoc = { ...docResource, id: 31, title: 'Broken link', media_url: 'javascript:alert(1)' }
const admin = {
  id: 2, email: 'admin@example.test', first_name: 'Bilal', last_name: 'Okafor', matric_number: null,
  department: 'Computer Science', level: '300', role: 'admin', is_active: true,
}

const jsonRoute = (cors) => (route, data, status = 200) =>
  route.fulfill({ status, headers: cors, contentType: 'application/json', body: JSON.stringify({ success: true, data, message: 'OK.' }) })

test('reader sees the featured image and a safe document link in the archive and on the event; mobile does not overflow', async ({ page, context }) => {
  const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Authorization, Content-Type, Accept', 'Access-Control-Allow-Methods': 'GET, OPTIONS' }
  const json = jsonRoute(cors)
  const paged = (results) => ({ count: results.length, next: null, previous: null, results })
  const calls = []
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (route) => route.fulfill({ status: 200, contentType: 'text/css', body: '' }))
  await page.route(`${API}/**`, async (route) => {
    const request = route.request()
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors })
    const url = new URL(request.url())
    calls.push({ path: url.pathname, type: url.searchParams.get('type'), auth: (await request.allHeaders()).authorization ?? null })
    if (url.pathname === '/dawah/archive/') return json(route, paged(url.searchParams.get('type') === null ? [docResource, unsafeDoc] : []))
    if (url.pathname === '/dawah/events/') return json(route, paged([{ ...eventPayload, featured_image_url: `${MEDIA}/events/friday.png` }]))
    if (url.pathname === '/dawah/events/3/') return json(route, { ...eventPayload, featured_image_url: `${MEDIA}/events/friday.png`, resources: [docResource] })
    return route.fulfill({ status: 404, headers: cors, contentType: 'application/json', body: JSON.stringify({ success: false, data: { code: 'NOT_FOUND' }, message: 'Not found.' }) })
  })
  await page.route(`${MEDIA}/events/friday.png`, (route) => route.fulfill({ status: 200, contentType: 'image/png', body: PNG }))
  // Context-level so the popup tab (a different page) is served too.
  await context.route(`${MEDIA}/docs/slides.pdf`, (route) => route.fulfill({ status: 200, contentType: 'application/pdf', headers: { 'X-Content-Type-Options': 'nosniff' }, body: PDF_BYTES }))

  await page.goto('/dawah?type=all')
  await expect(page.getByLabel('Type')).toHaveValue('all')
  const box = page.getByTestId('document-resource').first()
  await expect(box.getByText('khutbah-slides.pdf', { exact: true })).toBeVisible()
  await expect(box.getByText('PDF document · 1.5 MiB')).toBeVisible()
  await expect(page.getByText('This document is not available right now.')).toBeVisible()
  await expect(page.getByRole('link', { name: /Open document/ })).toHaveCount(1) // the javascript: URL never became a link
  expect(calls.find((call) => call.path === '/dawah/archive/').type).toBeNull() // "all" sends no type filter

  // Upcoming event card image (lazy, real alt text) actually loads.
  const cardImage = page.getByRole('img', { name: 'Featured image for Friday khutbah' })
  await expect(cardImage).toHaveAttribute('loading', 'lazy')
  await expect.poll(() => cardImage.evaluate((img) => img.complete && img.naturalWidth > 0)).toBe(true)

  await page.goto('/dawah/events/3')
  await expect(page.getByRole('heading', { name: 'Friday khutbah' })).toBeVisible()
  const heroImage = page.getByRole('img', { name: 'Featured image for Friday khutbah' })
  await expect.poll(() => heroImage.evaluate((img) => img.complete && img.naturalWidth > 0)).toBe(true)

  const link = page.getByRole('link', { name: /Open document/ })
  await expect(link).toHaveAttribute('target', '_blank')
  await expect(link).toHaveAttribute('rel', 'noopener noreferrer')
  await expect(page.locator('iframe, embed, object')).toHaveCount(0) // documents are never rendered inline

  // The link really opens the file in a new tab, (rel=noopener noreferrer asserted above;
  // headless Chromium downloads PDFs rather than displaying them, so the proof is the request).
  const [popup, fileRequest] = await Promise.all([
    context.waitForEvent('page'),
    context.waitForEvent('request', (request) => request.url() === `${MEDIA}/docs/slides.pdf`),
    link.click(),
  ])
  expect(fileRequest.method()).toBe('GET')
  await popup.close()

  expect(calls.every((call) => call.auth === null)).toBe(true) // public reads: no bearer
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  expect(overflow).toBeLessThanOrEqual(0)
})

test('admin uploads a document and a featured image directly to storage without credentials', async ({ page, baseURL }) => {
  const origin = new URL(baseURL).origin
  const cors = {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'Authorization, Content-Type, Accept',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, PUT, OPTIONS',
    'Access-Control-Expose-Headers': 'ETag',
  }
  const respond = jsonRoute(cors)
  const reply = (route, status, data) => respond(route, data, status)
  const event = {
    id: 3, title: 'Friday khutbah', category: 'jumuah', tags: '', speakers: 'Guest speaker', location: 'FUTA mosque',
    start_time: '2026-10-09T12:00:00Z', end_time: '2026-10-09T13:00:00Z', summary: 'Key takeaways', description: '', status: 'published', published_at: '2026-10-01T09:00:00Z',
  }
  const doc = { id: 30, event_id: 3, title: 'Khutbah slides', type: 'doc', status: 'draft', storage_status: 'none', media_url: null }
  const seen = { intents: [], puts: [], finalize: [] }
  let imageReady = false

  await page.route(/fonts\.(googleapis|gstatic)\.com/, (route) => route.fulfill({ status: 200, contentType: 'text/css', body: '' }))
  await page.addInitScript(() => sessionStorage.setItem('pythagoras.refreshToken', 'refresh-0'))
  await page.route(`${API}/**`, async (route) => {
    const request = route.request()
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors })
    const path = new URL(request.url()).pathname
    if (path === '/accounts/refresh/') return reply(route, 200, { access: 'access-1', refresh: 'refresh-1' })
    if (path === '/accounts/me/') return reply(route, 200, admin)
    if (path === '/dawah/events/3/' && request.method() === 'GET') return reply(route, 200, imageReady ? { ...event, featured_image_url: `${MEDIA}/events/friday.png`, preview_url: `${R2}/preview/image.png?X-Amz-Signature=s` } : event)
    if (path === '/dawah/events/3/resources/') return reply(route, 200, { count: 1, next: null, previous: null, results: [doc] })
    if (path === '/dawah/events/3/resources/30/' && request.method() === 'GET') return reply(route, 200, { ...doc, file_name: doc.storage_status === 'ready' ? 'agenda.pdf' : undefined, preview_url: doc.storage_status === 'ready' ? `${R2}/preview/doc.pdf?X-Amz-Signature=s` : undefined })
    if (path === '/dawah/events/3/resources/30/document/' || path === '/dawah/events/3/featured-image/') {
      const body = request.postDataJSON()
      seen.intents.push({ path, body })
      return reply(route, 201, { upload_id: seen.intents.length + 40, resource_id: 30, method: 'PUT', upload_url: `${R2}/staging/${seen.intents.length}?X-Amz-Signature=synthetic`, headers: { 'Content-Type': body.content_type }, expires_at: '2099-01-01T00:00:00Z' })
    }
    if (path.startsWith('/dawah/uploads/') && path.endsWith('/finalize/')) {
      seen.finalize.push(path)
      if (path.includes('/41/')) doc.storage_status = 'ready'
      else imageReady = true
      return reply(route, 200, { upload: { status: 'ready' }, preview_url: `${R2}/preview/${path.includes('/41/') ? 'doc.pdf' : 'image.png'}?X-Amz-Signature=s` })
    }
    return route.fulfill({ status: 404, headers: cors, contentType: 'application/json', body: JSON.stringify({ success: false, data: { code: 'NOT_FOUND' }, message: 'Not found.' }) })
  })
  await page.route(`${R2}/**`, async (route) => {
    const request = route.request()
    const r2Cors = { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'PUT, GET, OPTIONS', 'Access-Control-Expose-Headers': 'ETag' }
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: r2Cors })
    if (request.method() === 'PUT') {
      const headers = await request.allHeaders()
      seen.puts.push({ authorization: headers.authorization ?? null, cookie: headers.cookie ?? null, contentType: headers['content-type'], size: request.postDataBuffer()?.length })
      return route.fulfill({ status: 200, headers: { ...r2Cors, ETag: '"abc"' }, body: '' })
    }
    return route.fulfill({ status: 200, headers: r2Cors, contentType: 'image/png', body: PNG })
  })

  await page.goto('/admin/events/3/resources/30')
  await expect(page.getByRole('heading', { name: 'Khutbah slides' })).toBeVisible()
  await page.getByLabel(/PDF or Word file/).setInputFiles({ name: 'agenda.pdf', mimeType: 'application/pdf', buffer: Buffer.alloc(3000, 1) })
  await expect(page.getByText(/server confirmed this document is ready/i)).toBeVisible()
  const preview = page.getByRole('link', { name: /Open document/ })
  await expect(preview).toHaveAttribute('rel', 'noopener noreferrer')
  await expect(page.locator('iframe, embed, object')).toHaveCount(0)

  await page.goto('/admin/events/3')
  await page.getByLabel(/Image file/).setInputFiles({ name: 'poster.png', mimeType: 'image/png', buffer: PNG })
  await expect(page.getByText(/server confirmed this image is ready/i)).toBeVisible()
  const img = page.getByRole('img', { name: /Featured image preview for Friday khutbah/ })
  await expect.poll(() => img.evaluate((el) => el.complete && el.naturalWidth > 0)).toBe(true)

  expect(seen.intents.map((i) => i.path)).toEqual(['/dawah/events/3/resources/30/document/', '/dawah/events/3/featured-image/'])
  expect(seen.intents[0].body).toEqual({ file_name: 'agenda.pdf', content_type: 'application/pdf', size_bytes: 3000 })
  expect(seen.intents[1].body).toEqual({ file_name: 'poster.png', content_type: 'image/png', size_bytes: PNG.length })
  expect(seen.puts).toEqual([
    { authorization: null, cookie: null, contentType: 'application/pdf', size: 3000 },
    { authorization: null, cookie: null, contentType: 'image/png', size: PNG.length },
  ])
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  expect(overflow).toBeLessThanOrEqual(0)
})
