import { test, expect } from './test.js'

// Synthetic, test-only public API plus a blank stand-in for the YouTube frame host.
const API = 'https://api.pythagoras.test'
const ID = 'abcdefghijk'
const EMBED = `https://www.youtube-nocookie.com/embed/${ID}`
const WATCH = `https://www.youtube.com/watch?v=${ID}`

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type, Accept',
  'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
}
const eventPayload = { id: 3, title: 'Friday khutbah', speakers: 'Guest speaker', category: 'jumuah', start_time: '2026-10-09T12:00:00Z', summary: 'Key takeaways' }
const resource = {
  id: 19, event_id: 3, title: 'Recorded lecture', type: 'vid', status: 'published', storage_status: 'not_applicable', media_url: null, duration: null,
  playback: { provider: 'youtube', video_id: ID, watch_url: WATCH, embed_url: EMBED }, event: eventPayload,
}

test('reader filters the archive to video, sees the embed with a watch link, no bearer sent', async ({ page }) => {
  const calls = []
  const frames = []
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (route) => route.fulfill({ status: 200, contentType: 'text/css', body: '' }))
  // The frame host is answered locally with a blank page: no request leaves the machine.
  await page.route(`${EMBED}**`, (route) => {
    frames.push(route.request().url())
    return route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>blank</title>' })
  })
  const json = (route, data) =>
    route.fulfill({ status: 200, headers: cors, contentType: 'application/json', body: JSON.stringify({ success: true, data, message: 'OK.' }) })
  const paged = (results) => ({ count: results.length, next: null, previous: null, results })
  await page.route(`${API}/**`, async (route) => {
    const request = route.request()
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors })
    const url = new URL(request.url())
    calls.push({ path: url.pathname, type: url.searchParams.get('type'), auth: (await request.allHeaders()).authorization ?? null })
    if (url.pathname === '/dawah/archive/') return json(route, paged(url.searchParams.get('type') === 'vid' ? [resource] : []))
    if (url.pathname === '/dawah/events/') return json(route, paged([]))
    if (url.pathname === '/dawah/resources/19/') return json(route, resource)
    return route.fulfill({ status: 404, headers: cors, contentType: 'application/json', body: JSON.stringify({ success: false, data: { code: 'NOT_FOUND' }, message: 'Not found.' }) })
  })

  await page.goto('/dawah')
  await expect(page.getByText('No recordings published yet')).toBeVisible()
  await page.getByLabel('Type').selectOption('vid')
  await page.getByRole('button', { name: 'Apply filters' }).click()
  await expect(page).toHaveURL(/\/dawah\?type=vid/)
  await page.getByRole('link', { name: 'Recorded lecture' }).first().click()
  await expect(page).toHaveURL(/\/dawah\/content\/19$/)

  const frame = page.locator('iframe')
  await expect(frame).toHaveAttribute('src', EMBED)
  await expect(frame).toHaveAttribute('title', 'Recorded lecture (YouTube video)')
  await frame.scrollIntoViewIfNeeded()
  await expect.poll(() => frames.length).toBeGreaterThan(0)
  const box = await frame.boundingBox()
  expect(box.width).toBeGreaterThan(200)
  expect(Math.abs(box.width / box.height - 16 / 9)).toBeLessThan(0.05)

  const link = page.getByRole('link', { name: 'Watch on YouTube' })
  await expect(link).toBeVisible()
  await expect(link).toHaveAttribute('href', WATCH)
  await expect(page.getByText(/embedding disabled/)).toBeVisible()

  // Responsive: the page never scrolls horizontally, and the frame fits the viewport.
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow).toBeLessThanOrEqual(0)
  const viewport = page.viewportSize()
  expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 1)

  expect(calls.find((call) => call.type === 'vid')).toBeTruthy()
  expect(calls.every((call) => call.auth === null)).toBe(true)
})
