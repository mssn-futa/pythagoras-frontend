import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http } from 'msw'
import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'
import { POLL_INTERVAL_MS, POLL_MAX_POLLS } from '../../src/features/communication/model.js'
import { admin, fail, recorder, resetSession, sessionHandlers, storeRefreshToken, student, url, useApiOrigin } from '../fixtures/auth.js'
import { counts, createBackend, wireBroadcast } from '../fixtures/communication.js'
import { createAutomationBackend, wireRule, wireRun } from '../fixtures/automations.js'
import { TestApp } from '../fixtures/TestApp.jsx'
import { server } from '../mocks/server.js'

// jsdom gaps that ProseMirror touches (same shims as the rich editor tests).
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
afterEach(async () => {
  // Let in-flight loads settle so no request outlives the test (the setup file fails on unhandled requests).
  await until(() => {
    if (screen.queryByText('Loading rule…') || screen.queryByText('Loading run history…') || screen.queryByText('Loading rules…')) throw new Error('loading')
  }, 200).catch(() => {})
  resetSession()
})

const realSetTimeout = globalThis.setTimeout
/** Polls an assertion; with fake timers (no auto-advance) it nudges them 1 ms per round so I/O can settle without firing poll timers. */
async function until(assertion, rounds = 400) {
  let last
  for (let i = 0; i < rounds; i += 1) {
    try {
      return assertion()
    } catch (error) {
      last = error
    }
    await act(async () => {
      if (vi.isFakeTimers()) await vi.advanceTimersByTimeAsync(1)
      await new Promise((resolve) => realSetTimeout(resolve, 5))
    })
  }
  throw last
}

const BASE = '/admin/communication/automations'
function open(backend, path = BASE, extra = []) {
  server.use(...sessionHandlers(recorder(), admin), ...extra, ...backend.handlers)
  storeRefreshToken()
  return render(<TestApp path={path} />)
}
const location = () => screen.getByTestId('location').textContent

describe('guard and tab', () => {
  test('anonymous visitors are redirected and no automation request is made', async () => {
    const backend = createAutomationBackend()
    server.use(...backend.handlers)
    render(<TestApp path={BASE} />)
    expect(await screen.findByLabelText('Email or matric number')).toBeVisible()
    expect(location()).toBe('/sign-in?next=%2Fadmin%2Fcommunication%2Fautomations')
    expect(backend.calls).toEqual([])
  })

  test('students are denied before any automation request', async () => {
    const backend = createAutomationBackend()
    server.use(...sessionHandlers(recorder(), student), ...backend.handlers)
    storeRefreshToken()
    render(<TestApp path={`${BASE}/3`} />)
    expect(await screen.findByRole('heading', { name: 'Access denied' })).toBeVisible()
    expect(backend.calls).toEqual([])
  })

  test('admins get an Automations tab next to Compose, Drafts and History', async () => {
    open(createAutomationBackend())
    expect(await screen.findByRole('heading', { name: 'Communication' })).toBeVisible()
    for (const name of ['Compose', 'Drafts', 'History', 'Automations']) expect(screen.getByRole('link', { name })).toBeVisible()
    expect(screen.getByRole('link', { name: 'Automations' })).toHaveAttribute('href', BASE)
  })
})

describe('rule list', () => {
  test('disabled, enabled and blocked rules read differently and an enabled rule is not called operational', async () => {
    const backend = createAutomationBackend({
      rules: [
        wireRule({ id: 1, template: { subject: 'Off rule', body_format: 'plain', body: 'x', body_html: '<p>x</p>' } }),
        wireRule({ id: 2, enabled: true, template: { subject: 'On rule', body_format: 'plain', body: 'x', body_html: '<p>x</p>' } }),
        wireRule({ id: 4, enabled: true, owner_active: false, kind: 'event_reminder', template: { subject: 'Stuck rule', body_format: 'plain', body: 'x', body_html: '<p>x</p>' } }),
      ],
    })
    open(backend)
    const items = await screen.findAllByRole('listitem')
    expect(items).toHaveLength(3)
    expect(within(items[0]).getByText('Disabled')).toBeVisible()
    expect(within(items[0]).getByText(/Not creating runs/)).toBeVisible()
    expect(within(items[1]).getByText('Enabled')).toBeVisible()
    expect(within(items[1]).getByText(/not proof that anything ran/)).toBeVisible()
    expect(within(items[2]).getByText('Blocked: owner inactive')).toBeVisible()
    expect(within(items[2]).getByText(/no new runs are created/)).toBeVisible()
    expect(within(items[0]).getByText('Monday at 08:00 (Africa/Lagos)')).toBeVisible()
    expect(within(items[2]).getByText('1 day before the event starts')).toBeVisible()
    expect(within(items[0]).getByRole('link', { name: /Off rule/ })).toHaveAttribute('href', `${BASE}/1`)
    expect(backend.calls[0].query).toEqual({ page: '1', page_size: '20' })
  })

  test('empty state says new rules start disabled', async () => {
    open(createAutomationBackend())
    expect(await screen.findByText(/No automation rules yet/)).toBeVisible()
  })
})

