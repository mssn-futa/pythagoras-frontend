import { test, expect } from './test.js'

// Synthetic, test-only API shaped like the frozen D1 examples.
const API = 'https://api.pythagoras.test'
const student = {
  id: 1,
  email: 'student@example.test',
  first_name: 'Amina',
  last_name: 'Yusuf',
  matric_number: 'CSC/21/001',
  department: 'Computer Science',
  level: '300',
  role: 'student',
  is_active: true,
}

// Echo the page's own origin so the spec works on whatever port the harness serves.
const corsFor = (route) => ({
  'Access-Control-Allow-Origin': route.request().headers().origin ?? '',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type, Accept',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
})

/** Fulfills /accounts/* like PLAT-03 would, recording each non-preflight call. */
async function mockAccountsApi(page) {
  const calls = []
  let refreshCount = 0
  const reply = (route, status, body) =>
    route.fulfill({ status, headers: corsFor(route), contentType: 'application/json', body: JSON.stringify(body) })

  await page.route(`${API}/accounts/**`, async (route) => {
    const request = route.request()
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: corsFor(route) })
    const path = new URL(request.url()).pathname
    const body = request.postDataJSON?.() ?? null
    const auth = (await request.allHeaders()).authorization ?? null
    calls.push({ method: request.method(), path, auth, body })

    if (path === '/accounts/login/') {
      return reply(route, 200, { success: true, data: { user: student, tokens: { access: 'access-0', refresh: 'refresh-0' } }, message: 'Signed in.' })
    }
    if (path === '/accounts/refresh/') {
      refreshCount += 1
      const expected = `refresh-${refreshCount - 1}`
      if (body?.refresh !== expected) {
        return reply(route, 401, { success: false, data: { code: 'TOKEN_NOT_VALID' }, message: 'Token is invalid or expired.' })
      }
      return reply(route, 200, { success: true, data: { access: `access-${refreshCount}`, refresh: `refresh-${refreshCount}` }, message: 'Refreshed.' })
    }
    if (path === '/accounts/me/') {
      if (auth !== `Bearer access-${refreshCount}`) {
        return reply(route, 401, { success: false, data: { code: 'NOT_AUTHENTICATED' }, message: 'Authentication required.' })
      }
      return reply(route, 200, { success: true, data: student, message: 'OK.' })
    }
    if (path === '/accounts/logout/') return route.fulfill({ status: 204, headers: corsFor(route) })
    return reply(route, 404, { success: false, data: { code: 'NOT_FOUND' }, message: 'Not found.' })
  })
  return { calls, count: (path) => calls.filter((call) => call.path === path).length }
}

test('sign-in → guarded page → reload restoration → logout', async ({ page, isMobile }) => {
  // The app stylesheet imports a web font; serve it empty instead of the network.
  await page.route('https://fonts.googleapis.com/**', (route) => route.fulfill({ contentType: 'text/css', body: '' }))
  const api = await mockAccountsApi(page)

  await page.goto('/profile')
  await expect(page).toHaveURL('/sign-in?next=%2Fprofile')
  expect(api.calls).toEqual([])

  await page.getByLabel('Email or matric number').fill('CSC/21/001')
  await page.getByLabel('Password', { exact: true }).fill('synthetic-password')
  await page.getByRole('button', { name: 'Sign in' }).click()

  await expect(page).toHaveURL('/profile')
  await expect(page.getByRole('heading', { name: 'Amina Yusuf' })).toBeVisible()
  expect(api.calls[0]).toEqual({
    method: 'POST', path: '/accounts/login/', auth: null,
    body: { email_or_matric: 'CSC/21/001', password: 'synthetic-password' },
  })
  const stored = await page.evaluate(() => ({ session: { ...sessionStorage }, local: localStorage.length }))
  expect(stored).toEqual({ session: { 'pythagoras.refreshToken': 'refresh-0', theme: 'light' }, local: 0 })

  await page.reload()
  await expect(page.getByRole('heading', { name: 'Amina Yusuf' })).toBeVisible()
  await expect(page).toHaveURL('/profile')
  expect(api.count('/accounts/refresh/')).toBe(1)
  expect(api.calls.filter((call) => call.path === '/accounts/me/').map((call) => call.auth)).toEqual(['Bearer access-1'])

  if (isMobile) await page.getByRole('button', { name: 'Open menu' }).click()
  await page.getByRole('button', { name: 'Sign out' }).click()

  await expect(page).toHaveURL('/sign-in')
  await expect(page.getByText('You have signed out.')).toBeVisible()
  expect(api.calls.at(-1)).toEqual({ method: 'POST', path: '/accounts/logout/', auth: 'Bearer access-1', body: { refresh: 'refresh-1' } })
  expect(await page.evaluate(() => sessionStorage.getItem('pythagoras.refreshToken'))).toBeNull()

  // A reload after logout stays signed out without attempting a refresh.
  await page.goto('/profile')
  await expect(page).toHaveURL('/sign-in?next=%2Fprofile')
  expect(api.count('/accounts/refresh/')).toBe(1)
})
