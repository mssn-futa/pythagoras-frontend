import { test, expect } from './test.js'

test('renders and loads an intercepted response after interaction', async ({ page }) => {
  let requests = 0
  await page.route('**/__harness__/message', async (route) => {
    requests += 1
    await route.fulfill({ json: { success: true, data: { message: 'Browser response' } } })
  })
  await page.goto('/tests/browser/index.html')
  await expect(page.getByRole('heading', { name: 'Frontend harness sample' })).toBeVisible()
  await expect(page.getByRole('status')).toHaveText('No request yet')
  await page.getByRole('button', { name: 'Load message' }).click()
  await expect(page.getByRole('status')).toHaveText('Browser response')
  expect(requests).toBe(1)
})

test('renders a controlled request failure', async ({ page }) => {
  await page.route('**/__harness__/message', (route) => route.fulfill({ status: 503 }))
  await page.goto('/tests/browser/index.html')
  await page.getByRole('button', { name: 'Load message' }).click()
  await expect(page.getByRole('status')).toHaveText('Request unavailable')
  await expect(page.getByRole('button')).toBeEnabled()
})

test('a fresh context has no cookies or storage and leaves disposable state', async ({ page, context }) => {
  await page.goto('/tests/browser/index.html')
  expect(await context.cookies()).toEqual([])
  expect(await page.evaluate(() => [localStorage.length, sessionStorage.length])).toEqual([0, 0])
  await page.evaluate(() => {
    localStorage.setItem('harness', 'local state')
    sessionStorage.setItem('harness', 'session state')
    document.cookie = 'harness=cookie; path=/'
  })
})

test('another context starts clean', async ({ page, context }) => {
  await page.goto('/tests/browser/index.html')
  expect(await context.cookies()).toEqual([])
  expect(await page.evaluate(() => [localStorage.length, sessionStorage.length])).toEqual([0, 0])
  await expect(page.getByRole('status')).toHaveText('No request yet')
})
