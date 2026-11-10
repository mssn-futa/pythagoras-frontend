import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http } from 'msw'
import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'
import { admin, ok, recorder, resetSession, sessionHandlers, storeRefreshToken, url, useApiOrigin } from '../fixtures/auth.js'
import { B, createBackend, wireBroadcast } from '../fixtures/communication.js'
import { TestApp } from '../fixtures/TestApp.jsx'
import { server } from '../mocks/server.js'

// jsdom gaps that ProseMirror touches when scrolling the selection or handling paste.
beforeAll(() => {
  const empty = () => []
  Range.prototype.getClientRects ??= empty
  Range.prototype.getBoundingClientRect ??= () => ({ top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0 })
  Text.prototype.getClientRects ??= empty
})
beforeEach(() => {
  vi.stubGlobal('ClipboardEvent', class ClipboardEvent extends Event {})
  useApiOrigin()
})
afterEach(resetSession)

function open(backend, path = '/admin/communication') {
  server.use(...sessionHandlers(recorder(), admin), ...backend.handlers)
  storeRefreshToken()
  return render(<TestApp path={path} />)
}
const location = () => screen.getByTestId('location').textContent
const richBox = () => screen.findByRole('textbox', { name: 'Message (rich text)' }, { timeout: 8000 })
const editorOf = (box) => box.editor // TipTap exposes the instance on the contenteditable element

async function chooseRich(actor) {
  await actor.click(await screen.findByRole('radio', { name: 'Rich text' }))
  return richBox()
}
/** Replace the editor content the way a user edit would (fires the editor's update event). */
const setHtml = (box, html) => act(() => { editorOf(box).commands.setContent(html, { emitUpdate: true }) })

describe('mode switching', { timeout: 20_000 }, () => {
  test('plain text converts to escaped paragraphs in the editor and nothing is saved', async () => {
    const backend = createBackend()
    open(backend)
    const actor = userEvent.setup()
    await actor.type(await screen.findByLabelText('Message (plain text)'), 'Line <b>one</b>')
    const box = await chooseRich(actor)
    expect(box).toHaveTextContent('Line <b>one</b>')
    expect(box.querySelector('b')).toBeNull()
    expect(screen.queryByLabelText('Message (plain text)')).toBeNull()
    expect(backend.calls.filter((c) => c.method !== 'GET')).toEqual([])
  })

  test('back to plain keeps unformatted text silently, but warns before dropping formatting', async () => {
    open(createBackend())
    const actor = userEvent.setup()
    const box = await chooseRich(actor)
    await setHtml(box, '<p>Plain only</p>')
    await actor.click(screen.getByRole('radio', { name: 'Plain text' }))
    expect(await screen.findByLabelText('Message (plain text)')).toHaveValue('Plain only')

    const again = await chooseRich(actor)
    await setHtml(again, '<p>Hello <strong>bold</strong></p><ul><li>one</li></ul>')
    await actor.click(screen.getByRole('radio', { name: 'Plain text' }))
    expect(await screen.findByText('Switch to plain text?')).toBeVisible()
    await actor.click(screen.getByRole('button', { name: 'Keep rich text' }))
    expect(screen.queryByText('Switch to plain text?')).toBeNull()
    expect(screen.getByRole('radio', { name: 'Rich text' })).toBeChecked()

    await actor.click(screen.getByRole('radio', { name: 'Plain text' }))
    await actor.click(screen.getByRole('button', { name: 'Remove formatting' }))
    expect(await screen.findByLabelText('Message (plain text)')).toHaveValue('Hello bold\n\none')
  })

  test('plain drafts are unchanged: plain editor, same payload, no body_format', async () => {
    const backend = createBackend({ broadcasts: [wireBroadcast({ id: 7 })] })
    open(backend, '/admin/communication/drafts/7')
    const actor = userEvent.setup()
    expect(screen.queryByRole('textbox', { name: 'Message (rich text)' })).toBeNull()
    expect(await screen.findByRole('radio', { name: 'Plain text' })).toBeChecked()
    await actor.type(await screen.findByLabelText('Message (plain text)'), '!')
    await actor.click(screen.getByRole('button', { name: 'Save changes' }))
    await waitFor(() => expect(backend.only('PATCH')).toHaveLength(1))
    expect(backend.only('PATCH')[0].body).toEqual({ subject: 'Weekly Da’wah summary', body: 'Summary and recording link!', audience: { type: 'all' }, version: 1 })
  })

  test('converting a saved plain draft to rich only saves when asked, and then sends rich fields', async () => {
    const backend = createBackend({ broadcasts: [wireBroadcast({ id: 7 })] })
    open(backend, '/admin/communication/drafts/7')
    const actor = userEvent.setup()
    await chooseRich(actor)
    expect(backend.only('PATCH')).toEqual([])
    await actor.click(screen.getByRole('button', { name: 'Save changes' }))
    await waitFor(() => expect(backend.only('PATCH')).toHaveLength(1))
    expect(backend.only('PATCH')[0].body).toEqual({
      subject: 'Weekly Da’wah summary', body_format: 'rich', body_html: '<p>Summary and recording link</p>', audience: { type: 'all' }, version: 1,
    })
  })
})