describe('create', () => {
  test('weekly rule: Monday 08:00 with Africa/Lagos stated, saved disabled, then no operational claim', async () => {
    const backend = createAutomationBackend()
    open(backend, `${BASE}/new`)
    const actor = userEvent.setup()
    expect(await screen.findByLabelText('Day of the week')).toHaveValue('0')
    expect(screen.getByLabelText('Local time (24-hour)')).toHaveValue('08:00')
    expect(screen.getByTestId('timezone-note')).toHaveTextContent('Africa/Lagos')
    expect(screen.getByRole('button', { name: 'Save as disabled rule' })).toBeVisible()
    expect(screen.queryByRole('button', { name: /Enable/ })).toBeNull()

    await actor.type(screen.getByLabelText('Subject'), 'Weekly Da’wah summary')
    await actor.click(screen.getByLabelText('Message template (plain text)'))
    await actor.paste('This week: {{summaries}}')
    await actor.selectOptions(screen.getByLabelText('Day of the week'), 'Friday')
    await actor.click(screen.getByRole('button', { name: 'Save as disabled rule' }))

    await waitFor(() => expect(location()).toBe(`${BASE}/1`))
    expect(await screen.findByText(/starts disabled: nothing is scheduled and no email will be sent/)).toBeVisible()
    expect(backend.only('POST', '/dawah/automations/')[0].body).toEqual({
      kind: 'weekly_digest',
      audience: { type: 'all' },
      timezone: 'Africa/Lagos',
      weekday: 4,
      local_time: '08:00',
      template: { subject: 'Weekly Da’wah summary', body_format: 'plain', body: 'This week: {{summaries}}' },
      enabled: false,
    })
    expect(screen.getAllByText('Disabled').length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: 'Enable…' })).toBeEnabled()
    // Saving never calls enable.
    expect(backend.only('POST', '/enable/')).toHaveLength(0)
  })

  test('reminder rule: offset and categories are required and mapped to offset_minutes', async () => {
    const backend = createAutomationBackend()
    open(backend, `${BASE}/new`)
    const actor = userEvent.setup()
    await actor.click(await screen.findByRole('radio', { name: 'Event reminder' }))
    expect(screen.queryByLabelText('Day of the week')).toBeNull()
    await actor.click(screen.getByLabelText('Subject'))
    await actor.paste('Reminder: {{event_title}}')
    await actor.click(screen.getByLabelText('Message template (plain text)'))
    await actor.paste('Starts {{event_start}}')
    await actor.click(screen.getByRole('button', { name: 'Save as disabled rule' }))
    expect(await screen.findByText('Choose at least one event category.')).toBeVisible()
    expect(backend.calls).toEqual([])

    await actor.click(screen.getByRole('checkbox', { name: 'Jumu’ah' }))
    await actor.clear(screen.getByLabelText('Send before the event starts'))
    await actor.type(screen.getByLabelText('Send before the event starts'), '2')
    await actor.selectOptions(screen.getByLabelText('Unit'), 'days')
    await actor.click(screen.getByRole('button', { name: 'Save as disabled rule' }))
    await waitFor(() => expect(location()).toBe(`${BASE}/1`))
    expect(backend.only('POST', '/dawah/automations/')[0].body).toEqual({
      kind: 'event_reminder',
      audience: { type: 'all' },
      offset_minutes: 2880,
      categories: ['jumuah'],
      template: { subject: 'Reminder: {{event_title}}', body_format: 'plain', body: 'Starts {{event_start}}' },
      enabled: false,
    })
  })

  test('undocumented placeholders and template code are blocked client-side with the documented list shown', async () => {
    const backend = createAutomationBackend()
    open(backend, `${BASE}/new`)
    const actor = userEvent.setup()
    await actor.type(await screen.findByLabelText('Subject'), 'S')
    await actor.click(screen.getByLabelText('Message template (plain text)'))
    await actor.paste('{{event_title}} {% if x %}')
    await actor.click(screen.getByRole('button', { name: 'Save as disabled rule' }))
    expect(await screen.findByText(/not a documented placeholder/)).toBeVisible()
    expect(screen.getByText(/not allowed: templates support documented placeholders only/)).toBeVisible()
    expect(screen.getByText('{{summaries}}')).toBeVisible()
    expect(backend.calls).toEqual([])
  })

  test('server field errors (including nested template names) appear under the fields', async () => {
    const backend = createAutomationBackend()
    open(backend, `${BASE}/new`)
    const actor = userEvent.setup()
    await actor.type(await screen.findByLabelText('Subject'), 'S')
    await actor.click(screen.getByLabelText('Message template (plain text)'))
    await actor.paste('Body')
    server.use(
      http.post(url('/dawah/automations/'), () =>
        fail(400, 'VALIDATION_ERROR', 'Correct the highlighted fields.', { 'template.subject': ['Subject too spicy.'], local_time: ['Not a valid time.'], schedule: ['Invalid schedule.'] }),
      ),
    )
    await actor.click(screen.getByRole('button', { name: 'Save as disabled rule' }))
    expect(await screen.findByText('Subject too spicy.')).toBeVisible()
    expect(screen.getByText('Not a valid time.')).toBeVisible()
    expect(screen.getByRole('alert')).toHaveTextContent('Invalid schedule.')
  })

  test('rich template: editor content is sent as body_html only', async () => {
    const backend = createAutomationBackend()
    open(backend, `${BASE}/new`)
    const actor = userEvent.setup()
    await actor.type(await screen.findByLabelText('Subject'), 'Rich weekly')
    await actor.click(screen.getByRole('radio', { name: 'Rich text' }))
    const box = await screen.findByRole('textbox', { name: 'Message template (rich text)' }, { timeout: 8000 })
    act(() => box.editor.commands.setContent('<p><strong>Key</strong> {{summaries}}<script>x</script></p>', { emitUpdate: true }))
    await actor.click(screen.getByRole('button', { name: 'Save as disabled rule' }))
    await waitFor(() => expect(location()).toBe(`${BASE}/1`))
    const body = backend.only('POST', '/dawah/automations/')[0].body
    expect(body.template).toEqual({ subject: 'Rich weekly', body_format: 'rich', body_html: expect.stringContaining('<strong>Key</strong>') })
    expect(body.template.body_html).not.toContain('<script')
    expect(body.template).not.toHaveProperty('body')
  }, 20_000)
})

