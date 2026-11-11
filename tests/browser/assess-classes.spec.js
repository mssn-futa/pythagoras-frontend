import { test, expect } from './test.js'

// Synthetic, test-only API for the admin Arabic class journey (D3 contracts).
const API = 'https://api.pythagoras.test'
const admin = {
  id: 2, email: 'admin@example.test', first_name: 'Bilal', last_name: 'Okafor',
  matric_number: null, department: 'Computer Science', level: '300', role: 'admin', is_active: true,
}
const resource = { id: 8, title: 'Patience', type: 'aud', event: { id: 3, title: 'Friday khutbah' } }

const corsFor = (route) => ({
  'Access-Control-Allow-Origin': route.request().headers().origin ?? '',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type, Accept',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
})

async function mockApi(page) {
  const klass = { id: 51, code: '', title: '', description: '', kind: 'arabic', status: 'draft', created_at: '2026-10-01T09:00:00Z', updated_at: '2026-10-01T09:00:00Z' }
  const modules = []
  const enrollments = [{ id: 6, course_id: 51, student_id: 1, status: 'active', student_name: 'Amina Yusuf', student_email: 'amina@example.test', enrolled_at: '2026-10-02T08:00:00Z', withdrawn_at: null }]
  let created = false
  const calls = []
  const reply = (route, status, data, message = 'OK.') =>
    route.fulfill({ status, headers: corsFor(route), contentType: 'application/json', body: JSON.stringify({ success: true, data, message }) })
  const paged = (results) => ({ count: results.length, next: null, previous: null, results })

  await page.route(`${API}/**`, async (route) => {
    const request = route.request()
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: corsFor(route) })
    const { pathname, searchParams } = new URL(request.url())
    const body = request.postDataJSON?.() ?? null
    const method = request.method()
    calls.push({ method, path: pathname, body })

    if (pathname === '/accounts/refresh/') return reply(route, 200, { access: 'access-1', refresh: 'refresh-1' })
    if (pathname === '/accounts/me/') return reply(route, 200, admin)
    if (pathname === '/quiz/classes/' && method === 'GET') return reply(route, 200, paged(created ? [klass] : []))
    if (pathname === '/quiz/classes/' && method === 'POST') {
      Object.assign(klass, body)
      created = true
      return reply(route, 201, klass, 'Saved.')
    }
    if (pathname === '/quiz/classes/51/' && method === 'GET') return reply(route, 200, klass)
    if (pathname === '/quiz/classes/51/publish/') {
      klass.status = 'published'
      return reply(route, 200, klass, 'Published.')
    }
    if (pathname === '/dawah/archive/') return reply(route, 200, paged([resource]))
    if (pathname === '/quiz/classes/51/modules/' && method === 'GET') return reply(route, 200, paged(modules))
    if (pathname === '/quiz/classes/51/modules/' && method === 'POST') {
      const module = { id: 61, course_id: 51, status: 'draft', quizzes: [], title: body.title, body: body.body, order: body.order, resources: [resource] }
      modules.push(module)
      return reply(route, 201, module, 'Saved.')
    }
    if (pathname === '/quiz/classes/51/modules/61/' && method === 'GET') return reply(route, 200, modules[0])
    if (pathname === '/quiz/classes/51/modules/61/publish/') {
      modules[0].status = 'published'
      return reply(route, 200, modules[0], 'Published.')
    }
    if (pathname === '/quiz/classes/51/enrollments/' && method === 'GET') {
      const status = searchParams.get('status')
      return reply(route, 200, paged(enrollments.filter((row) => !status || row.status === status)))
    }
    if (pathname === '/quiz/classes/51/enrollments/' && method === 'POST') {
      const row = enrollments.find((item) => item.student_id === body.student_id)
      row.status = body.status
      row.withdrawn_at = body.status === 'withdrawn' ? '2026-10-05T08:00:00Z' : null
      return reply(route, 200, row, 'Saved.')
    }
    return route.fulfill({ status: 404, headers: corsFor(route), contentType: 'application/json', body: JSON.stringify({ success: false, data: { code: 'NOT_FOUND' }, message: 'Not found.' }) })
  })
  return { calls }
}

test('admin creates, publishes and manages an Arabic class, module and roster', async ({ page }) => {
  await page.route('https://fonts.googleapis.com/**', (route) => route.fulfill({ contentType: 'text/css', body: '' }))
  await page.addInitScript(() => sessionStorage.setItem('pythagoras.refreshToken', 'refresh-0'))
  const api = await mockApi(page)

  await page.goto('/admin/classes')
  await expect(page.getByText(/No Arabic classes yet/)).toBeVisible()
  await page.getByRole('link', { name: 'New class' }).click()
  await page.getByLabel('Code').fill('ARB101')
  await page.getByLabel('Title').fill('Arabic for beginners')
  await page.getByLabel('Description').fill('Greetings and basics.')
  await page.getByRole('button', { name: 'Save draft class' }).click()
  await expect(page).toHaveURL('/admin/classes/51')
  await expect(page.getByText('Draft class saved. You can now add modules.')).toBeVisible()

  await page.getByRole('button', { name: 'Publish class' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Publish class' }).click()
  await expect(page.getByText(/Class published\./)).toBeVisible()

  await page.getByRole('link', { name: 'Modules' }).click()
  await page.getByRole('link', { name: 'Add module' }).click()
  await page.getByLabel('Title').fill('Arabic greetings')
  await page.getByLabel(/Lesson text/).fill('Lesson text')
  await page.getByRole('button', { name: 'Attach Patience' }).click()
  await page.getByRole('button', { name: 'Save draft module' }).click()
  await expect(page.getByText('Module saved as a draft.')).toBeVisible()
  await page.getByRole('link', { name: 'Back to modules' }).click()
  await page.getByRole('button', { name: 'Publish Arabic greetings' }).click()
  await expect(page.getByText(/"Arabic greetings" published/)).toBeVisible()

  await page.getByRole('link', { name: 'Roster' }).click()
  await expect(page).toHaveURL('/admin/classes/51/roster')
  await expect(page.getByText('Amina Yusuf')).toBeVisible()
  await page.getByRole('button', { name: 'Withdraw Amina Yusuf' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Withdraw' }).click()
  await expect(page.getByText('Amina Yusuf withdrawn.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Reinstate Amina Yusuf' })).toBeVisible()

  expect(api.calls.find((c) => c.method === 'POST' && c.path === '/quiz/classes/').body).toEqual({ code: 'ARB101', title: 'Arabic for beginners', description: 'Greetings and basics.' })
  expect(api.calls.find((c) => c.method === 'POST' && c.path === '/quiz/classes/51/modules/').body).toEqual({ title: 'Arabic greetings', body: 'Lesson text', order: 1, resource_ids: [8] })
  expect(api.calls.find((c) => c.method === 'POST' && c.path === '/quiz/classes/51/enrollments/').body).toEqual({ student_id: 1, status: 'withdrawn' })

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
  expect(overflow).toBe(false)
})
