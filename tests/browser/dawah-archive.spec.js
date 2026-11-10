/* global Buffer */
import { test, expect } from './test.js'

// Synthetic, test-only public Da'wah API shaped like the frozen D2 examples.
const API = 'https://api.pythagoras.test'
const MEDIA = 'https://media.pythagoras.test/khutbah-8.wav'
const APP_ORIGIN = 'http://127.0.0.1:4179'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type, Accept, Range',
  'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
  'Access-Control-Expose-Headers': 'Content-Range, Accept-Ranges, Content-Length',
}

const eventPayload = { id: 3, title: 'Friday khutbah', speakers: 'Guest speaker', category: 'jumuah', start_time: '2026-10-09T12:00:00Z', summary: 'Key takeaways' }
const resource = {
  id: 8, event_id: 3, title: 'Patience', type: 'aud', status: 'published', storage_status: 'ready',
  media_url: MEDIA, duration: 10, event: eventPayload,
}

/** 10 s of 8 kHz mono 16-bit silence as a WAV; enough for real playback and Range seeking. */
function wav() {
  const rate = 8000
  const samples = rate * 10
  const buffer = Buffer.alloc(44 + samples * 2)
  buffer.write('RIFF', 0)
  buffer.writeUInt32LE(36 + samples * 2, 4)
  buffer.write('WAVEfmt ', 8)
  buffer.writeUInt32LE(16, 16)
  buffer.writeUInt16LE(1, 20)
  buffer.writeUInt16LE(1, 22)
  buffer.writeUInt32LE(rate, 24)
  buffer.writeUInt32LE(rate * 2, 28)
  buffer.writeUInt16LE(2, 32)
  buffer.writeUInt16LE(16, 34)
  buffer.write('data', 36)
  buffer.writeUInt32LE(samples * 2, 40)
  return buffer
}

async function mockPublicApi(page) {
  const calls = []
  const ranges = []
  // The app shell requests web fonts; answer them locally so nothing leaves the machine.
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (route) => route.fulfill({ status: 200, contentType: 'text/css', body: '' }))
  const body = wav()
  const json = (route, data) =>
    route.fulfill({ status: 200, headers: cors, contentType: 'application/json', body: JSON.stringify({ success: true, data, message: 'OK.' }) })
  const paged = (results) => ({ count: results.length, next: null, previous: null, results })

  await page.route(`${API}/**`, async (route) => {
    const request = route.request()
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors })
    const url = new URL(request.url())
    calls.push({ path: url.pathname, query: url.search, auth: (await request.allHeaders()).authorization ?? null })
    if (url.pathname === '/dawah/archive/') {
      const search = url.searchParams.get('search')
      return json(route, paged(search && !'patience'.includes(search.toLowerCase()) ? [] : [resource]))
    }
    if (url.pathname === '/dawah/events/') return json(route, paged([]))
    if (url.pathname === '/dawah/resources/8/') return json(route, resource)
    if (url.pathname === '/dawah/events/3/') return json(route, { ...eventPayload, resources: [resource] })
    return route.fulfill({ status: 404, headers: cors, contentType: 'application/json', body: JSON.stringify({ success: false, data: { code: 'NOT_FOUND' }, message: 'Not found.' }) })
  })

  await page.route(MEDIA, async (route) => {
    const range = (await route.request().allHeaders()).range
    ranges.push(range ?? null)
    const common = { ...cors, 'Content-Type': 'audio/wav', 'Accept-Ranges': 'bytes' }
    const match = /bytes=(\d+)-(\d*)/.exec(range ?? '')
    if (!match) return route.fulfill({ status: 200, headers: { ...common, 'Content-Length': String(body.length) }, body })
    const start = Number(match[1])
    const end = match[2] ? Math.min(Number(match[2]), body.length - 1) : body.length - 1
    const chunk = body.subarray(start, end + 1)
    return route.fulfill({ status: 206, headers: { ...common, 'Content-Range': `bytes ${start}-${end}/${body.length}`, 'Content-Length': String(chunk.length) }, body: chunk })
  })
  return { calls, ranges }
}

test('anonymous reader finds a recording, plays and seeks it, and a deep link survives reload', async ({ page }) => {
  expect(APP_ORIGIN).toContain('127.0.0.1')
  const api = await mockPublicApi(page)

  await page.goto('/dawah')
  await expect(page.getByRole('heading', { name: 'Da’wah archive' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Patience' }).first()).toBeVisible()

  // Filters live in the URL: an unmatched search shows the empty state, and reload keeps it.
  await page.getByLabel('Search').fill('zzz')
  await page.getByRole('button', { name: 'Apply filters' }).click()
  await expect(page.getByText('No matching recordings')).toBeVisible()
  await page.reload()
  await expect(page).toHaveURL(/\/dawah\?q=zzz/)
  await expect(page.getByText('No matching recordings')).toBeVisible()
  await page.getByRole('button', { name: 'Clear' }).click()

  await page.getByRole('link', { name: 'Listen' }).click()
  await expect(page).toHaveURL(/\/dawah\/content\/8$/)
  const player = page.getByRole('group', { name: /Audio player/ })
  await expect(player).toBeVisible()
  const seek = player.getByRole('slider', { name: 'Seek' })
  await expect(seek).toBeEnabled() // real duration arrived from loadedmetadata
  await expect(player.getByText('0:10').last()).toBeVisible()

  const time = () => page.evaluate(() => document.querySelector('audio').currentTime)
  await player.getByRole('button', { name: 'Play' }).click()
  await expect(player.getByRole('button', { name: 'Pause' })).toBeVisible()
  await expect.poll(time).toBeGreaterThan(0.2)
  await player.getByRole('button', { name: 'Pause' }).click()
  await expect(player.getByRole('button', { name: 'Play' })).toBeVisible()

  await player.getByRole('button', { name: 'Forward 15 seconds' }).click() // clamps to the end
  await expect.poll(time).toBeGreaterThan(8)
  await seek.focus()
  await page.keyboard.press('Home')
  await expect.poll(time).toBeLessThan(1)
  // The browser negotiated byte ranges (206) with the media server for this seekable source.
  expect(api.ranges.some(Boolean)).toBe(true)

  // Deep link reload.
  await page.reload()
  await expect(page).toHaveURL(/\/dawah\/content\/8$/)
  await expect(page.getByRole('heading', { name: 'Patience' })).toBeVisible()
  await expect(page.getByRole('group', { name: /Audio player/ })).toBeVisible()

  await page.goto('/dawah/events/3')
  await expect(page.getByRole('heading', { name: 'Friday khutbah' })).toBeVisible()
  await expect(page.getByRole('group', { name: /Audio player/ })).toHaveCount(1)

  expect(api.calls.length).toBeGreaterThan(0)
  expect(api.calls.every((call) => call.auth === null)).toBe(true) // public reads: no bearer
})

test('a media failure is shown as an error, not as playing', async ({ page }) => {
  await mockPublicApi(page)
  await page.route(MEDIA, (route) => route.fulfill({ status: 404, headers: cors, body: 'missing' }))
  await page.goto('/dawah/content/8')
  const player = page.getByRole('group', { name: /Audio player/ })
  await expect(player.getByRole('alert')).toContainText(/unavailable|format/i)
  await expect(player.getByRole('button', { name: 'Play' })).toBeDisabled()
  await expect(player.getByRole('button', { name: 'Retry' })).toBeVisible()
})
