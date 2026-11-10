import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http } from 'msw'
import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'
import { admin, ok, recorder, resetSession, sessionHandlers, storeRefreshToken, url, useApiOrigin } from '../fixtures/auth.js'
import { B, createBackend, wireBroadcast } from '../fixtures/communication.js'
import EditorLoader from '../../src/features/communication/editor/EditorLoader.jsx'
import { docToPlainText, plainConversionCollapsesWhitespace, validateLinkUrl } from '../../src/features/communication/editor/richContent.js'
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
    expect(await screen.findByLabelText('Message (plain text)')).toHaveValue('Hello bold\n\n- one')
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
    ['https://bad host.test', 'A link address cannot contain spaces or hidden characters.'],
    ['https://exa\u200Bmple.test/', 'A link address cannot contain spaces or hidden characters.'],
    ['https://example.test/\u202Eevil', 'A link address cannot contain spaces or hidden characters.'],
    ['https://example.test/\u00A0x', 'A link address cannot contain spaces or hidden characters.'],
    ['https:///path', 'Enter a valid address, for example https://example.com/page'],
    ['https://user:pw@example.test/', 'Enter a valid address, for example https://example.com/page'],
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
    expect(doc).toContain("img-src 'none'")
    expect(doc).toContain("base-uri 'none'")
    expect(doc).toContain("form-action 'none'")
    expect(doc).toContain('<meta name="referrer" content="no-referrer">')
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

