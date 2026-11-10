import { beforeEach, describe, expect, test } from 'vitest'
import {
  createRule, disableRule, enableRule, listRuns, normalizeRule, normalizeRun, previewRule, reassignRule, toRulePayload, updateRule,
} from '../../src/features/communication/api/automationsApi.js'
import {
  EMPTY_RULE_FORM, formToDraft, minutesToOffset, offsetLabel, offsetToMinutes, ruleFormKey, ruleStatus, ruleToForm, runStateText, scanPlaceholders, scheduleSummary, validateRuleForm,
} from '../../src/features/communication/automations/automationModel.js'
import { useApiOrigin } from '../fixtures/auth.js'
import { createAutomationBackend, wireRule, wireRun } from '../fixtures/automations.js'
import { server } from '../mocks/server.js'

beforeEach(useApiOrigin)

const weeklyForm = (over = {}) => ({ ...EMPTY_RULE_FORM, subject: 'Weekly', body: 'Hi {{summaries}}', ...over })
const reminderForm = (over = {}) => ({ ...EMPTY_RULE_FORM, kind: 'event_reminder', subject: 'Soon: {{event_title}}', body: 'Starts {{event_start}}', categories: ['jumuah'], ...over })

describe('schedule, offset and timezone mapping', () => {
  test('weekly create is exactly the D4 example plus the template, disabled, with Monday = 0 and Africa/Lagos explicit', () => {
    expect(toRulePayload(formToDraft(weeklyForm()), { create: true })).toEqual({
      kind: 'weekly_digest',
      audience: { type: 'all' },
      timezone: 'Africa/Lagos',
      weekday: 0,
      local_time: '08:00',
      template: { subject: 'Weekly', body_format: 'plain', body: 'Hi {{summaries}}' },
      enabled: false,
    })
  })

  test.each([['0', 0], ['3', 3], ['6', 6]])('weekday option %s is sent as integer %i', (option, wire) => {
    expect(toRulePayload(formToDraft(weeklyForm({ weekday: option })), { create: true }).weekday).toBe(wire)
  })

  test('reminder create sends offset_minutes and categories only (no weekday/time/timezone)', () => {
    const payload = toRulePayload(formToDraft(reminderForm({ offsetValue: '2', offsetUnit: 'days' })), { create: true })
    expect(payload).toEqual({
      kind: 'event_reminder',
      audience: { type: 'all' },
      offset_minutes: 2880,
      categories: ['jumuah'],
      template: { subject: 'Soon: {{event_title}}', body_format: 'plain', body: 'Starts {{event_start}}' },
      enabled: false,
    })
  })

  test('rich templates send body_html and never body; edit never sends kind or enabled and always states categories', () => {
    const draft = formToDraft(weeklyForm({ bodyFormat: 'rich', bodyHtml: '<p><strong>Hi</strong></p>', body: 'Hi' }))
    expect(toRulePayload(draft)).toEqual({
      audience: { type: 'all' },
      timezone: 'Africa/Lagos',
      weekday: 0,
      local_time: '08:00',
      categories: [],
      template: { subject: 'Weekly', body_format: 'rich', body_html: '<p><strong>Hi</strong></p>' },
    })
  })

  test('offset units convert to minutes and back; invalid offsets are null', () => {
    expect(offsetToMinutes('90', 'minutes')).toBe(90)
    expect(offsetToMinutes('24', 'hours')).toBe(1440)
    expect(offsetToMinutes('1', 'days')).toBe(1440)
    for (const bad of ['', '0', '-1', '1.5', 'abc', '1e3']) expect(offsetToMinutes(bad, 'hours')).toBeNull()
    expect(minutesToOffset(1440)).toEqual({ value: '1', unit: 'days' })
    expect(minutesToOffset(90)).toEqual({ value: '90', unit: 'minutes' })
    expect(minutesToOffset(180)).toEqual({ value: '3', unit: 'hours' })
    expect(offsetLabel(1440)).toBe('1 day')
    expect(offsetLabel(60)).toBe('1 hour')
  })

  test('summaries state the day and the Lagos zone', () => {
    expect(scheduleSummary(normalizeRule(wireRule({ weekday: 6, local_time: '18:30:00' })))).toBe('Sunday at 18:30 (Africa/Lagos)')
    expect(scheduleSummary(normalizeRule(wireRule({ kind: 'event_reminder', offset_minutes: 1440 })))).toBe('1 day before the event starts')
  })
})

