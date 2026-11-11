import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { admin, fail, recorder, resetSession, sessionHandlers, storeRefreshToken, url, useApiOrigin } from '../fixtures/auth.js'
import { createBackend, wireBroadcast } from '../fixtures/communication.js'
import { TestApp } from '../fixtures/TestApp.jsx'
import { http } from 'msw'
import { server } from '../mocks/server.js'

beforeEach(useApiOrigin)
afterEach(resetSession)

function open(backend, path = '/admin/communication') {
  server.use(...sessionHandlers(recorder(), admin), ...backend.handlers)
  storeRefreshToken()
  return render(<TestApp path={path} />)
}
const location = () => screen.getByTestId('location').textContent

async function fillBasics(actor, { subject = 'Weekly summary', body = 'Hello everyone' } = {}) {
  await actor.type(await screen.findByLabelText('Subject'), subject)
  await actor.type(screen.getByLabelText('Message (plain text)'), body)
}

describe('creating a draft', { timeout: 20_000 }, () => {
  test('save posts the payload, then reopens the persisted draft with its id', async () => {
    const backend = createBackend()
    open(backend)
    const actor = userEvent.setup()
    await fillBasics(actor)
    await actor.click(screen.getByRole('radio', { name: 'One department' }))
    await actor.type(screen.getByLabelText('Department'), 'Computer Science')
    await actor.click(screen.getByRole('button', { name: 'Save draft' }))

    await waitFor(() => expect(location()).toBe('/admin/communication/drafts/1'))
    expect(backend.only('POST', '/dawah/broadcasts/')[0].body).toEqual({
      subject: 'Weekly summary', body: 'Hello everyone', audience: { type: 'department', department: 'Computer Science' },
    })
    expect(await screen.findByText('Draft saved.')).toBeVisible()
    expect(screen.getByRole('heading', { name: 'Edit draft #1' })).toBeVisible()
    expect(screen.getByLabelText('Subject')).toHaveValue('Weekly summary')
    expect(screen.getByLabelText('Department')).toHaveValue('Computer Science')
  })

  test('invalid audience and empty fields are caught before any request', async () => {
    const backend = createBackend()
    open(backend)
    const actor = userEvent.setup()
    await screen.findByLabelText('Subject')
    await actor.click(screen.getByRole('radio', { name: 'One level' }))
    await actor.click(screen.getByRole('button', { name: 'Save draft' }))
    expect(screen.getByText('Enter a subject.')).toBeVisible()
    expect(screen.getByText('Enter the message text.')).toBeVisible()
    expect(screen.getByText('Choose a level.')).toBeVisible()
    expect(backend.calls.filter((c) => c.method === 'POST')).toEqual([])
  })

  test('editing a field clears its stale error and switching audience clears the audience error', async () => {
    const backend = createBackend()
    open(backend)
    const actor = userEvent.setup()
    await actor.click(await screen.findByRole('radio', { name: 'One level' }))
    await actor.click(screen.getByRole('button', { name: 'Save draft' }))
    expect(screen.getByText('Choose a level.')).toBeVisible()
    await actor.selectOptions(screen.getByLabelText('Level'), '300')
    expect(screen.queryByText('Choose a level.')).toBeNull()
    expect(screen.getByText('Enter a subject.')).toBeVisible()
    await actor.type(screen.getByLabelText('Subject'), 'Hi')
    expect(screen.queryByText('Enter a subject.')).toBeNull()
    expect(screen.getByText('Enter the message text.')).toBeVisible()
  })

  test('server field errors map onto the form', async () => {
    const backend = createBackend()
    open(backend)
    server.use(http.post(url('/dawah/broadcasts/'), () => fail(400, 'VALIDATION_ERROR', 'Correct the highlighted fields.', { subject: ['Subject is too long.'], department: ['Unknown department.'] })))
    const actor = userEvent.setup()
    await fillBasics(actor)
    await actor.click(screen.getByRole('radio', { name: 'One department' }))
    await actor.type(screen.getByLabelText('Department'), 'Nope')
    await actor.click(screen.getByRole('button', { name: 'Save draft' }))
    expect(await screen.findByText('Subject is too long.')).toBeVisible()
    expect(screen.getByText('Unknown department.')).toBeVisible()
    expect(location()).toBe('/admin/communication')
  })
})