describe('rich save and canonical reload', { timeout: 20_000 }, () => {
  test('a new rich draft posts body_format rich + body_html (no client body) and reopens the server canonical HTML', async () => {
    const backend = createBackend()
    open(backend)
    const actor = userEvent.setup()
    await actor.type(await screen.findByLabelText('Subject'), 'Weekly summary')
    const box = await chooseRich(actor)
    // <b>/<i> are not what the editor emits, so the editor schema itself normalises them to strong/em.
    await setHtml(box, '<p><b>Key lessons</b></p><ul><li>Read the <a href="https://example.test/dawah/content/8">recording</a>.</li></ul>')
    await actor.click(screen.getByRole('button', { name: 'Save draft' }))

    await waitFor(() => expect(location()).toBe('/admin/communication/drafts/1'))
    expect(backend.only('POST', '/dawah/broadcasts/')[0].body).toEqual({
      subject: 'Weekly summary',
      body_format: 'rich',
      body_html: '<p><strong>Key lessons</strong></p><ul><li><p>Read the <a href="https://example.test/dawah/content/8">recording</a>.</p></li></ul>',
      audience: { type: 'all' },
    })
    const reopened = await richBox()
    expect(within(reopened).getByText('Key lessons').tagName).toBe('STRONG')
    expect(within(reopened).getByRole('link', { name: 'recording' })).toHaveAttribute('href', 'https://example.test/dawah/content/8')
    expect(screen.getByRole('radio', { name: 'Rich text' })).toBeChecked()
  })

  test('after saving, the editor shows the server canonical body_html, not the client HTML', async () => {
    const backend = createBackend({ broadcasts: [wireBroadcast({ id: 7, body_format: 'rich', body: 'Hello', body_html: '<p>Hello</p>' })] })
    open(backend, '/admin/communication/drafts/7')
    server.use(
      http.patch(url(`${B}7/`), async ({ request }) => {
        const sent = await request.json()
        backend.calls.push({ method: 'PATCH', path: `${B}7/`, query: {}, body: sent })
        return ok(wireBroadcast({ id: 7, version: 2, body_format: 'rich', body: 'Hello CANON', body_html: '<p>Hello <em>CANON</em></p>' }))
      }),
    )
    const actor = userEvent.setup()
    const box = await richBox()
    expect(box).toHaveTextContent('Hello')
    await setHtml(box, '<p>Hello client</p>')
    await actor.click(screen.getByRole('button', { name: 'Save changes' }))
    expect(await screen.findByText('Draft saved.')).toBeVisible()
    const fresh = await richBox()
    await waitFor(() => expect(fresh).toHaveTextContent('Hello CANON'))
    expect(fresh).not.toHaveTextContent('client')
    expect(within(fresh).getByText('CANON').tagName).toBe('EM')
    // Server version is the baseline: not dirty until edited again.
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled()
  })

  test('opening a rich draft shows the editor, not the old read-only notice, and edits PATCH rich fields', async () => {
    const backend = createBackend({ broadcasts: [wireBroadcast({ id: 9, body_format: 'rich', body: 'Key lessons', body_html: '<p><strong>Key lessons</strong></p>', subject: 'Rich' })] })
    open(backend, '/admin/communication/drafts/9')
    const actor = userEvent.setup()
    const box = await richBox()
    expect(screen.queryByText(/cannot be edited or saved from this plain-text form/)).toBeNull()
    expect(screen.queryByTestId('rich-readonly-body')).toBeNull()
    expect(within(box).getByText('Key lessons').tagName).toBe('STRONG')
    expect(screen.getByRole('radio', { name: 'Rich text' })).toBeChecked()
    await actor.type(screen.getByLabelText('Subject'), '!')
    await actor.click(screen.getByRole('button', { name: 'Save changes' }))
    await waitFor(() => expect(backend.only('PATCH')).toHaveLength(1))
    expect(backend.only('PATCH')[0].body).toEqual({
      subject: 'Rich!', body_format: 'rich', body_html: '<p><strong>Key lessons</strong></p>', audience: { type: 'all' }, version: 1,
    })
  })

  test('empty rich content is rejected before any request and the error is linked to the editor', async () => {
    const backend = createBackend()
    open(backend)
    const actor = userEvent.setup()
    await actor.type(await screen.findByLabelText('Subject'), 'S')
    const box = await chooseRich(actor)
    await actor.click(screen.getByRole('button', { name: 'Save draft' }))
    expect(screen.getByText('Enter the message text.')).toBeVisible()
    expect(box).toHaveAttribute('aria-invalid', 'true')
    expect(document.getElementById(box.getAttribute('aria-describedby'))).toHaveTextContent('Enter the message text.')
    expect(backend.only('POST')).toEqual([])
  })

  test('version conflict on a rich draft offers reload and never overwrites', async () => {
    const backend = createBackend({ broadcasts: [wireBroadcast({ id: 7, version: 1, body_format: 'rich', body: 'Hi', body_html: '<p>Hi</p>' })] })
    open(backend, '/admin/communication/drafts/7')
    const actor = userEvent.setup()
    const box = await richBox()
    await setHtml(box, '<p>My edit</p>')
    Object.assign(backend.store.get(7), { version: 2, body: 'Theirs', body_html: '<p>Theirs</p>' })
    await actor.click(screen.getByRole('button', { name: 'Save changes' }))
    expect(await screen.findByText('This draft was changed somewhere else.')).toBeVisible()
    expect(backend.store.get(7).body_html).toBe('<p>Theirs</p>')
    expect(box).toHaveTextContent('My edit') // unsaved text stays until reload
    await actor.click(screen.getByRole('button', { name: 'Reload latest version' }))
    const fresh = await richBox()
    await waitFor(() => expect(fresh).toHaveTextContent('Theirs'))
    expect(screen.queryByText('This draft was changed somewhere else.')).toBeNull()
  })
})