describe('edit and version conflicts', () => {
  const setup = (over) => {
    const backend = createAutomationBackend({ rules: [wireRule({ version: 2, ...over })] })
    open(backend, `${BASE}/3`)
    return backend
  }

  test('save sends the loaded version and adopts the returned one', async () => {
    const backend = setup()
    const actor = userEvent.setup()
    const time = await screen.findByLabelText('Local time (24-hour)')
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled()
    await actor.clear(time)
    await actor.type(time, '17:30')
    await actor.click(screen.getByRole('button', { name: 'Save changes' }))
    expect(await screen.findByText(/does not enable the rule or prove that anything ran/)).toBeVisible()
    expect(backend.only('PATCH')[0].body).toMatchObject({ version: 2, local_time: '17:30', categories: [] })
    expect(backend.only('PATCH')[0].body).not.toHaveProperty('enabled')
    expect(backend.store.get(3)).toMatchObject({ version: 3, local_time: '17:30', enabled: false })
  })

  test('a stale version offers reload, never silently overwrites', async () => {
    const backend = setup()
    const actor = userEvent.setup()
    const subject = await screen.findByLabelText('Subject')
    backend.store.get(3).version = 5
    backend.store.get(3).template.subject = 'Changed elsewhere'
    await actor.type(subject, ' (mine)')
    await actor.click(screen.getByRole('button', { name: 'Save changes' }))
    const alert = await screen.findByText('This rule was changed somewhere else.')
    expect(alert).toBeVisible()
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled()
    expect(screen.getByLabelText('Subject')).toHaveValue('Weekly Da’wah summary (mine)')
    expect(backend.store.get(3).template.subject).toBe('Changed elsewhere')
    await actor.click(screen.getByRole('button', { name: 'Reload latest version' }))
    await waitFor(() => expect(screen.getByLabelText('Subject')).toHaveValue('Changed elsewhere'))
    expect(screen.queryByText('This rule was changed somewhere else.')).toBeNull()
  })

  test('the rule type is locked after creation', async () => {
    setup()
    expect(await screen.findByRole('radio', { name: 'Weekly summary' })).toBeDisabled()
    expect(screen.getByRole('radio', { name: 'Event reminder' })).toBeDisabled()
  })

  test('editing an enabled rule warns that created occurrences keep their snapshot', async () => {
    setup({ enabled: true })
    expect(await screen.findByText(/occurrences already created keep the content and audience/)).toBeVisible()
  })
})