describe('editing a draft', () => {
  const draft = wireBroadcast({ id: 7, version: 3, subject: 'Old', body: 'Old body', audience: { type: 'level', level: '300' } })

  test('reopen, edit and PATCH with the loaded version', async () => {
    const backend = createBackend({ broadcasts: [draft] })
    open(backend, '/admin/communication/drafts/7')
    const actor = userEvent.setup()
    const subject = await screen.findByLabelText('Subject')
    expect(subject).toHaveValue('Old')
    expect(screen.getByLabelText('Level')).toHaveValue('300')
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled()
    await actor.clear(subject)
    await actor.type(subject, 'New subject')
    await actor.click(screen.getByRole('button', { name: 'Save changes' }))
    expect(await screen.findByText('Draft saved.')).toBeVisible()
    expect(backend.only('PATCH')[0].body).toMatchObject({ subject: 'New subject', version: 3, audience: { type: 'level', level: '300' } })
    expect(backend.store.get(7).version).toBe(4)
  })

  test('stale version: 409 offers reload, keeps local text, never overwrites', async () => {
    const backend = createBackend({ broadcasts: [draft] })
    open(backend, '/admin/communication/drafts/7')
    const actor = userEvent.setup()
    const subject = await screen.findByLabelText('Subject')
    // Someone else saves first.
    backend.store.get(7).version = 4
    backend.store.get(7).subject = 'Changed elsewhere'
    await actor.clear(subject)
    await actor.type(subject, 'My edit')
    await actor.click(screen.getByRole('button', { name: 'Save changes' }))

    expect(await screen.findByText('This draft was changed somewhere else.')).toBeVisible()
    expect(screen.getByLabelText('Subject')).toHaveValue('My edit')
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled()
    expect(backend.store.get(7).subject).toBe('Changed elsewhere')
    expect(backend.only('PATCH')).toHaveLength(1)

    await actor.click(screen.getByRole('button', { name: 'Reload latest version' }))
    await waitFor(() => expect(screen.getByLabelText('Subject')).toHaveValue('Changed elsewhere'))
    expect(screen.queryByText('This draft was changed somewhere else.')).toBeNull()
    // Subsequent save uses the reloaded version.
    await actor.type(screen.getByLabelText('Subject'), '!')
    await actor.click(screen.getByRole('button', { name: 'Save changes' }))
    await waitFor(() => expect(backend.only('PATCH')).toHaveLength(2))
    expect(backend.only('PATCH')[1].body.version).toBe(4)
  })

  test('failed save shows the server message and keeps the form', async () => {
    const backend = createBackend({ broadcasts: [draft] })
    open(backend, '/admin/communication/drafts/7')
    server.use(http.patch(url('/dawah/broadcasts/7/'), () => fail(503, 'SERVICE_UNAVAILABLE', 'Service unavailable. Try again.')))
    const actor = userEvent.setup()
    const subject = await screen.findByLabelText('Subject')
    await actor.type(subject, '!')
    await actor.click(screen.getByRole('button', { name: 'Save changes' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Service unavailable. Try again.')
    expect(subject).toHaveValue('Old!')
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeEnabled()
  })

  test('a queued broadcast cannot be edited', async () => {
    const backend = createBackend({ broadcasts: [wireBroadcast({ id: 8, state: 'queued' })] })
    open(backend, '/admin/communication/drafts/8')
    expect(await screen.findByText(/can no longer be edited/)).toBeVisible()
    expect(screen.queryByLabelText('Subject')).toBeNull()
    expect(screen.getByRole('link', { name: 'View delivery history' })).toHaveAttribute('href', '/admin/communication/history/8')
  })

  test('missing draft shows a scoped error', async () => {
    open(createBackend(), '/admin/communication/drafts/99')
    expect(await screen.findByRole('alert')).toHaveTextContent(/not found/i)
  })
})

describe('preview safety', () => {
  const hostile = '<script>alert(1)</script><img src=x onerror=alert(2)><b>bold</b>'

  test('renders hostile content as literal text with an advisory count', async () => {
    const backend = createBackend({ broadcasts: [wireBroadcast({ id: 7, subject: '<i>Hi</i>', body: hostile })], previewCount: 42 })
    open(backend, '/admin/communication/drafts/7')
    const actor = userEvent.setup()
    await actor.click(await screen.findByRole('button', { name: 'Preview' }))
    const body = await screen.findByTestId('preview-body')
    expect(body.textContent).toBe(hostile)
    expect(screen.getByTestId('preview-subject').textContent).toBe('<i>Hi</i>')
    const section = body.closest('section')
    // The only element allowed is the sandboxed frame; no hostile markup reaches the app document.
    expect(section.querySelector('script, img, b, i')).toBeNull()
    expect(section.querySelectorAll('iframe')).toHaveLength(1)
    expect(within(section).getByText(/About 42 recipients/)).toHaveTextContent(/estimate/)
    expect(backend.only('POST', '/preview/')).toHaveLength(1)
    expect(backend.only('POST', '/queue/')).toHaveLength(0)
  })

  test('preview is disabled until saved and hidden once edited', async () => {
    const backend = createBackend({ broadcasts: [wireBroadcast({ id: 7 })] })
    open(backend, '/admin/communication/drafts/7')
    const actor = userEvent.setup()
    await actor.click(await screen.findByRole('button', { name: 'Preview' }))
    expect(await screen.findByTestId('preview-body')).toBeVisible()
    await actor.type(screen.getByLabelText('Message (plain text)'), ' more')
    expect(screen.queryByTestId('preview-body')).toBeNull()
    expect(screen.getByRole('button', { name: 'Preview' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Queue for sending…' })).toBeDisabled()
  })
})

describe('queue confirmation', () => {
  const draft = wireBroadcast({ id: 7, version: 3, audience: { type: 'department', department: 'Computer Science' } })

  test('confirmation shows audience and the immutability warning; 202 lands on history as queued, not sent', async () => {
    const backend = createBackend({ broadcasts: [draft], previewCount: 42 })
    open(backend, '/admin/communication/drafts/7')
    const actor = userEvent.setup()
    await actor.click(await screen.findByRole('button', { name: 'Queue for sending…' }))
    const dialog = await screen.findByRole('dialog', { name: 'Queue this broadcast?' })
    expect(within(dialog).getByText('Department: Computer Science')).toBeVisible()
    expect(within(dialog).getByText(/cannot be changed/)).toBeVisible()
    expect(backend.only('POST', '/queue/')).toHaveLength(0)

    await actor.click(within(dialog).getByRole('button', { name: 'Queue broadcast' }))
    await waitFor(() => expect(location()).toBe('/admin/communication/history/7'))
    expect(backend.only('POST', '/queue/')[0].body).toEqual({ version: 3 })
    expect(await screen.findByText(/Queued\. Delivery is pending/)).toBeVisible()
    expect(screen.getAllByText('Queued').length).toBeGreaterThan(0)
    expect(screen.queryByText(/delivered/i)).toBeNull()
  })

  test('cancel closes the dialog without a request; Escape also closes', async () => {
    const backend = createBackend({ broadcasts: [draft] })
    open(backend, '/admin/communication/drafts/7')
    const actor = userEvent.setup()
    await actor.click(await screen.findByRole('button', { name: 'Queue for sending…' }))
    await actor.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    await actor.click(screen.getByRole('button', { name: 'Queue for sending…' }))
    await actor.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(backend.only('POST', '/queue/')).toHaveLength(0)
  })

  test('zero-recipient validation error stays in the dialog and leaves the draft', async () => {
    const backend = createBackend({ broadcasts: [draft] })
    open(backend, '/admin/communication/drafts/7')
    server.use(http.post(url('/dawah/broadcasts/7/queue/'), () => fail(400, 'VALIDATION_ERROR', 'This audience has no active recipients.')))
    const actor = userEvent.setup()
    await actor.click(await screen.findByRole('button', { name: 'Queue for sending…' }))
    await actor.click(screen.getByRole('button', { name: 'Queue broadcast' }))
    const dialog = screen.getByRole('dialog')
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('This audience has no active recipients.')
    expect(location()).toBe('/admin/communication/drafts/7')
  })

  test('stale version on queue switches to the reload flow', async () => {
    const backend = createBackend({ broadcasts: [draft] })
    open(backend, '/admin/communication/drafts/7')
    const actor = userEvent.setup()
    await actor.click(await screen.findByRole('button', { name: 'Queue for sending…' }))
    backend.store.get(7).version = 4
    await actor.click(screen.getByRole('button', { name: 'Queue broadcast' }))
    expect(await screen.findByText('This draft was changed somewhere else.')).toBeVisible()
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(backend.store.get(7).state).toBe('draft')
  })

  test('replay: queueing an already-queued broadcast returns the same 202 and lands on its history', async () => {
    const backend = createBackend({ broadcasts: [draft], previewCount: 5 })
    open(backend, '/admin/communication/drafts/7')
    const actor = userEvent.setup()
    await actor.click(await screen.findByRole('button', { name: 'Queue for sending…' }))
    // Another tab queued it first; the replay acknowledgement is identical (202, same counts).
    Object.assign(backend.store.get(7), { state: 'queued', recipient_count: 5, counts: { queued: 5, sent: 0, failed: 0, uncertain: 0, skipped: 0 } })
    await actor.click(screen.getByRole('button', { name: 'Queue broadcast' }))
    await waitFor(() => expect(location()).toBe('/admin/communication/history/7'))
    expect(await screen.findByText(/5 recipients/)).toBeVisible()
    expect(backend.store.get(7).recipient_count).toBe(5)
  })

  test('BROADCAST_ALREADY_QUEUED routes to history with a notice', async () => {
    const backend = createBackend({ broadcasts: [{ ...draft, state: 'queued', recipient_count: 3, counts: { queued: 3, sent: 0, failed: 0, uncertain: 0, skipped: 0 } }] })
    open(backend, '/admin/communication/drafts/7')
    // The editor sees it as draft, then the queue call reports it queued.
    server.use(
      http.get(url('/dawah/broadcasts/7/'), () => Response.json({ success: true, data: draft, message: 'OK.' })),
      http.post(url('/dawah/broadcasts/7/queue/'), () => fail(409, 'BROADCAST_ALREADY_QUEUED', 'Already queued.')),
    )
    const actor = userEvent.setup()
    await actor.click(await screen.findByRole('button', { name: 'Queue for sending…' }))
    await actor.click(screen.getByRole('button', { name: 'Queue broadcast' }))
    await waitFor(() => expect(location()).toBe('/admin/communication/history/7'))
    expect(await screen.findByText(/already queued/)).toBeVisible()
  })
})

describe('drafts list', () => {
  test('lists only drafts with links to edit', async () => {
    const backend = createBackend({ broadcasts: [wireBroadcast({ id: 1, subject: 'Draft one' }), wireBroadcast({ id: 2, subject: 'Sent one', state: 'completed' })] })
    open(backend, '/admin/communication/drafts')
    expect(await screen.findByRole('link', { name: 'Draft one' })).toHaveAttribute('href', '/admin/communication/drafts/1')
    expect(screen.queryByText('Sent one')).toBeNull()
    expect(backend.calls[0].query).toEqual({ kind: 'drafts', page: '1', page_size: '20' })
  })

  test('empty and error states', async () => {
    open(createBackend(), '/admin/communication/drafts')
    expect(await screen.findByText(/No drafts yet/)).toBeVisible()
    resetSession()
  })
})

describe('contract edge cases', () => {
  test('an unrecognised audience is not shown as "all" and blocks saving', async () => {
    const backend = createBackend({ broadcasts: [wireBroadcast({ id: 9, audience: { type: 'galaxy' } })] })
    open(backend, '/admin/communication/drafts/9')
    const actor = userEvent.setup()
    await screen.findByLabelText('Subject')
    for (const radio of within(screen.getByRole('group', { name: 'Audience' })).getAllByRole('radio')) expect(radio).not.toBeChecked()
    expect(screen.getByText(/unrecognised audience/)).toBeVisible()
    await actor.type(screen.getByLabelText('Subject'), '!')
    await actor.click(screen.getByRole('button', { name: 'Save changes' }))
    expect(backend.only('PATCH')).toEqual([])
    await actor.click(screen.getByRole('radio', { name: 'All active students' }))
    await actor.click(screen.getByRole('button', { name: 'Save changes' }))
    await waitFor(() => expect(backend.only('PATCH')).toHaveLength(1))
    expect(backend.only('PATCH')[0].body.audience).toEqual({ type: 'all' })
  })

  test('field errors are linked to their inputs with aria-describedby', async () => {
    open(createBackend())
    const actor = userEvent.setup()
    await screen.findByLabelText('Subject')
    await actor.click(screen.getByRole('button', { name: 'Save draft' }))
    for (const [label, message] of [['Subject', 'Enter a subject.'], ['Message (plain text)', 'Enter the message text.']]) {
      const input = screen.getByLabelText(label)
      expect(input).toHaveAttribute('aria-invalid', 'true')
      const target = document.getElementById(input.getAttribute('aria-describedby'))
      expect(target).toHaveTextContent(message)
    }
  })

  test('preview posts {version} and a stale version offers reload', async () => {
    const backend = createBackend({ broadcasts: [wireBroadcast({ id: 7, version: 3 })] })
    open(backend, '/admin/communication/drafts/7')
    const actor = userEvent.setup()
    await actor.click(await screen.findByRole('button', { name: 'Preview' }))
    await screen.findByTestId('preview-body')
    expect(backend.only('POST', '/preview/')[0].body).toEqual({ version: 3 })
    backend.store.get(7).version = 4
    await actor.click(screen.getByRole('button', { name: 'Preview' }))
    expect(await screen.findByText('This draft was changed somewhere else.')).toBeVisible()
    expect(screen.queryByTestId('preview-body')).toBeNull()
  })

  test('server action tokens gate preview and queue', async () => {
    const backend = createBackend({ broadcasts: [wireBroadcast({ id: 7, eligible_actions: ['edit'] })] })
    open(backend, '/admin/communication/drafts/7')
    await screen.findByLabelText('Subject')
    expect(screen.getByRole('button', { name: 'Preview' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Queue for sending…' })).toBeDisabled()
  })
})

describe('queue dialog keyboard behaviour', () => {
  test('moves focus into the dialog, keeps Tab inside, closes on Escape and restores focus to the opener', async () => {
    const backend = createBackend({ broadcasts: [wireBroadcast({ id: 7, version: 3 })] })
    open(backend, '/admin/communication/drafts/7')
    const actor = userEvent.setup()
    const opener = await screen.findByRole('button', { name: 'Queue for sending…' })
    await actor.click(opener)
    const dialog = await screen.findByRole('dialog', { name: 'Queue this broadcast?' })
    await waitFor(() => expect(dialog).toContainElement(document.activeElement))
    expect(document.activeElement).toBe(within(dialog).getByRole('button', { name: 'Cancel' }))
    for (let i = 0; i < 5; i += 1) {
      await actor.tab()
      expect(dialog).toContainElement(document.activeElement)
    }
    // Background inertness is asserted in the browser spec; jsdom only proves focus never escapes.
    await actor.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await waitFor(() => expect(opener).toHaveFocus())
    expect(backend.only('POST', '/queue/')).toHaveLength(0)
  })
})

describe('double submit', () => {
  test('save sends one request for two quick clicks', async () => {
    const backend = createBackend({ latency: 150 })
    open(backend)
    const actor = userEvent.setup()
    await fillBasics(actor)
    await actor.dblClick(screen.getByRole('button', { name: 'Save draft' }))
    await waitFor(() => expect(location()).toBe('/admin/communication/drafts/1'), { timeout: 3000 })
    expect(backend.only('POST', '/dawah/broadcasts/')).toHaveLength(1)
  })

  test('queue sends one request for two quick confirms', async () => {
    const backend = createBackend({ broadcasts: [wireBroadcast({ id: 7, version: 3 })], latency: 150 })
    open(backend, '/admin/communication/drafts/7')
    const actor = userEvent.setup()
    await actor.click(await screen.findByRole('button', { name: 'Queue for sending…' }))
    await actor.dblClick(screen.getByRole('button', { name: 'Queue broadcast' }))
    await waitFor(() => expect(location()).toBe('/admin/communication/history/7'), { timeout: 3000 })
    expect(backend.only('POST', '/queue/')).toHaveLength(1)
  })
})
