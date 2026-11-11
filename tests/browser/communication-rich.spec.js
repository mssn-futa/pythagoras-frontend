import { test, expect } from './test.js'

// Synthetic, test-only API shaped like D4's rich draft example. The mock plays the COMM-04 server:
// it stores the client's rich HTML as the canonical version and renders a preview that is deliberately hostile.
const API = 'https://api.pythagoras.test'
const admin = {
  id: 2, email: 'admin@example.test', first_name: 'Bilal', last_name: 'Okafor', matric_number: null,
  department: 'Computer Science', level: '300', role: 'admin', is_active: true,
}
const HOSTILE_RENDERED = '<p>Server preview</p><script>window.__pwned = true</script><img src="https://evil.test/track.png" onerror="window.__pwned = 2"><form action="https://evil.test"><input name="x"></form>'

const corsFor = (route) => ({
  'Access-Control-Allow-Origin': route.request().headers().origin ?? '',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type, Accept',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
})

async function mockApi(page) {
  const calls = []
  let broadcast = null
  const reply = (route, status, data, message = 'OK.') =>
    route.fulfill({ status, headers: corsFor(route), contentType: 'application/json', body: JSON.stringify({ success: true, data, message }) })

  await page.route(`${API}/**`, async (route) => {
    const request = route.request()
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: corsFor(route) })
    const path = new URL(request.url()).pathname
    const body = request.postDataJSON?.() ?? null
    calls.push({ method: request.method(), path, body })

    if (path === '/accounts/refresh/') return reply(route, 200, { access: 'access-1', refresh: 'refresh-1' })
    if (path === '/accounts/me/') return reply(route, 200, admin)
    if (path === '/dawah/broadcasts/' && request.method() === 'POST') {
      broadcast = {
        id: 7, state: 'draft', version: 1, created_at: '2026-11-10T09:00:00Z', updated_at: '2026-11-10T09:00:00Z', queued_at: null,
        recipient_count: 0, counts: { queued: 0, sent: 0, failed: 0, uncertain: 0, skipped: 0 }, eligible_actions: ['edit', 'delete', 'preview', 'queue'],
        subject: body.subject, body_format: body.body_format, body_html: body.body_html, body: 'Key lessons\n\nRead the recording.', audience: body.audience,
      }
      return reply(route, 201, broadcast, 'Saved.')
    }
    if (path === '/dawah/broadcasts/7/') return reply(route, 200, broadcast)
    if (path === '/dawah/broadcasts/7/preview/') {
      return reply(route, 200, {
        subject: broadcast.subject, body: broadcast.body, body_format: 'rich', body_html: broadcast.body_html,
        rendered_text: 'Key lessons\n\nRead the recording.', rendered_html: HOSTILE_RENDERED, audience_count: 42,
      })
    }
    return route.fulfill({ status: 404, headers: corsFor(route), contentType: 'application/json', body: JSON.stringify({ success: false, data: { code: 'NOT_FOUND' }, message: 'Not found.' }) })
  })
  return { calls }
}