describe('paste and links', { timeout: 20_000 }, () => {
  async function pasteInto(html) {
    open(createBackend())
    const actor = userEvent.setup()
    const box = await chooseRich(actor)
    act(() => { editorOf(box).view.pasteHTML(html) })
    return box
  }

  test('pasted HTML is reduced to the allowlist: no scripts, images, styles, tables, handlers or javascript links', async () => {
    const box = await pasteInto(
      '<h1 style="color:red">Title</h1><p onclick="alert(1)" class="x">Hi <u>under</u> <s>strike</s> <code>code</code> <span style="font-size:99px">span</span></p>' +
        '<script>alert(1)</script><img src="https://evil.test/p.png" onerror="alert(2)"><table><tr><td>cell</td></tr></table>' +
        '<iframe src="https://evil.test"></iframe><form><input name="x"></form>' +
        '<p><a href="javascript:alert(3)">js link</a> <a href="data:text/html,x">data link</a> <a href="https://ok.test/a" onclick="x()" target="_blank">ok link</a></p>' +
        '<h3>Sub</h3><blockquote>Quote</blockquote><ol><li>One</li></ol>',
    )
    const html = editorOf(box).getHTML()
    expect(html).not.toMatch(/<(script|img|iframe|form|input|table|td|span|u|s|code|h1)\b/i)
    expect(html).not.toMatch(/style=|class=|onclick|onerror|javascript:|data:|evil\.test|target=/i)
    expect(box.querySelector('script, img, iframe, form, table, [style], [onclick]')).toBeNull()
    const links = [...box.querySelectorAll('a')]
    expect(links.map((a) => a.getAttribute('href'))).toEqual(['https://ok.test/a'])
    // Allowlisted structure and the text of dropped constructs survive.
    expect(html).toContain('<h3>Sub</h3>')
    expect(html).toContain('<blockquote>')
    expect(html).toContain('<ol>')
    expect(box).toHaveTextContent('js link')
    expect(box).toHaveTextContent('cell')
  })

  test('bold and italic survive paste, including b/i spellings', async () => {
    const box = await pasteInto('<p><b>bold</b> <i>ital</i> <strong>strong</strong> <em>em</em></p>')
    expect(editorOf(box).getHTML()).toBe('<p><strong>bold</strong> <em>ital</em> <strong>strong</strong> <em>em</em></p>')
  })

  async function startLink() {
    open(createBackend())
    const actor = userEvent.setup()
    const box = await chooseRich(actor)
    await setHtml(box, '<p>See the recording now</p>')
    act(() => { editorOf(box).chain().focus().setTextSelection({ from: 9, to: 18 }).run() })
    await actor.click(screen.getByRole('button', { name: 'Link' }))
    return { actor, box, input: await screen.findByLabelText(/Link address/) }
  }

  test.each([
    ['javascript:alert(1)', 'Only http:// and https:// links are allowed.'],
    ['data:text/html,<b>x</b>', 'Only http:// and https:// links are allowed.'],
    ['mailto:a@example.test', 'Only http:// and https:// links are allowed.'],
    ['example.com/page', 'Enter a full address starting with http:// or https://'],
    ['https://bad host.test', 'A link address cannot contain spaces.'],
    ['https://', 'Enter a valid address, for example https://example.com/page'],
    ['', 'Enter a link address.'],
  ])('link dialog rejects %j', async (value, message) => {
    const { actor, box, input } = await startLink()
    if (value) await actor.type(input, value)
    await actor.click(screen.getByRole('button', { name: 'Apply link' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(message)
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(box.querySelector('a')).toBeNull()
  })

  test('link dialog applies an https link, can edit it and remove it', async () => {
    const { actor, box, input } = await startLink()
    await actor.type(input, 'https://example.test/dawah/content/8')
    await actor.click(screen.getByRole('button', { name: 'Apply link' }))
    expect(screen.queryByLabelText(/Link address/)).toBeNull()
    expect(editorOf(box).getHTML()).toBe('<p>See the <a href="https://example.test/dawah/content/8">recording</a> now</p>')

    await actor.click(screen.getByRole('button', { name: 'Link' }))
    expect(await screen.findByLabelText(/Link address/)).toHaveValue('https://example.test/dawah/content/8')
    await actor.click(screen.getByRole('button', { name: 'Remove link' }))
    expect(editorOf(box).getHTML()).toBe('<p>See the recording now</p>')
  })

  test('applying a link with nothing selected explains what to do', async () => {
    open(createBackend())
    const actor = userEvent.setup()
    const box = await chooseRich(actor)
    await setHtml(box, '<p>Text</p>')
    act(() => { editorOf(box).chain().focus().setTextSelection(3).run() })
    await actor.click(screen.getByRole('button', { name: 'Link' }))
    await actor.type(await screen.findByLabelText(/Link address/), 'https://example.test/')
    await actor.click(screen.getByRole('button', { name: 'Apply link' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Select the text you want to turn into a link first.')
  })

  test('toolbar is a labelled toolbar with pressed state and arrow-key navigation', async () => {
    open(createBackend())
    const actor = userEvent.setup()
    await chooseRich(actor)
    const toolbar = screen.getByRole('toolbar', { name: 'Formatting' })
    const bold = within(toolbar).getByRole('button', { name: 'Bold' })
    expect(bold).toHaveAttribute('aria-pressed', 'false')
    bold.focus()
    await actor.keyboard('{ArrowRight}')
    expect(within(toolbar).getByRole('button', { name: 'Italic' })).toHaveFocus()
    await actor.keyboard('{End}')
    expect(within(toolbar).getByRole('button', { name: 'Redo' }).disabled).toBe(true) // disabled buttons are skipped
    await actor.keyboard('{Home}')
    expect(bold).toHaveFocus()
    await actor.click(bold)
    expect(bold).toHaveAttribute('aria-pressed', 'true')
  })
})

describe('preview sandbox', { timeout: 20_000 }, () => {
  const hostileHtml = '<p id="evil-node" onclick="window.__pwned=1">Hi</p><script>window.__pwned = true</script><img src=x onerror="window.__pwned=2"><iframe src="https://evil.test"></iframe><form action="https://evil.test"><input name=x></form><meta http-equiv="refresh" content="0;url=https://evil.test">'

  async function previewOf(row) {
    const backend = createBackend({ broadcasts: [row] })
    open(backend, `/admin/communication/drafts/${row.id}`)
    const actor = userEvent.setup()
    await actor.click(await screen.findByRole('button', { name: 'Preview' }))
    return { backend, frame: await screen.findByTestId('preview-frame') }
  }

  test('renders rendered_html only in an iframe with an empty sandbox and a script-blocking CSP', async () => {
    const { frame } = await previewOf(wireBroadcast({ id: 7, body_format: 'rich', body: 'Hi', body_html: '<p>Hi</p>' }))
    expect(frame.tagName).toBe('IFRAME')
    expect(frame.getAttribute('sandbox')).toBe('')
    for (const token of ['allow-scripts', 'allow-forms', 'allow-same-origin', 'allow-popups', 'allow-top-navigation']) expect(frame.getAttribute('sandbox')).not.toContain(token)
    expect(frame).toHaveAttribute('title', 'Email preview (sandboxed)')
    expect(frame).toHaveAttribute('referrerpolicy', 'no-referrer')
    expect(frame.getAttribute('src')).toBeNull()
    const doc = frame.getAttribute('srcdoc')
    expect(doc).toMatch(/<meta http-equiv="Content-Security-Policy" content="[^"]*script-src 'none'/)
    expect(doc).toContain("default-src 'none'")
    expect(doc).toContain('form-action \'none\'')
    expect(doc).toContain('<body><p>Hi</p></body>')
  })

  test('hostile server HTML is never injected into the main document', async () => {
    window.__pwned = undefined
    const { frame } = await previewOf(wireBroadcast({ id: 7, body_format: 'rich', body: 'Hi', body_html: '<p>Hi</p>' }))
    server.use(
      http.post(url(`${B}7/preview/`), () => ok({ subject: 'S', body: 'Hi', body_format: 'rich', body_html: '<p>Hi</p>', rendered_text: 'Hi', rendered_html: hostileHtml, audience_count: 3 })),
    )
    const actor = userEvent.setup()
    await actor.click(screen.getByRole('button', { name: 'Preview' }))
    await waitFor(() => expect(screen.getByTestId('preview-frame').getAttribute('srcdoc')).toContain('evil-node'))
    expect(frame.isConnected || screen.getByTestId('preview-frame')).toBeTruthy()
    const live = screen.getByTestId('preview-frame')
    expect(live.getAttribute('sandbox')).toBe('')
    // Not one hostile node, attribute or script exists in the application document.
    expect(document.getElementById('evil-node')).toBeNull()
    expect(document.querySelector('[onclick], [onerror], form[action], input[name=x], img[src=x]')).toBeNull()
    expect(document.querySelectorAll('iframe')).toHaveLength(1)
    expect([...document.querySelectorAll('script')].some((s) => s.textContent.includes('__pwned'))).toBe(false)
    expect(document.querySelector('meta[http-equiv=refresh]')).toBeNull()
    expect(window.__pwned).toBeUndefined()
  })

  test('the plain-text fallback is shown beside the frame, and plain-draft HTML is escaped by the server', async () => {
    const { frame } = await previewOf(wireBroadcast({ id: 7, body: '<b>not bold</b>' }))
    expect(screen.getByTestId('preview-body').textContent).toBe('<b>not bold</b>')
    expect(screen.getByText('Plain-text version (fallback)')).toBeVisible()
    expect(frame.getAttribute('srcdoc')).toContain('&lt;b&gt;not bold&lt;/b&gt;')
    expect(screen.getByTestId('preview-body').closest('section').querySelector('b')).toBeNull()
  })

  test('with no rendered_html only the text fallback is shown (no empty frame)', async () => {
    const backend = createBackend({ broadcasts: [wireBroadcast({ id: 7 })] })
    open(backend, '/admin/communication/drafts/7')
    server.use(http.post(url(`${B}7/preview/`), () => ok({ subject: 'S', body: 'Fallback only', rendered_text: 'Fallback only', audience_count: 1 })))
    const actor = userEvent.setup()
    await actor.click(await screen.findByRole('button', { name: 'Preview' }))
    expect(await screen.findByTestId('preview-body')).toHaveTextContent('Fallback only')
    expect(screen.queryByTestId('preview-frame')).toBeNull()
  })

  test('queue confirmation is unchanged for a rich draft and posts only the version', async () => {
    const backend = createBackend({ broadcasts: [wireBroadcast({ id: 7, version: 4, body_format: 'rich', body: 'Hi', body_html: '<p>Hi</p>' })] })
    open(backend, '/admin/communication/drafts/7')
    const actor = userEvent.setup()
    await actor.click(await screen.findByRole('button', { name: 'Queue for sending…' }))
    const dialog = await screen.findByRole('dialog', { name: 'Queue this broadcast?' })
    expect(within(dialog).getByText(/cannot be changed/)).toBeVisible()
    await actor.click(within(dialog).getByRole('button', { name: 'Queue broadcast' }))
    await waitFor(() => expect(location()).toBe('/admin/communication/history/7'))
    expect(backend.only('POST', '/queue/')[0].body).toEqual({ version: 4 })
  })
})