describe('validation', () => {
  test('defaults are the D4 weekly default (Monday 08:00) and valid once content exists', () => {
    expect(EMPTY_RULE_FORM).toMatchObject({ kind: 'weekly_digest', weekday: '0', localTime: '08:00' })
    expect(validateRuleForm(weeklyForm())).toEqual({})
  })

  test('rejects bad time, missing reminder category, bad offset, empty subject/body, audience gaps', () => {
    expect(validateRuleForm(weeklyForm({ localTime: '25:00' }))).toHaveProperty('local_time')
    expect(validateRuleForm(weeklyForm({ localTime: '' }))).toHaveProperty('local_time')
    expect(validateRuleForm(reminderForm({ categories: [] }))).toHaveProperty('categories')
    expect(validateRuleForm(reminderForm({ offsetValue: '0' }))).toHaveProperty('offset_minutes')
    expect(validateRuleForm(weeklyForm({ subject: ' ', body: ' ' }))).toMatchObject({ subject: expect.any(Array), body: expect.any(Array) })
    expect(validateRuleForm(weeklyForm({ audienceType: 'department', department: ' ' }))).toHaveProperty('audience')
    expect(validateRuleForm(weeklyForm({ audienceType: 'level', level: '999' }))).toHaveProperty('audience')
    expect(validateRuleForm(weeklyForm({ audienceType: 'unknown' }))).toHaveProperty('audience')
  })

  test('only documented placeholders for the rule kind; template code is rejected', () => {
    expect(validateRuleForm(weeklyForm({ body: '{{event_title}}' })).template[0]).toMatch(/not a documented placeholder/)
    expect(validateRuleForm(reminderForm({ body: '{{ event_title }} {{event_start}}' }))).toEqual({})
    expect(validateRuleForm(weeklyForm({ body: '{{ summaries|safe }}' })).template[0]).toMatch(/not allowed/)
    expect(validateRuleForm(weeklyForm({ body: '{% for x in y %}' })).template[0]).toMatch(/not allowed/)
    expect(scanPlaceholders('a {{b}} {{ c }} {{d.e}}')).toEqual({ names: ['b', 'c'], invalid: ['{{d.e}}'] })
  })
})

describe('rule mapping', () => {
  test('wire → UI and back through the form keeps schedule, categories and template', () => {
    const rule = normalizeRule(wireRule({ kind: 'event_reminder', offset_minutes: 120, categories: ['usroh', 'jumuah'] }))
    expect(rule).toMatchObject({ kind: 'event_reminder', enabled: false, offsetMinutes: 120, categories: ['usroh', 'jumuah'], ownerId: 2, ownerActive: true, version: 1 })
    const form = ruleToForm(rule)
    expect(form).toMatchObject({ offsetValue: '2', offsetUnit: 'hours', categories: ['usroh', 'jumuah'] })
    expect(formToDraft(form).offsetMinutes).toBe(120)
  })

  test('weekly round trip keeps a non-zero weekday, time and stored timezone', () => {
    const rule = normalizeRule(wireRule({ weekday: 4, local_time: '17:15:00' }))
    const form = ruleToForm(rule)
    expect(form).toMatchObject({ weekday: '4', localTime: '17:15', timezone: 'Africa/Lagos' })
    expect(formToDraft(form)).toMatchObject({ weekday: 4, localTime: '17:15', timezone: 'Africa/Lagos' })
    expect(toRulePayload(formToDraft(form))).toMatchObject({ weekday: 4, local_time: '17:15', timezone: 'Africa/Lagos' })
    const odd = ruleToForm(normalizeRule(wireRule({ timezone: 'Europe/London' })))
    expect(odd.timezone).toBe('Europe/London')
    expect(validateRuleForm({ ...odd, subject: 'S', body: 'b' })).toHaveProperty('timezone')
    expect(validateRuleForm({ ...odd, timezone: 'Africa/Lagos', subject: 'S', body: 'b' })).toEqual({})
    expect(ruleFormKey(odd)).not.toBe(ruleFormKey({ ...odd, timezone: 'Africa/Lagos' }))
  })

  test('failed runs say Failed; provider wording only for provider reason codes; completed makes no inbox claim', () => {
    expect(runStateText('failed').label).toBe('Failed')
    expect(runStateText('failed').help).not.toMatch(/provider/i)
    expect(runStateText('failed', 'no_recipients').help).not.toMatch(/provider/i)
    expect(runStateText('failed', 'provider_rejected').help).toMatch(/provider did not accept/)
    expect(runStateText('failed', 'provider_failure').help).toMatch(/provider did not accept/)
    expect(runStateText('completed').help).toBe('Finished with no failed or uncertain messages; see counts.')
  })

  test('unknown audience/kind never default to something that looks operational', () => {
    const rule = normalizeRule({ id: 1, kind: 'mystery', enabled: 'yes', audience: { type: 'martians' }, template: null, version: 2 })
    expect(rule).toMatchObject({ kind: 'unknown', enabled: false, audience: { type: 'unknown' } })
  })

  test('status: disabled, enabled (not proof), blocked owner outranks enabled', () => {
    expect(ruleStatus(normalizeRule(wireRule())).key).toBe('disabled')
    const enabled = ruleStatus(normalizeRule(wireRule({ enabled: true })))
    expect(enabled.key).toBe('enabled')
    expect(enabled.help).toMatch(/not proof/)
    expect(ruleStatus(normalizeRule(wireRule({ enabled: true, owner_active: false }))).key).toBe('blocked')
    expect(ruleStatus(normalizeRule(wireRule({ enabled: true, blocked_reason: 'owner_inactive' }))).key).toBe('blocked')
  })

  test('every documented run state has its own label; unknown states are not guessed', () => {
    const states = ['pending', 'queued', 'processing', 'completed', 'completed_with_errors', 'failed', 'uncertain', 'skipped', 'missed', 'cancelled', 'blocked']
    const labels = states.map((state) => runStateText(state).label)
    expect(new Set(labels).size).toBe(states.length)
    expect(runStateText('weird')).toMatchObject({ tone: 'gray', label: 'Unrecognised state: weird' })
  })
})