test('admin writes rich text, pastes hostile HTML, validates a link, reloads canonical HTML and previews in a sandbox', async ({ page }) => {
  await page.route('https://fonts.googleapis.com/**', (route) => route.fulfill({ contentType: 'text/css', body: '' }))
  await page.addInitScript(() => sessionStorage.setItem('pythagoras.refreshToken', 'refresh-0'))
  const api = await mockApi(page)

  await page.goto('/admin/communication')
  await page.getByLabel('Subject').fill('Weekly summary')
  await page.getByRole('radio', { name: 'Rich text' }).check()
  const editor = page.getByRole('textbox', { name: 'Message (rich text)' })
  await expect(editor).toBeVisible()

  // Typing with bold from the toolbar and a keyboard-driven list.
  await editor.click()
  await page.getByRole('button', { name: 'Bold' }).click()
  await page.keyboard.type('Key lessons')
  await page.getByRole('button', { name: 'Bold' }).click()
  await page.keyboard.press('Enter')
  await page.keyboard.type('Read the recording')
  await page.keyboard.press('Shift+Home')

  // Link dialog: unsafe schemes are refused, https is accepted.
  await page.getByRole('button', { name: 'Link' }).click()
  const address = page.getByLabel(/Link address/)
  await address.fill('javascript:alert(1)')
  await page.getByRole('button', { name: 'Apply link' }).click()
  await expect(page.getByRole('alert').filter({ hasText: 'Only http:// and https:// links are allowed.' })).toBeVisible()
  await address.fill('https://example.test/dawah/content/8')
  await page.getByRole('button', { name: 'Apply link' }).click()
  await expect(editor.getByRole('link', { name: 'Read the recording' })).toHaveAttribute('href', 'https://example.test/dawah/content/8')

  // Wait until the link panel has closed (it refocuses the editor) and the mark exists, then collapse the
  // selection to the end of the document explicitly so the paste can never replace the selected link text.
  await expect(page.getByLabel(/Link address/)).toHaveCount(0)
  await expect(editor.locator('a')).toHaveCount(1)
  await page.evaluate(() => document.querySelector('.ProseMirror').editor.chain().focus('end').run())
  await expect.poll(() => page.evaluate(() => {
    const { selection, doc } = document.querySelector('.ProseMirror').editor.state
    return selection.empty && selection.from === doc.content.size - 1
  })).toBe(true)

  // Hostile paste is reduced to the allowlist.
  await page.evaluate(() => {
    const dt = new DataTransfer()
    dt.setData('text/html', '<p onclick="window.__pwned=1">Pasted <u style="color:red">text</u></p><script>window.__pwned=2</script><img src="https://evil.test/p.png"><a href="javascript:alert(1)">bad link</a>')
    dt.setData('text/plain', 'Pasted text bad link')
    document.querySelector('.ProseMirror').dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }))
  })
  await expect(editor).toContainText('Pasted text')
  expect(await editor.locator('script, img, u, [style], [onclick]').count()).toBe(0)
  await expect(editor.locator('a')).toHaveCount(1)
  await expect(editor.getByRole('link', { name: 'Read the recording' })).toBeVisible()
  expect(await page.evaluate(() => window.__pwned)).toBeUndefined()

  await page.getByRole('button', { name: 'Save draft' }).click()
  await expect(page).toHaveURL('/admin/communication/drafts/7')
  await expect(page.getByText('Draft saved.')).toBeVisible()
  const saved = api.calls.find((c) => c.method === 'POST' && c.path === '/dawah/broadcasts/')
  expect(saved.body.body_format).toBe('rich')
  expect(saved.body).not.toHaveProperty('body')
  expect(saved.body.body_html).toContain('<strong>Key lessons</strong>')
  expect(saved.body.body_html).toContain('<a href="https://example.test/dawah/content/8">Read the recording</a>')
  expect(saved.body.body_html).not.toMatch(/script|<img|<u>|style=|onclick|javascript:/)

  // Reload: the persisted (server canonical) draft is reopened in the rich editor with formatting intact.
  await page.reload()
  const reopened = page.getByRole('textbox', { name: 'Message (rich text)' })
  await expect(reopened.locator('strong')).toHaveText('Key lessons')
  await expect(reopened.getByRole('link', { name: 'Read the recording' })).toBeVisible()

  // Preview: server HTML only inside a sandboxed iframe; hostile markup never reaches the app document.
  await page.getByRole('button', { name: 'Preview' }).click()
  const frame = page.getByTestId('preview-frame')
  await expect(frame).toBeVisible()
  expect(await frame.getAttribute('sandbox')).toBe('')
  expect(await frame.getAttribute('srcdoc')).toContain("script-src 'none'")
  await expect(page.getByTestId('preview-body')).toContainText('Read the recording')
  await expect(page.getByText('Plain-text version (fallback)')).toBeVisible()
  expect(await page.locator('main form[action], main input[name=x], main img[src*="evil.test"], main iframe ~ script').count()).toBe(0)
  expect(await page.evaluate(() => window.__pwned)).toBeUndefined()
  await expect(page.frameLocator('[data-testid=preview-frame]').getByText('Server preview')).toBeVisible()

  // No horizontal page scroll at either viewport.
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})