describe('enable and disable', () => {
  test('enable is explicit: confirm dialog first, cancel sends nothing, confirm sends {version}', async () => {
    const backend = createAutomationBackend({ rules: [wireRule({ version: 1 })] })
    open(backend, `${BASE}/3`)
    const actor = userEvent.setup()
    await actor.click(await screen.findByRole('button', { name: 'Enable…' }))
    const dialog = screen.getByRole('dialog', { name: 'Enable this rule?' })
    expect(within(dialog).getByText(/Monday at 08:00 \(Africa\/Lagos\)/)).toBeVisible()
    expect(within(dialog).getByText(/not proof that anything has been or will be sent/)).toBeVisible()
    await actor.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    expect(backend.only('POST', '/enable/')).toHaveLength(0)

    await actor.click(screen.getByRole('button', { name: 'Enable…' }))
    await actor.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Enable rule' }))
    expect(await screen.findByText(/check run history to confirm that it does/)).toBeVisible()
    expect(backend.only('POST', '/enable/')[0].body).toEqual({ version: 1 })
    expect(screen.getAllByText('Enabled').length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: 'Disable…' })).toBeVisible()
    expect(screen.getByText(/No runs yet\. Saving or enabling a rule does not create a run/)).toBeVisible()
  })

  test('unsaved edits block enabling: enable applies the saved version only', async () => {
    const backend = createAutomationBackend({ rules: [wireRule()] })
    open(backend, `${BASE}/3`)
    const actor = userEvent.setup()
    await actor.type(await screen.findByLabelText('Subject'), '!')
    expect(screen.getByRole('button', { name: 'Enable…' })).toBeDisabled()
    expect(screen.getByText(/Save your changes before enabling/)).toBeVisible()
  })

  test('disable confirms and explains what is and is not cancelled', async () => {
    const backend = createAutomationBackend({ rules: [wireRule({ enabled: true, version: 4 })] })
    open(backend, `${BASE}/3`)
    const actor = userEvent.setup()
    await actor.click(await screen.findByRole('button', { name: 'Disable…' }))
    const dialog = screen.getByRole('dialog', { name: 'Disable this rule?' })
    expect(within(dialog).getByText(/cannot be recalled/)).toBeVisible()
    await actor.click(within(dialog).getByRole('button', { name: 'Disable rule' }))
    expect(await screen.findByText(/Rule disabled\. Occurrences not yet created are cancelled/)).toBeVisible()
    expect(backend.only('POST', '/disable/')[0].body).toEqual({ version: 4 })
    expect(backend.store.get(3).enabled).toBe(false)
  })

  test('invalid schedule rejected by the server on enable: dialog closes, errors shown, rule stays disabled', async () => {
    const backend = createAutomationBackend({ rules: [wireRule()] })
    open(backend, `${BASE}/3`, [
      http.post(url('/dawah/automations/3/enable/'), () => fail(400, 'VALIDATION_ERROR', 'Correct the highlighted fields.', { local_time: ['Not a valid schedule time.'], schedule: ['The saved schedule is invalid.'] })),
    ])
    const actor = userEvent.setup()
    await actor.click(await screen.findByRole('button', { name: 'Enable…' }))
    await actor.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Enable rule' }))
    expect(await screen.findByText('Not a valid schedule time.')).toBeVisible()
    expect(screen.getByRole('alert')).toHaveTextContent('The saved schedule is invalid.')
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(backend.store.get(3).enabled).toBe(false)
  })

  test('a saved rule that is invalid cannot be enabled client-side and the reasons are visible', async () => {
    const backend = createAutomationBackend({ rules: [wireRule({ weekday: 9 })] })
    open(backend, `${BASE}/3`)
    expect(await screen.findByText('This saved rule cannot be enabled yet:')).toBeVisible()
    expect(screen.getByText('Choose a day of the week.')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Enable…' })).toBeDisabled()
    expect(backend.only('POST', '/enable/')).toHaveLength(0)
  })

  test('owner inactive: blocked wording, enable unavailable, "Assign to me" reassigns and unblocks', async () => {
    const backend = createAutomationBackend({ rules: [wireRule({ owner_active: false, blocked_reason: 'owner_inactive', owner_id: 8 })] })
    open(backend, `${BASE}/3`)
    const actor = userEvent.setup()
    expect(await screen.findByText('Blocked: owner inactive')).toBeVisible()
    expect(screen.getByText('No new runs are created while the owner is inactive.')).toBeVisible()
    expect(screen.getByText('Admin #8 (inactive)')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Enable…' })).toBeDisabled()
    await actor.click(screen.getByRole('button', { name: 'Assign to me' }))
    expect(await screen.findByText('Rule assigned to you.')).toBeVisible()
    expect(backend.only('PATCH')[0].body).toEqual({ owner_id: 2, version: 1 })
    expect(screen.queryByText('Blocked: owner inactive')).toBeNull()
    expect(screen.getByRole('button', { name: 'Enable…' })).toBeEnabled()
  })

  test('server-side owner-inactive on enable becomes the blocked state', async () => {
    const backend = createAutomationBackend({ rules: [wireRule()] })
    open(backend, `${BASE}/3`)
    const actor = userEvent.setup()
    await actor.click(await screen.findByRole('button', { name: 'Enable…' }))
    backend.store.get(3).owner_active = false // owner deactivated after the page loaded
    await actor.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Enable rule' }))
    expect(await screen.findByText('Blocked: owner inactive')).toBeVisible()
    expect(screen.getByText(/cannot be enabled\. Assign the rule to yourself/)).toBeVisible()
    expect(backend.store.get(3).enabled).toBe(false)
  })

  test('a version conflict during enable offers reload', async () => {
    const backend = createAutomationBackend({ rules: [wireRule()] })
    open(backend, `${BASE}/3`)
    const actor = userEvent.setup()
    await actor.click(await screen.findByRole('button', { name: 'Enable…' }))
    backend.store.get(3).version = 9
    await actor.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Enable rule' }))
    expect(await screen.findByText('This rule was changed somewhere else.')).toBeVisible()
    expect(backend.store.get(3).enabled).toBe(false)
  })
})

