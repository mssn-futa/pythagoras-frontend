import { test, expect } from './test.js'

// Synthetic, test-only API shaped like the frozen D1 examples.
const API = 'https://api.pythagoras.test'
const admin = {
  id: 2, email: 'admin@example.test', first_name: 'Bilal', last_name: 'Okafor',
  matric_number: null, department: '', level: '', role: 'admin', is_active: true,
}
const students = [
  { id: 11, email: 'amina@example.test', first_name: 'Amina', last_name: 'Yusuf', matric_number: 'CSC/21/001', department: 'Computer Science', level: '300', role: 'student', is_active: true, date_joined: '2026-03-01T10:00:00Z' },
  { id: 12, email: 'tunde@example.test', first_name: 'Tunde', last_name: 'Bello', matric_number: 'ENG/20/014', department: 'Engineering', level: '400', role: 'student', is_active: true, date_joined: '2026-03-02T10:00:00Z' },
]

async function mockApi(page, origin) {
  const cors = {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'Authorization, Content-Type, Accept',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
  }
  const calls = []
  const reply = (route, status, data, message = 'OK.') =>
    route.fulfill({ status, headers: cors, contentType: 'application/json', body: JSON.stringify({ success: status < 400, data, message }) })

  await page.route(`${API}/accounts/**`, async (route) => {
    const request = route.request()
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors })
    const { pathname, searchParams } = new URL(request.url())
    const body = request.postDataJSON?.() ?? null
    calls.push({ method: request.method(), path: pathname, query: Object.fromEntries(searchParams), body })

    if (pathname === '/accounts/refresh/') return reply(route, 200, { access: 'access-1', refresh: 'refresh-1' }, 'Refreshed.')
    if (pathname === '/accounts/me/') return reply(route, 200, admin)
    if (pathname === '/accounts/students/') {
      const term = (searchParams.get('search') ?? '').toLowerCase()
      const rows = students.filter((s) => `${s.first_name} ${s.matric_number}`.toLowerCase().includes(term))
      return reply(route, 200, { count: rows.length, next: null, previous: null, results: rows })
    }
    const detail = pathname.match(/^\/accounts\/students\/(\d+)\/$/)
    if (detail) {
      const record = students.find((s) => s.id === Number(detail[1]))
      if (request.method() === 'GET') return reply(route, 200, record)
      if (body.is_active === false) return reply(route, 409, { code: 'LAST_ADMIN' }, 'This change is not allowed right now.')
      if (body.email) return reply(route, 400, { code: 'VALIDATION_ERROR', fields: { email: ['A student with this email already exists.'] } }, 'Invalid input.')
      return reply(route, 200, { ...record, ...body })
    }
    return reply(route, 404, { code: 'NOT_FOUND' }, 'Not found.')
  })
  return calls
}

test('admin student list: search, detail, field error and failed deactivation', async ({ page, baseURL }) => {
  await page.route('https://fonts.googleapis.com/**', (route) => route.fulfill({ contentType: 'text/css', body: '' }))
  await page.addInitScript(() => sessionStorage.setItem('pythagoras.refreshToken', 'refresh-0'))
  const calls = await mockApi(page, baseURL)
  const listCalls = () => calls.filter((c) => c.path === '/accounts/students/')

  await page.goto('/admin/students')
  await expect(page.getByRole('heading', { name: 'Student Management' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Amina Yusuf', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Tunde Bello', exact: true })).toBeVisible()
  await expect(page.getByText('John Doe')).toHaveCount(0)

  // Search narrows the real list and is reflected in the URL.
  await page.getByLabel('Search students').fill('tunde')
  await expect(page).toHaveURL(/\?search=tunde$/)
  await expect(page.getByRole('button', { name: 'Amina Yusuf', exact: true })).toHaveCount(0)
  expect(listCalls().at(-1).query).toEqual({ search: 'tunde', page_size: '20' })

  // Detail by id in the URL.
  await page.getByRole('button', { name: 'View profile of Tunde Bello' }).click()
  await expect(page).toHaveURL(/student=12/)
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByLabel('Email')).toHaveValue('tunde@example.test')

  // API field error is attached to the input; nothing is claimed saved.
  await dialog.getByLabel('Email').fill('taken@example.test')
  await dialog.getByRole('button', { name: 'Save changes' }).click()
  await expect(dialog.getByText('A student with this email already exists.')).toBeVisible()
  await expect(dialog.getByText('Changes saved.')).toHaveCount(0)

  // Deactivation: confirmation, then a 409 keeps the account active and says why.
  const deactivate = dialog.getByRole('button', { name: 'Deactivate account' })
  await deactivate.scrollIntoViewIfNeeded()
  await deactivate.click()
  const confirm = dialog.getByRole('button', { name: 'Confirm deactivate' })
  await confirm.scrollIntoViewIfNeeded()
  await expect(confirm).toBeInViewport()
  await confirm.click()
  await expect(dialog.getByRole('alert').filter({ hasText: 'This change is not allowed right now.' })).toBeVisible()
  await expect(dialog.getByText('Active', { exact: true })).toBeVisible()
  expect(calls.filter((c) => c.method === 'PATCH').map((c) => c.body)).toEqual([{ email: 'taken@example.test' }, { is_active: false }])

  // Reload keeps the same student open from the URL.
  await page.reload()
  await expect(page.getByRole('dialog').getByLabel('Email')).toHaveValue('tunde@example.test')
})