describe('hardening (review fixes)', { timeout: 20_000 }, () => {
  async function editorWith(html) {
    open(createBackend())
    const actor = userEvent.setup()
    const box = await chooseRich(actor)
    await setHtml(box, html)
    return { actor, box }
  }

  test('M1: ordered lists never emit start/type, from paste, content or the "3. " input rule', async () => {
    open(createBackend())
    const actor = userEvent.setup()
    const box = await chooseRich(actor)
    act(() => { editorOf(box).view.pasteHTML('<ol start="5" type="a" style="list-style:upper-roman"><li>one</li></ol>') })
    expect(editorOf(box).getHTML()).toBe('<ol><li><p>one</p></li></ol>')
    await setHtml(box, '<ol start="9" type="i"><li>x</li></ol>')
    expect(editorOf(box).getHTML()).not.toMatch(/start=|type=|style=/)
    await setHtml(box, '<p></p>')
    act(() => { editorOf(box).chain().focus().insertContent('3. ').run() })
    await actor.keyboard(' ')
    await setHtml(box, '<p>3. </p>')
    act(() => { editorOf(box).view.someProp('handleTextInput', (f) => f(editorOf(box).view, 4, 4, ' ')) })
    expect(editorOf(box).getHTML()).not.toMatch(/start=|type=/)
  })

  test('M2: pasting mailto:/ftp:/javascript: text over a selection never creates a link or an empty href', async () => {
    const { box } = await editorWith('<p>select me</p>')
    for (const pasted of ['mailto:a@example.test', 'ftp://example.test/file', 'javascript:alert(1)', 'https://ok.test/']) {
      act(() => { editorOf(box).chain().focus().setTextSelection({ from: 1, to: 7 }).run() })
      act(() => { editorOf(box).view.pasteHTML(`<p>${pasted}</p>`) })
      expect(editorOf(box).getHTML()).not.toMatch(/<a\b/)
      await setHtml(box, '<p>select me</p>')
    }
    // Server/pasted anchors with an unsafe or empty href lose the link but keep the text.
    await setHtml(box, '<p><a href="">e</a><a href="mailto:a@b.test">m</a><a>n</a><a href="  https://ok.test/a  ">ok</a></p>')
    expect(editorOf(box).getHTML()).toBe('<p>emn<a href="https://ok.test/a">ok</a></p>')
  })

  test('M3: the toolbar keeps one reachable tab stop when Undo/Redo are disabled', async () => {
    open(createBackend())
    const actor = userEvent.setup()
    await chooseRich(actor)
    const toolbar = screen.getByRole('toolbar', { name: 'Formatting' })
    const stops = () => within(toolbar).getAllByRole('button').filter((b) => b.tabIndex === 0)
    // Move the roving index onto Undo, then make it disabled again.
    const undo = within(toolbar).getByRole('button', { name: 'Undo' })
    expect(undo).toBeDisabled()
    const bold = within(toolbar).getByRole('button', { name: 'Bold' })
    bold.focus()
    await actor.keyboard('{End}') // last enabled button
    expect(stops()).toHaveLength(1)
    expect(stops()[0]).not.toBeDisabled()
    // Force the active index onto a disabled button via focus event, then it must fall back to an enabled one.
    act(() => undo.dispatchEvent(new FocusEvent('focusin', { bubbles: true })))
    act(() => { undo.focus() })
    expect(stops()).toHaveLength(1)
    expect(stops()[0]).not.toBeDisabled()
  })

  test('L1: editor and fields are locked while a save is in flight and the saved response is adopted', async () => {
    const backend = createBackend({ latency: 300, broadcasts: [wireBroadcast({ id: 7, body_format: 'rich', body: 'Hi', body_html: '<p>Hi</p>' })] })
    open(backend, '/admin/communication/drafts/7')
    const actor = userEvent.setup()
    const box = await richBox()
    await setHtml(box, '<p>Edited</p>')
    await actor.click(screen.getByRole('button', { name: 'Save changes' }))
    await waitFor(() => expect(box).toHaveAttribute('contenteditable', 'false'))
    expect(screen.getByLabelText('Subject')).toBeDisabled()
    await screen.findByText('Draft saved.')
    const fresh = await richBox()
    await waitFor(() => expect(fresh).toHaveAttribute('contenteditable', 'true'))
    expect(fresh).toHaveTextContent('Edited')
    expect(backend.only('PATCH')[0].body.body_html).toBe('<p>Edited</p>')
  })

  test('L1: the plain textarea is locked while saving', async () => {
    const backend = createBackend({ latency: 300, broadcasts: [wireBroadcast({ id: 7 })] })
    open(backend, '/admin/communication/drafts/7')
    const actor = userEvent.setup()
    const area = await screen.findByLabelText('Message (plain text)')
    await actor.type(area, '!')
    await actor.click(screen.getByRole('button', { name: 'Save changes' }))
    await waitFor(() => expect(area).toBeDisabled())
    await screen.findByText('Draft saved.')
  })

  test('L2: rich to plain flattens links as "text (href)" and prefixes list items', async () => {
    const { actor } = await editorWith('<h2>Title</h2><p>See <a href="https://ok.test/a">the <strong>recording</strong></a> now</p><ul><li>one</li><li>two</li></ul><ol><li>first</li><li>second</li></ol><blockquote><p>quoted</p></blockquote>')
    await actor.click(screen.getByRole('radio', { name: 'Plain text' }))
    await actor.click(await screen.findByRole('button', { name: 'Remove formatting' }))
    expect(await screen.findByLabelText('Message (plain text)')).toHaveValue(
      'Title\n\nSee the recording (https://ok.test/a) now\n\n- one\n- two\n\n1. first\n2. second\n\nquoted',
    )
  })

  test('L2: docToPlainText unit cases', () => {
    const link = (text, href) => ({ type: 'text', text, marks: [{ type: 'link', attrs: { href } }] })
    expect(docToPlainText({ type: 'doc', content: [{ type: 'paragraph', content: [link('https://x.test/', 'https://x.test/'), { type: 'hardBreak' }, { type: 'text', text: 'b' }] }, { type: 'paragraph' }] })).toBe('https://x.test/\nb')
    expect(docToPlainText(undefined)).toBe('')
  })

  test('L3: plain to rich warns when spacing would be collapsed, not otherwise', async () => {
    open(createBackend())
    const actor = userEvent.setup()
    await actor.type(await screen.findByLabelText('Message (plain text)'), 'a    b')
    await actor.click(screen.getByRole('radio', { name: 'Rich text' }))
    expect(await screen.findByText(/were collapsed in the editor/)).toBeVisible()
    await actor.click(screen.getByRole('radio', { name: 'Plain text' }))
    expect(screen.queryByText(/were collapsed in the editor/)).toBeNull()
    expect(screen.getByLabelText('Message (plain text)')).toHaveValue('a    b') // original spacing kept
    await actor.clear(screen.getByLabelText('Message (plain text)'))
    await actor.type(screen.getByLabelText('Message (plain text)'), 'a b')
    await actor.click(screen.getByRole('radio', { name: 'Rich text' }))
    await richBox()
    expect(screen.queryByText(/were collapsed in the editor/)).toBeNull()
    expect(plainConversionCollapsesWhitespace('x\n\n\ny')).toBe(true)
    expect(plainConversionCollapsesWhitespace('x\n\ny')).toBe(false)
  })

  test('L4: valid links are stored normalised; unit checks', () => {
    expect(validateLinkUrl('https://bücher.example/pa th').ok).toBe(false)
    expect(validateLinkUrl('https://bücher.example/x')).toEqual({ ok: true, href: 'https://xn--bcher-kva.example/x' })
    expect(validateLinkUrl('HTTPS://Example.test')).toEqual({ ok: true, href: 'https://example.test/' })
    expect(validateLinkUrl('https://a.test/\u2028x').ok).toBe(false)
  })

  test('L6: accessible names contain the visible text; plain-switch dialog takes focus and Keep returns it', async () => {
    const { actor } = await editorWith('<p><strong>x</strong></p><ul><li>y</li></ul>')
    const toolbar = screen.getByRole('toolbar', { name: 'Formatting' })
    for (const button of within(toolbar).getAllByRole('button')) {
      expect(button.getAttribute('aria-label') ?? button.textContent).toContain(button.textContent)
    }
    expect(within(toolbar).getByRole('button', { name: 'H2 heading' })).toHaveTextContent('H2')
    await actor.click(screen.getByRole('radio', { name: 'Plain text' }))
    expect(await screen.findByRole('alertdialog')).toHaveFocus()
    await actor.click(screen.getByRole('button', { name: 'Keep rich text' }))
    expect(screen.getByRole('radio', { name: 'Rich text' })).toHaveFocus()
  })

  test('L6: closing the link panel (Cancel or Escape) returns focus to the editor', async () => {
    const { actor, box } = await editorWith('<p>Some text</p>')
    await actor.click(screen.getByRole('button', { name: 'Link' }))
    await actor.click(await screen.findByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(box).toHaveFocus())
    await actor.click(screen.getByRole('button', { name: 'Link' }))
    await screen.findByLabelText(/Link address/)
    await actor.keyboard('{Escape}')
    await waitFor(() => expect(box).toHaveFocus())
    expect(screen.queryByLabelText(/Link address/)).toBeNull()
  })

  test('L7: a failed editor chunk shows a recovery UI and Try again loads it', async () => {
    let calls = 0
    const loader = () => {
      calls += 1
      return calls === 1 ? Promise.reject(new Error('chunk failed')) : import('../../src/features/communication/editor/RichEditor.jsx')
    }
    vi.spyOn(console, 'error').mockImplementation(() => {})
    render(<EditorLoader loader={loader} value="<p>Recovered</p>" id="e" labelledBy="l" />)
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('The rich-text editor could not be loaded.')
    expect(screen.getByRole('button', { name: 'Reload page' })).toBeVisible()
    await userEvent.setup().click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByRole('textbox', {}, { timeout: 8000 })).toHaveTextContent('Recovered')
    expect(calls).toBe(2)
  })
})