describe('unsupported kind and stored timezone', () => {
  test('an unknown rule type shows a read-only state: no form, no save/preview/enable, disable and runs allowed', async () => {
    const backend = createAutomationBackend({ rules: [wireRule({ kind: 'monthly_digest', enabled: true })], runs: { 3: [wireRun({ state: 'completed', counts: counts({ sent: 4 }) })] } })
    open(backend, `${BASE}/3`)
    expect(await screen.findByText('Unsupported rule type.')).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Save changes' })).toBeNull()
    expect(screen.queryByRole('button', { name: /Preview/ })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Enable…' })).toBeNull()
    expect(await screen.findByTestId('run-row')).toBeVisible()
    await userEvent.click(screen.getByRole('button', { name: 'Disable…' }))
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Disable rule' }))
    await waitFor(() => expect(backend.store.get(3).enabled).toBe(false))
  })

  test('an unknown disabled rule cannot be enabled', async () => {
    open(createAutomationBackend({ rules: [wireRule({ kind: 'monthly_digest' })] }), `${BASE}/3`)
    expect(await screen.findByText('Unsupported rule type.')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Enable…' })).toBeDisabled()
  })

  test('a stored non-Lagos timezone is shown, blocks saving until explicitly changed, then saves Africa/Lagos', async () => {
    const backend = createAutomationBackend({ rules: [wireRule({ timezone: 'Europe/London' })] })
    open(backend, `${BASE}/3`)
    const actor = userEvent.setup()
    expect((await screen.findAllByText('Europe/London', { selector: 'strong' })).length).toBeGreaterThan(0)
    expect(screen.getByTestId('timezone-note')).toHaveTextContent('Europe/London')
    await actor.type(screen.getByLabelText('Subject'), '!')
    await actor.click(screen.getByRole('button', { name: 'Save changes' }))
    // Shown under the schedule field and, because the saved rule is invalid, in the enable-blocked reasons.
    expect((await screen.findAllByText(/Change it to Africa\/Lagos explicitly before saving/)).length).toBe(2)
    expect(backend.only('PATCH')).toHaveLength(0)
    await actor.click(screen.getByRole('button', { name: 'Change to Africa/Lagos' }))
    await actor.click(screen.getByRole('button', { name: 'Save changes' }))
    await waitFor(() => expect(backend.only('PATCH')).toHaveLength(1))
    expect(backend.only('PATCH')[0].body.timezone).toBe('Africa/Lagos')
  })

  test('the explicit timezone change alone makes the form dirty (saveable)', async () => {
    open(createAutomationBackend({ rules: [wireRule({ timezone: 'Europe/London' })] }), `${BASE}/3`)
    expect(screen.queryByRole('button', { name: 'Change to Africa/Lagos' })).toBeNull()
    await userEvent.click(await screen.findByRole('button', { name: 'Change to Africa/Lagos' }))
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeEnabled()
  })
})

describe('preview (non-sending, sandboxed)', () => {
  const hostile = '<p>Server preview</p><script>window.__pwned = true</script><img src="https://evil.test/x.png" onerror="window.__pwned = 2"><form action="https://evil.test"><input name="x"></form>'

  test('renders in a no-script sandbox, shows audience count and source summary, and makes no mutating call', async () => {
    const backend = createAutomationBackend({ rules: [wireRule({ version: 1 })], previews: { 3: { rendered_html: hostile, rendered_text: 'Server preview' } } })
    open(backend, `${BASE}/3`)
    const actor = userEvent.setup()
    await actor.click(await screen.findByRole('button', { name: 'Preview (no email sent)' }))
    const frame = await screen.findByTestId('preview-frame')
    expect(frame).toHaveAttribute('sandbox', '')
    expect(frame.getAttribute('srcdoc')).toContain("script-src 'none'")
    expect(document.querySelector('script[src], img[src*="evil"], form[action*="evil"]')).toBeNull()
    expect(document.body.textContent).not.toContain('window.__pwned')
    expect(window.__pwned).toBeUndefined()
    expect(screen.getByText(/About 42 recipients would match today/)).toBeVisible()
    const source = screen.getByTestId('preview-source')
    expect(within(source).getByText(/Window: 2 Nov 2026, 08:00 \(Lagos\) to 9 Nov 2026, 08:00 \(Lagos\)/)).toBeVisible()
    expect(within(source).getByText(/Friday khutbah \(Jumu’ah\), 6 Nov 2026, 13:00 \(Lagos\)/)).toBeVisible()
    expect(screen.getByTestId('preview-body')).toHaveTextContent('Server preview')
    expect(backend.calls.map((c) => `${c.method} ${c.path}`)).toEqual(['GET /dawah/automations/3/', 'GET /dawah/automations/3/runs/', 'POST /dawah/automations/3/preview/'])
    expect(backend.calls.at(-1).body).toEqual({ version: 1 })
  })

  test('says when today\'s data would be a skipped occurrence', async () => {
    const backend = createAutomationBackend({ rules: [wireRule()], previews: { 3: { skip_reason_code: 'no_eligible_summaries', source: { window_start: '2026-11-02T07:00:00Z', window_end: '2026-11-09T07:00:00Z', events: [] } } } })
    open(backend, `${BASE}/3`)
    await userEvent.click(await screen.findByRole('button', { name: 'Preview (no email sent)' }))
    expect(await screen.findByText(/would be recorded as skipped and no email would be created/)).toBeVisible()
    expect(screen.getByText(/No published event in the window had an authored summary/)).toBeVisible()
    expect(screen.getByText('No qualifying events in the source.')).toBeVisible()
  })

  test('preview is unavailable for unsaved edits and disappears when edited', async () => {
    const backend = createAutomationBackend({ rules: [wireRule()] })
    open(backend, `${BASE}/3`)
    const actor = userEvent.setup()
    await actor.click(await screen.findByRole('button', { name: 'Preview (no email sent)' }))
    expect(await screen.findByTestId('preview-frame')).toBeVisible()
    await actor.type(screen.getByLabelText('Subject'), '!')
    expect(screen.queryByTestId('preview-frame')).toBeNull()
    expect(screen.getByRole('button', { name: 'Preview (no email sent)' })).toBeDisabled()
  })
})

describe('run history', () => {
  const allStates = [
    wireRun({ id: 1, occurrence_key: 'r:queued', state: 'queued' }),
    wireRun({ id: 2, occurrence_key: 'r:skipped', state: 'skipped', reason_code: 'no_eligible_summaries', broadcast_id: null, counts: null, recipient_count: null }),
    wireRun({ id: 3, occurrence_key: 'r:missed', state: 'missed', reason_code: 'missed_catch_up_window', broadcast_id: null, counts: null, recipient_count: null }),
    wireRun({ id: 4, occurrence_key: 'r:cancelled', state: 'cancelled', reason_code: 'source_rescheduled', broadcast_id: 9, counts: counts({ cancelled: 3 }), recipient_count: 3, source: { window_start: null, window_end: null, event: { id: 5, title: 'Usroh', start_time: '2026-11-12T16:00:00Z' }, event_revision: 2 } }),
    wireRun({ id: 5, occurrence_key: 'r:blocked', state: 'blocked', reason_code: 'owner_inactive', broadcast_id: null, counts: null, recipient_count: null }),
    wireRun({ id: 6, occurrence_key: 'r:failed', state: 'failed', reason_code: 'provider_failure', broadcast_id: 11, counts: counts({ failed: 4 }) }),
    wireRun({ id: 7, occurrence_key: 'r:uncertain', state: 'uncertain', reason_code: 'delivery_uncertain', broadcast_id: 12, counts: counts({ sent: 2, uncertain: 2 }) }),
    wireRun({ id: 8, occurrence_key: 'r:done', state: 'completed', broadcast_id: 13, counts: counts({ sent: 4 }) }),
    wireRun({ id: 9, occurrence_key: 'r:weird', state: 'exploded', reason_code: 'brand_new_code', broadcast_id: null, counts: null }),
  ]

  test('each state, reason code and count renders distinctly; times are Lagos; broadcasts link to detail', async () => {
    const backend = createAutomationBackend({ rules: [wireRule({ enabled: true })], runs: { 3: allStates } })
    open(backend, `${BASE}/3`)
    const rows = await screen.findAllByTestId('run-row')
    expect(rows).toHaveLength(9)
    const row = (key) => rows.find((r) => within(r).queryByText(key))
    const expectIn = (key, ...texts) => texts.forEach((t) => expect(within(row(key)).getByText(t)).toBeVisible())

    expectIn('r:queued', 'Queued', '9 Nov 2026, 08:00 (Lagos)')
    expectIn('r:skipped', 'Skipped (nothing sent)', 'Reason code: no_eligible_summaries', 'No broadcast was created.')
    expectIn('r:missed', 'Missed (not sent)', 'Reason code: missed_catch_up_window')
    expectIn('r:cancelled', 'Cancelled', 'Reason code: source_rescheduled')
    expect(within(row('r:cancelled')).getByText(/Event: Usroh, starts 12 Nov 2026, 17:00 \(Lagos\) \(schedule revision 2\)/)).toBeVisible()
    expectIn('r:blocked', 'Blocked: owner', 'Reason code: owner_inactive')
    expectIn('r:failed', 'Failed', 'Reason code: provider_failure')
    expectIn('r:uncertain', 'Uncertain delivery', 'Reason code: delivery_uncertain')
    expectIn('r:done', 'Completed')
    expect(within(row('r:weird')).getByText('Unrecognised state: exploded')).toBeVisible()
    expect(within(row('r:weird')).getByText('Reason code: brand_new_code')).toBeVisible()

    expect(within(row('r:failed')).getByRole('link', { name: 'Broadcast #11' })).toHaveAttribute('href', '/admin/communication/history/11')
    expect(within(row('r:uncertain')).getByText('4 recipients: 0 queued, 2 Resend accepted, 0 failed, 2 uncertain, 0 skipped')).toBeVisible()
    expect(within(row('r:queued')).getByText('4 recipients: 4 queued, 0 Resend accepted, 0 failed, 0 uncertain, 0 skipped')).toBeVisible()
    expect(screen.queryByText(/delivered/i)).toBeNull()
    // Distinct labels: no two different states share the same badge text.
    const badges = rows.map((r) => r.querySelector('span.rounded-full').textContent)
    expect(new Set(badges).size).toBe(rows.length)
  })

  test('the link opens the real materialized broadcast detail with its counts', async () => {
    const automation = createAutomationBackend({ rules: [wireRule({ enabled: true })], runs: { 3: [wireRun({ broadcast_id: 7, state: 'completed', counts: counts({ sent: 4 }) })] } })
    const broadcasts = createBackend({ broadcasts: [wireBroadcast({ id: 7, subject: 'Weekly Da’wah summary', state: 'completed', recipient_count: 4, counts: counts({ sent: 4 }), eligible_actions: [] })], deliveries: { 7: [] } })
    open(automation, `${BASE}/3`, broadcasts.handlers)
    await userEvent.click(await screen.findByRole('link', { name: 'Broadcast #7' }))
    expect(await screen.findByText('4 recipients: 0 queued, 4 Resend accepted, 0 failed, 0 uncertain, 0 skipped')).toBeVisible()
    expect(location()).toBe('/admin/communication/history/7')
  })

  test('no runs: says an enabled rule with no runs has produced nothing', async () => {
    const backend = createAutomationBackend({ rules: [wireRule({ enabled: true })] })
    open(backend, `${BASE}/3`)
    expect(await screen.findByText(/No runs yet/)).toBeVisible()
    expect(screen.getByText(/A rule that is enabled but has no runs has not produced anything yet/)).toBeVisible()
  })
})

describe('run polling', () => {
  beforeEach(() => vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'], shouldAdvanceTime: false }))
  const runCalls = (backend) => backend.only('GET', '/runs/').length
  const queued = () => wireRun({ id: 1, state: 'queued' })

  test('polls while a run is outstanding and stops at the terminal state', async () => {
    const backend = createAutomationBackend({ rules: [wireRule({ enabled: true })], runs: { 3: [queued()] } })
    open(backend, `${BASE}/3`)
    await until(() => screen.getByTestId('run-row'))
    expect(runCalls(backend)).toBe(1)
    expect(screen.getByText('Updating automatically while runs are outstanding.')).toBeVisible()
    await act(() => vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS))
    await until(() => expect(runCalls(backend)).toBe(2))
    backend.setRuns(3, [wireRun({ id: 1, state: 'completed', counts: counts({ sent: 4 }) })])
    await act(() => vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS))
    await until(() => expect(screen.getByText('Completed')).toBeVisible())
    const settled = runCalls(backend)
    await act(() => vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS * 10))
    expect(runCalls(backend)).toBe(settled)
    expect(screen.queryByText('Updating automatically while runs are outstanding.')).toBeNull()
  })

  test('never polls when every run is already terminal or there are none', async () => {
    const backend = createAutomationBackend({ rules: [wireRule({ enabled: true })], runs: { 3: [wireRun({ state: 'skipped', reason_code: 'no_recipients', broadcast_id: null })] } })
    open(backend, `${BASE}/3`)
    await until(() => screen.getByTestId('run-row'))
    await act(() => vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS * 10))
    expect(runCalls(backend)).toBe(1)
  })

  test('stops at unmount', async () => {
    const backend = createAutomationBackend({ rules: [wireRule({ enabled: true })], runs: { 3: [queued()] } })
    const { unmount } = open(backend, `${BASE}/3`)
    await until(() => screen.getByTestId('run-row'))
    await act(() => vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS))
    await until(() => expect(runCalls(backend)).toBe(2))
    unmount()
    await act(() => vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS * 10))
    expect(runCalls(backend)).toBe(2)
  })

  test('after the bound it pauses with a manual refresh', async () => {
    const backend = createAutomationBackend({ rules: [wireRule({ enabled: true })], runs: { 3: [queued()] } })
    open(backend, `${BASE}/3`)
    await until(() => screen.getByTestId('run-row'))
    for (let i = 0; i < POLL_MAX_POLLS; i += 1) await act(() => vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS))
    await until(() => expect(screen.getByText('Automatic updates paused.')).toBeVisible())
    const calls = runCalls(backend)
    await act(() => vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS * 5))
    expect(runCalls(backend)).toBe(calls)
  })
})
