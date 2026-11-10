import { Buffer } from 'node:buffer'
import { test, expect } from './test.js'

// Synthetic, test-only backend: Pythagoras API plus a fake R2 host.
const API = 'https://api.pythagoras.test'
const R2 = 'https://r2.example.test'
const admin = {
  id: 2, email: 'admin@example.test', first_name: 'Bilal', last_name: 'Okafor', matric_number: null,
  department: 'Computer Science', level: '300', role: 'admin', is_active: true,
}
const event = {
  id: 3, title: 'Friday khutbah', category: 'jumuah', tags: 'patience', speakers: 'Guest speaker', location: 'FUTA mosque',
  start_time: '2026-10-09T12:00:00Z', end_time: '2026-10-09T13:00:00Z', summary: 'Key takeaways', description: 'Friday session',
  status: 'published', published_at: '2026-10-01T09:00:00Z',
}

test('admin uploads audio directly to storage (no bearer), sees server-validated ready, and publishes', async ({ page, baseURL }) => {
  const origin = new URL(baseURL).origin
  const cors = {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'Authorization, Content-Type, Accept',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, PUT, OPTIONS',
    'Access-Control-Expose-Headers': 'ETag',
  }
  const reply = (route, status, data) =>
    route.fulfill({ status, headers: cors, contentType: 'application/json', body: JSON.stringify({ success: true, data, message: 'OK.' }) })

  const resource = { id: 8, event_id: 3, title: 'Patience', type: 'aud', status: 'draft', storage_status: 'none', media_url: null }
  const seen = { put: [], finalize: 0, intents: 0 }

  await page.route('https://fonts.googleapis.com/**', (route) => route.fulfill({ contentType: 'text/css', body: '' }))
  await page.addInitScript(() => sessionStorage.setItem('pythagoras.refreshToken', 'refresh-0'))

  await page.route(`${API}/**`, async (route) => {
    const request = route.request()
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors })
    const path = new URL(request.url()).pathname
    const method = request.method()
    if (path === '/accounts/refresh/') return reply(route, 200, { access: 'access-1', refresh: 'refresh-1' })
    if (path === '/accounts/me/') return reply(route, 200, admin)
    if (path === '/dawah/events/3/') return reply(route, 200, event)
    if (path === '/dawah/events/3/resources/8/' && method === 'GET') return reply(route, 200, { ...resource, preview_url: resource.storage_status === 'ready' ? `${R2}/preview?sig=1` : undefined })
    if (path === '/dawah/events/3/resources/8/audio/') {
      seen.intents += 1
      return reply(route, 201, {
        upload_id: 12, resource_id: 8, method: 'PUT', upload_url: `${R2}/staging/abc?X-Amz-Signature=synthetic`,
        headers: { 'Content-Type': 'audio/mpeg' }, expires_at: '2099-01-01T00:00:00Z',
      })
    }
    if (path === '/dawah/uploads/12/finalize/') {
      seen.finalize += 1
      resource.storage_status = 'ready'
      return reply(route, 200, { upload: { status: 'ready' } })
    }
    if (path === '/dawah/events/3/resources/8/publish/') {
      resource.status = 'published'
      return reply(route, 200, resource)
    }
    return route.fulfill({ status: 404, headers: cors, contentType: 'application/json', body: JSON.stringify({ success: false, data: { code: 'NOT_FOUND' }, message: 'Not found.' }) })
  })

  await page.route(`${R2}/**`, async (route) => {
    const request = route.request()
    const headers = await request.allHeaders()
    const r2Cors = { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'PUT, GET, OPTIONS', 'Access-Control-Expose-Headers': 'ETag' }
    if (request.method() === 'OPTIONS') {
      return route.fulfill({ status: 204, headers: r2Cors })
    }
    if (request.method() === 'PUT') {
      seen.put.push({ authorization: headers.authorization ?? null, cookie: headers.cookie ?? null, contentType: headers['content-type'], size: request.postDataBuffer()?.length })
      return route.fulfill({ status: 200, headers: { ...r2Cors, ETag: '"abc"' }, body: '' })
    }
    return route.fulfill({ status: 200, headers: r2Cors, contentType: 'audio/mpeg', body: '' })
  })

  await page.goto('/admin/events/3/resources/8')
  await expect(page.getByRole('heading', { name: 'Patience' })).toBeVisible()
  expect(await page.getByLabel(/MP3 file/).isVisible()).toBe(true)

  await page.getByLabel(/MP3 file/).setInputFiles({ name: 'khutbah.mp3', mimeType: 'audio/mpeg', buffer: Buffer.alloc(4096, 1) })
  await expect(page.getByText(/server confirmed this audio is ready/i)).toBeVisible()

  expect(seen.intents).toBe(1)
  expect(seen.finalize).toBe(1)
  expect(seen.put).toEqual([{ authorization: null, cookie: null, contentType: 'audio/mpeg', size: 4096 }])
  // Playwright does not surface CORS preflights to page.route handlers for fulfilled routes
  // (an earlier "at least one preflight" assertion proved vacuous: 0 were routed), so the
  // proof of no credentials is the actual PUT request's headers asserted above.

  await page.getByRole('button', { name: 'Publish resource' }).click()
  await expect(page.getByText('Resource published.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Unpublish resource' })).toBeVisible()

  // Forms and actions must fit phone widths without sideways scrolling.
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  expect(overflow).toBeLessThanOrEqual(0)
})