describe('service calls against the strict fixture', () => {
  test('create posts the D4 weekly body and returns a disabled rule', async () => {
    const backend = createAutomationBackend()
    server.use(...backend.handlers)
    const rule = await createRule(formToDraft(weeklyForm()))
    expect(backend.calls[0]).toMatchObject({ method: 'POST', path: '/dawah/automations/', body: { kind: 'weekly_digest', enabled: false, timezone: 'Africa/Lagos', weekday: 0, local_time: '08:00' } })
    expect(rule).toMatchObject({ id: 1, enabled: false, version: 1, kind: 'weekly_digest', localTime: '08:00' })
  })

  test('the fixture rejects unknown keys (strictness self-check)', async () => {
    const backend = createAutomationBackend()
    server.use(...backend.handlers)
    const { api } = await import('../../src/services/api')
    await expect(api.post('/dawah/automations/', { kind: 'weekly_digest', enabled: false, surprise: 1, audience: { type: 'all' } })).rejects.toMatchObject({ status: 400, fields: { surprise: expect.any(Array) } })
    await expect(api.post('/dawah/automations/', { ...toRulePayload(formToDraft(weeklyForm()), { create: true }), enabled: true })).rejects.toMatchObject({ fields: { enabled: expect.any(Array) } })
  })

  test('update sends the edited version; stale version is a conflict error code', async () => {
    const backend = createAutomationBackend({ rules: [wireRule({ version: 3 })] })
    server.use(...backend.handlers)
    const saved = await updateRule(3, formToDraft(weeklyForm({ weekday: '4', localTime: '17:15' })), 3)
    expect(backend.calls[0].body).toMatchObject({ version: 3, weekday: 4, local_time: '17:15' })
    expect(backend.calls[0].body).not.toHaveProperty('kind')
    expect(backend.calls[0].body).not.toHaveProperty('enabled')
    expect(saved).toMatchObject({ version: 4, weekday: 4, localTime: '17:15' })
    await expect(updateRule(3, formToDraft(weeklyForm()), 3)).rejects.toMatchObject({ status: 409, code: 'AUTOMATION_VERSION_CONFLICT' })
  })

  test('enable/disable send only {version}; preview sends only {version} and returns mapped source summary', async () => {
    const backend = createAutomationBackend({ rules: [wireRule({ version: 1 })] })
    server.use(...backend.handlers)
    const preview = await previewRule(3, 1)
    expect(backend.calls[0]).toMatchObject({ path: '/dawah/automations/3/preview/', body: { version: 1 } })
    expect(preview).toMatchObject({ audienceCount: 42, source: { events: [{ title: 'Friday khutbah', category: 'jumuah' }] } })
    expect((await enableRule(3, 1)).enabled).toBe(true)
    expect(backend.calls[1]).toMatchObject({ path: '/dawah/automations/3/enable/', body: { version: 1 } })
    expect((await disableRule(3, 2)).enabled).toBe(false)
    expect(backend.calls[2].body).toEqual({ version: 2 })
  })

  test('reassign patches owner_id alone', async () => {
    const backend = createAutomationBackend({ rules: [wireRule({ owner_active: false })] })
    server.use(...backend.handlers)
    const rule = await reassignRule(3, 9, 1)
    expect(backend.calls[0].body).toEqual({ owner_id: 9, version: 1 })
    expect(rule.ownerActive).toBe(true)
  })

  test('runs map occurrence key, schedule, state, reason, broadcast and counts', async () => {
    const backend = createAutomationBackend({ rules: [wireRule()], runs: { 3: [wireRun({ state: 'skipped', reason_code: 'no_eligible_summaries', broadcast_id: null, counts: null, recipient_count: null })] } })
    server.use(...backend.handlers)
    const result = await listRuns(3)
    expect(backend.calls[0].query).toEqual({ page: '1', page_size: '20' })
    expect(result.results[0]).toMatchObject({ occurrenceKey: 'rule-3:2026-11-09T07:00:00Z', state: 'skipped', reasonCode: 'no_eligible_summaries', broadcastId: null, counts: null })
    expect(normalizeRun(wireRun()).counts).toMatchObject({ queued: 4, sent: 0 })
  })
})
