import { test, expect } from './test.js'

// Synthetic, test-only API shaped like D4's automation route table; unknown request keys are rejected like the unit fixture.
const API = 'https://api.pythagoras.test'
const admin = {
  id: 2, email: 'admin@example.test', first_name: 'Bilal', last_name: 'Okafor', matric_number: null,
  department: 'Computer Science', level: '300', role: 'admin', is_active: true,
}
const HOSTILE = '<p>Server preview</p><script>window.__pwned = true</script><img src="https://evil.test/x.png" onerror="window.__pwned = 2"><form action="https://evil.test"><input name="x"></form>'
const zero = { queued: 0, sent: 0, failed: 0, uncertain: 0, skipped: 0 }

const corsFor = (route) => ({
  'Access-Control-Allow-Origin': route.request().headers().origin ?? '',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type, Accept',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
})

async function mockApi(page) {
  const calls = []
  let rule = null
  const runs = []
  const reply = (route, status, data, message = 'OK.') =>
    route.fulfill({ status, headers: corsFor(route), contentType: 'application/json', body: JSON.stringify({ success: true, data, message }) })
  const reject = (route, status, code, message, fields) =>
    route.fulfill({ status, headers: corsFor(route), contentType: 'application/json', body: JSON.stringify({ success: false, data: fields ? { code, fields } : { code }, message }) })

  await page.route(`${API}/**`, async (route) => {
    const request = route.request()
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: corsFor(route) })
    const path = new URL(request.url()).pathname
    const body = request.postDataJSON?.() ?? null
    calls.push({ method: request.method(), path, body })

    if (path === '/accounts/refresh/') return reply(route, 200, { access: 'access-1', refresh: 'refresh-1' })
    if (path === '/accounts/me/') return reply(route, 200, admin)
    if (path === '/dawah/automations/' && request.method() === 'GET') return reply(route, 200, { count: rule ? 1 : 0, next: null, previous: null, results: rule ? [rule] : [] })
    if (path === '/dawah/automations/' && request.method() === 'POST') {
      const unknown = Object.keys(body).filter((k) => !['kind', 'audience', 'timezone', 'weekday', 'local_time', 'template', 'enabled', 'categories'].includes(k))
      if (unknown.length || body.enabled !== false) return reject(route, 400, 'VALIDATION_ERROR', 'Rejected.', { unknown: unknown })
      rule = {
        id: 3, kind: body.kind, enabled: false, audience: body.audience, categories: body.categories ?? [], timezone: body.timezone, weekday: body.weekday,
        local_time: body.local_time, template: { ...body.template, body_html: `<p>${body.template.body}</p>` }, owner_id: 2, owner_active: true, blocked_reason: null,
        version: 1, created_at: '2026-11-10T09:00:00Z', updated_at: '2026-11-10T09:00:00Z',
      }
      return reply(route, 201, rule, 'Saved.')
    }
    if (path === '/dawah/automations/3/') return reply(route, 200, rule)
    if (path === '/dawah/automations/3/preview/') {
      return reply(route, 200, {
        subject: rule.template.subject, rendered_html: HOSTILE, rendered_text: 'Server preview', audience_count: 42,
        source: { window_start: '2026-11-02T07:00:00Z', window_end: '2026-11-09T07:00:00Z', events: [{ id: 5, title: 'Friday khutbah', category: 'jumuah', start_time: '2026-11-06T12:00:00Z' }] },
      })
    }
    if (path === '/dawah/automations/3/enable/') {
      rule = { ...rule, enabled: true, version: rule.version + 1 }
      runs.push(
        { id: 2, occurrence_key: 'rule-3:2026-11-09T07:00:00Z', scheduled_at: '2026-11-09T07:00:00Z', state: 'skipped', reason_code: 'no_eligible_summaries', broadcast_id: null },
        { id: 1, occurrence_key: 'rule-3:2026-11-02T07:00:00Z', scheduled_at: '2026-11-02T07:00:00Z', state: 'completed', reason_code: null, broadcast_id: 7, recipient_count: 3, counts: { ...zero, sent: 3 } },
      )
      return reply(route, 200, rule, 'Enabled.')
    }
    if (path === '/dawah/automations/3/runs/') return reply(route, 200, { count: runs.length, next: null, previous: null, results: runs })
    return reject(route, 404, 'NOT_FOUND', 'Not found.')
  })
  return { calls, count: (method, path) => calls.filter((c) => c.method === method && c.path === path).length }
}

