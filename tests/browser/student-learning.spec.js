import { test, expect } from './test.js'

// Synthetic, test-only API shaped like D3 (no real backend). Stateful enrollment.
const API = 'https://api.pythagoras.test'
const MEDIA = 'https://media.example.test'
const VID = 'dQw4w9WgXcQ'
const EMBED = `https://www.youtube-nocookie.com/embed/${VID}`
const student = {
  id: 1, email: 'student@example.test', first_name: 'Amina', last_name: 'Yusuf', matric_number: 'CSC/21/001',
  department: 'Computer Science', level: '300', role: 'student', is_active: true,
}
const klass = { id: 2, code: 'ARB101', title: 'Arabic for beginners', description: 'Greetings and basics.', kind: 'arabic', status: 'published' }
const ev = { id: 3, title: 'Friday khutbah' }
const base = { event_id: 3, status: 'published', event: ev }
const modules = [
  {
    id: 20, title: 'Greetings', body: 'Say salam.\nThen ask how they are.', order: 1, status: 'published',
    resources: [
      { ...base, id: 8, title: 'Greeting audio', type: 'aud', storage_status: 'ready', media_url: `${MEDIA}/a.mp3`, duration: 60 },
      { ...base, id: 9, title: 'Greeting video', type: 'vid', storage_status: 'not_applicable', media_url: null, playback: { provider: 'youtube', video_id: VID, watch_url: `https://www.youtube.com/watch?v=${VID}`, embed_url: EMBED } },
      { ...base, id: 10, title: 'Greeting workbook', type: 'doc', storage_status: 'ready', media_url: `${MEDIA}/w.pdf`, file_name: 'workbook.pdf', content_type: 'application/pdf', size_bytes: 2048 },
    ],
    quizzes: [{ id: 45, title: 'Arabic week 1', status: 'published' }],
  },
  { id: 21, title: 'Numbers', body: 'One to ten.', order: 2, status: 'published', resources: [], quizzes: [] },
]
const quiz = { id: 45, title: 'Arabic week 1', description: 'Weekly assessment', time_limit: 30, deadline: '2036-10-12T20:00:00Z', status: 'published', total_points: 3, question_count: 2 }

const corsFor = (route) => ({
  'Access-Control-Allow-Origin': route.request().headers().origin ?? '',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type, Accept',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
})

async function mockApi(page) {
  const calls = []
  let enrollment = null
  const reply = (route, status, data, message = 'OK.') =>
    route.fulfill({ status, headers: corsFor(route), contentType: 'application/json', body: JSON.stringify({ success: status < 400, data, message }) })
  const row = () => ({ id: 6, course_id: 2, student_id: 1, status: enrollment })
  const active = () => enrollment === 'active'

  await page.route(/fonts\.(googleapis|gstatic)\.com/, (route) => route.fulfill({ status: 200, contentType: 'text/css', body: '' }))
  await page.route(`${EMBED}**`, (route) => route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>player</title>' }))
  await page.route(`${MEDIA}/**`, (route) => route.fulfill({ status: 200, contentType: 'audio/mpeg', body: '' }))
  await page.route(`${API}/**`, async (route) => {
    const request = route.request()
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: corsFor(route) })
    const path = new URL(request.url()).pathname
    calls.push({ method: request.method(), path })
    if (path === '/accounts/refresh/') return reply(route, 200, { access: 'access-1', refresh: 'refresh-1' })
    if (path === '/accounts/me/') return reply(route, 200, student)
    if (path === '/quiz/classes/') return reply(route, 200, { count: 1, next: null, previous: null, results: [klass] })
    if (path === '/quiz/classes/2/') return reply(route, 200, klass)
    if (path === '/quiz/classes/2/enrollment/') {
      if (request.method() === 'POST') { enrollment = 'active'; return reply(route, 200, row(), 'Enrolled.') }
      if (request.method() === 'DELETE') { enrollment = 'withdrawn'; return reply(route, 200, row(), 'Withdrawn.') }
      return enrollment ? reply(route, 200, row()) : reply(route, 404, { code: 'NOT_FOUND' }, 'No enrollment.')
    }
    if (path.startsWith('/quiz/classes/2/modules/')) {
      if (!active()) return reply(route, 403, { code: 'NOT_ENROLLED' }, 'Enroll to read modules.')
      if (path === '/quiz/classes/2/modules/') return reply(route, 200, { count: 2, next: null, previous: null, results: modules })
      const found = modules.find((m) => path === `/quiz/classes/2/modules/${m.id}/`)
      return found ? reply(route, 200, found) : reply(route, 404, { code: 'NOT_FOUND' }, 'Not found.')
    }
    if (path === '/quiz/quizzes/45/') return reply(route, 200, quiz)
    return reply(route, 404, { code: 'NOT_FOUND' }, 'Not found.')
  })
  return { calls, moduleCalls: () => calls.filter((c) => c.path.includes('/modules/')) }
}

test('catalog → enroll → read module (audio, video, document) → quiz link → deep-link reload → withdraw', async ({ page, isMobile }, testInfo) => {
  const api = await mockApi(page)
  await page.addInitScript(() => sessionStorage.setItem('pythagoras.refreshToken', 'refresh-0'))

  await page.goto('/dawah/classes')
  await expect(page.getByRole('heading', { name: 'Arabic for beginners' })).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('catalog.png') })
  await page.getByRole('link', { name: 'View Arabic for beginners' }).click()
  await expect(page).toHaveURL('/dawah/classes/2')
  await expect(page.getByText('You are not enrolled.')).toBeVisible()
  expect(api.moduleCalls()).toHaveLength(0)
  await page.screenshot({ path: testInfo.outputPath('detail-not-enrolled.png') })

  await page.getByRole('button', { name: 'Enroll' }).click()
  await expect(page.getByRole('heading', { name: 'Modules' })).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('detail-enrolled.png') })
  await page.getByRole('link', { name: 'Greetings' }).click()
  await expect(page).toHaveURL('/dawah/classes/2/modules/20')
  await expect(page.getByRole('heading', { name: 'Greetings', level: 1 })).toBeVisible()
  await expect(page.locator('audio')).toHaveCount(1)
  await expect(page.locator(`iframe[src="${EMBED}"]`)).toHaveCount(1)
  await expect(page.getByRole('link', { name: /Open document/ })).toHaveAttribute('href', `${MEDIA}/w.pdf`)
  await page.screenshot({ path: testInfo.outputPath('module.png'), fullPage: true })

  await page.reload()
  await expect(page.getByRole('heading', { name: 'Greetings', level: 1 })).toBeVisible()
  await expect(page.locator('audio')).toHaveCount(1)

  await page.getByRole('link', { name: 'Arabic week 1' }).click()
  await expect(page).toHaveURL('/dawah/quizzes/45')
  await expect(page.getByRole('heading', { name: 'Arabic week 1' })).toBeVisible()

  await page.goto('/dawah/classes/2')
  await page.getByRole('button', { name: 'Withdraw' }).click()
  await page.getByRole('button', { name: 'Yes, withdraw' }).click()
  await expect(page.getByTestId('enrollment-state')).toHaveText('You have withdrawn from this class.')
  const before = api.moduleCalls().length
  await page.goto('/dawah/classes/2/modules/20')
  await expect(page.getByText('You have withdrawn from this class').first()).toBeVisible()
  expect(api.moduleCalls()).toHaveLength(before)
  await page.screenshot({ path: testInfo.outputPath('withdrawn.png') })

  if (isMobile) {
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(overflow).toBeLessThanOrEqual(0)
  }
})
