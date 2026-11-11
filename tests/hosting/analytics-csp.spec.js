import { test as base, expect } from '@playwright/test'
import { mockGoogle } from '../browser/ga-stub.js'

// PLAT-08: the GA-enabled production bundle under its generated CSP (tests/hosting/analytics.playwright.config.js).
// Before consent nothing reaches Google; after consent the tag origin and the GA4 collection host are allowed and
// raise no violation, while other Google hosts and arbitrary origins stay blocked (negative controls).
const API = 'https://api.pythagoras.test'
const ID = 'G-PLAT08TEST'

const test = base.extend({
  violations: [async ({ page }, use) => {
    const seen = []
    page.on('console', (message) => /Refused to|Content Security Policy|violates the following/i.test(message.text()) && seen.push(message.text()))
    await page.route(/fonts\.(googleapis|gstatic)\.com/, (route) => route.fulfill({ status: 200, contentType: 'text/css', body: '' }))
    await page.route(`${API}/**`, (route) => {
      const headers = { 'Access-Control-Allow-Origin': route.request().headers().origin ?? '*', 'Access-Control-Allow-Headers': 'Authorization, Content-Type, Accept' }
      if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers })
      const empty = { count: 0, next: null, previous: null, results: [] }
      return route.fulfill({ status: 200, headers, contentType: 'application/json', body: JSON.stringify({ success: true, data: empty, message: 'OK.' }) })
    })
    await use(seen)
  }, { auto: true }],
})

test('GA4 is consent-gated under the production CSP, which allows only the documented GA hosts', async ({ page, violations }) => {
  const google = await mockGoogle(page)
  const response = await page.goto('/dawah?utm_source=mail#top')
  const csp = response.headers()['content-security-policy']
  expect(csp).toMatch(/script-src 'self' https:\/\/www\.googletagmanager\.com;/)
  expect(csp).toContain('https://region1.google-analytics.com')
  expect(csp).not.toContain('*')

  const banner = page.getByRole('region', { name: 'Help us improve Pythagoras?' })
  await expect(banner).toBeVisible()
  await page.waitForTimeout(800)
  expect(google.requests).toEqual([])

  await banner.getByRole('button', { name: 'Accept' }).click()
  await expect.poll(() => google.scripts()).toEqual([`https://www.googletagmanager.com/gtag/js?id=${ID}`])
  await page.goto('/privacy?from=mail#x') // a reload with the stored consent: the tag loads at start-up
  await expect(page.getByRole('heading', { name: 'Privacy settings' })).toBeVisible()
  await expect.poll(() => google.views().length).toBe(1)
  expect(google.scripts()).toHaveLength(2) // once per document
  expect(google.views().at(-1)).toMatchObject({ en: 'page_view', dl: `${new URL(page.url()).origin}/privacy`, dt: 'Privacy settings' })
  expect(violations).toEqual([])

  // Negative controls: hosts outside the allowance are refused by the policy (no request leaves the page).
  const blocked = await page.evaluate(async () => {
    const results = {}
    for (const [name, url] of [['google.com', 'https://www.google.com/g/collect?v=2'], ['doubleclick', 'https://stats.g.doubleclick.net/g/collect?v=2']]) {
      try {
        await fetch(url, { mode: 'no-cors' })
        results[name] = 'sent'
      } catch {
        results[name] = 'blocked'
      }
    }
    const script = document.createElement('script')
    script.src = 'https://tagmanager.example.test/gtag.js'
    results.script = await new Promise((resolve) => {
      script.onload = () => resolve('loaded')
      script.onerror = () => resolve('blocked')
      document.head.appendChild(script)
    })
    return results
  })
  expect(blocked).toEqual({ 'google.com': 'blocked', doubleclick: 'blocked', script: 'blocked' })
  expect(google.requests.some((url) => /doubleclick|www\.google\.com/.test(url))).toBe(false)
  expect(violations.length).toBeGreaterThanOrEqual(3)
})