test('admin creates a disabled weekly rule, previews safely, enables explicitly and reads honest run history', async ({ page }) => {
  await page.route('https://fonts.googleapis.com/**', (route) => route.fulfill({ contentType: 'text/css', body: '' }))
  await page.addInitScript(() => sessionStorage.setItem('pythagoras.refreshToken', 'refresh-0'))
  const api = await mockApi(page)

  await page.goto('/admin/communication')
  await page.getByRole('link', { name: 'Automations' }).click()
  await expect(page).toHaveURL('/admin/communication/automations')
  await expect(page.getByText(/No automation rules yet/)).toBeVisible()
  await page.getByRole('link', { name: 'New rule' }).click()

  await expect(page.getByTestId('timezone-note')).toContainText('Africa/Lagos')
  await expect(page.getByLabel('Day of the week')).toHaveValue('0')
  await page.getByLabel('Subject').fill('Weekly Da’wah summary')
  await page.getByLabel('Message template (plain text)').fill('This week: {{summaries}}')
  await page.getByRole('button', { name: 'Save as disabled rule' }).click()

  await expect(page).toHaveURL('/admin/communication/automations/3')
  await expect(page.getByText(/starts disabled: nothing is scheduled and no email will be sent/)).toBeVisible()
  expect(api.calls.find((c) => c.method === 'POST' && c.path === '/dawah/automations/').body).toEqual({
    kind: 'weekly_digest', audience: { type: 'all' }, timezone: 'Africa/Lagos', weekday: 0, local_time: '08:00',
    template: { subject: 'Weekly Da’wah summary', body_format: 'plain', body: 'This week: {{summaries}}' }, enabled: false,
  })
  await expect(page.getByText(/No runs yet/)).toBeVisible()

  await page.getByRole('button', { name: 'Preview (no email sent)' }).click()
  await expect(page.getByTestId('preview-body')).toHaveText('Server preview')
  await expect(page.getByText(/About 42 recipients/)).toBeVisible()
  await expect(page.getByTestId('preview-source')).toContainText('Friday khutbah')
  expect(await page.evaluate(() => window.__pwned)).toBeUndefined()
  await expect(page.getByTestId('preview-frame')).toHaveAttribute('sandbox', '')

  expect(api.count('POST', '/dawah/automations/3/enable/')).toBe(0)
  await page.getByRole('button', { name: 'Enable…' }).click()
  const dialog = page.getByRole('dialog', { name: 'Enable this rule?' })
  await expect(dialog.getByText(/not proof that anything has been or will be sent/)).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  expect(api.count('POST', '/dawah/automations/3/enable/')).toBe(0)
  await page.getByRole('button', { name: 'Enable…' }).click()
  await dialog.getByRole('button', { name: 'Enable rule' }).click()

  await expect(page.getByText(/check run history to confirm that it does/)).toBeVisible()
  const rows = page.getByTestId('run-row')
  await expect(rows).toHaveCount(2)
  await expect(rows.nth(0)).toContainText('Skipped (nothing sent)')
  await expect(rows.nth(0)).toContainText('Reason code: no_eligible_summaries')
  await expect(rows.nth(0)).toContainText('9 Nov 2026, 08:00 (Lagos)')
  await expect(rows.nth(1)).toContainText('Completed')
  await expect(rows.nth(1).getByRole('link', { name: 'Broadcast #7' })).toHaveAttribute('href', '/admin/communication/history/7')
  await expect(page.getByText(/delivered/i)).toHaveCount(0)

  // No horizontal page scroll at either viewport (the run table scrolls inside its own container).
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})
