import { http } from 'msw'
import { fail, ok, url } from './auth.js'
import { canonicalizeHtml, counts, escapeHtml, htmlToText, page } from './communication.js'

/*
 * Strict, synthetic COMM-06 stand-in built from D4's route table and request examples. It REJECTS unknown request
 * keys and bad values with field errors, so the UI cannot drift from the contract unnoticed. Everything not literally in
 * D4 (template shape, lifecycle bodies, preview/run payload details, error codes) is a flagged assumption, see
 * docs/communication-automations.md.
 */
export const A = '/dawah/automations/'
export const CATEGORY_TOKENS = ['dawah_night', 'usroh', 'special_lecture', 'jumuah']
const PLACEHOLDERS = {
  weekly_digest: ['week_start', 'week_end', 'summary_count', 'summaries'],
  event_reminder: ['event_title', 'event_start', 'event_location', 'event_summary', 'event_url'],
}
const COMMON_KEYS = ['audience', 'template']
const KEYS = {
  weekly_digest: [...COMMON_KEYS, 'timezone', 'weekday', 'local_time', 'categories'],
  event_reminder: [...COMMON_KEYS, 'offset_minutes', 'categories'],
}

export function wireRule(over = {}) {
  const kind = over.kind ?? 'weekly_digest'
  const base = {
    id: 3,
    kind,
    enabled: false,
    audience: { type: 'all' },
    categories: kind === 'event_reminder' ? ['jumuah'] : [],
    template: { subject: 'Weekly Da’wah summary', body_format: 'plain', body: 'This week: {{summaries}}', body_html: '<p>This week: {{summaries}}</p>' },
    owner_id: 2,
    owner_active: true,
    blocked_reason: null,
    version: 1,
    created_at: '2026-11-10T09:00:00Z',
    updated_at: '2026-11-10T09:00:00Z',
  }
  if (kind === 'weekly_digest') Object.assign(base, { timezone: 'Africa/Lagos', weekday: 0, local_time: '08:00' })
  else Object.assign(base, { offset_minutes: 1440, template: { subject: 'Reminder: {{event_title}}', body_format: 'plain', body: 'Starts {{event_start}}', body_html: '<p>Starts {{event_start}}</p>' } })
  return { ...base, ...over }
}

export function wireRun(over = {}) {
  return {
    id: 1,
    occurrence_key: 'rule-3:2026-11-09T07:00:00Z',
    scheduled_at: '2026-11-09T07:00:00Z', // Monday 08:00 Lagos
    state: 'queued',
    reason_code: null,
    broadcast_id: 7,
    recipient_count: 4,
    counts: counts({ queued: 4 }),
    source: null,
    ...over,
  }
}

const BAD_TEMPLATE = (value, allowed) => {
  const tokens = [...String(value ?? '').matchAll(/\{\{([\s\S]*?)\}\}/g)].map((m) => m[1].trim())
  const unknown = tokens.filter((t) => !allowed.includes(t))
  const code = /\{%|%\}/.test(String(value ?? ''))
  return unknown.length || code
}

/** Returns a field-error map ({} when valid). `kind` is fixed by the create body or the stored rule. */
export function validateRuleBody(body, kind) {
  const fields = {}
  const allowedKeys = KEYS[kind] ?? []
  for (const key of Object.keys(body)) if (!allowedKeys.includes(key)) fields[key] = [`Unknown or not allowed for ${kind}: "${key}".`]
  const aud = body.audience
  if (!aud || !['all', 'department', 'level'].includes(aud.type)) fields.audience = ['Invalid audience.']
  else {
    const extra = Object.keys(aud).filter((k) => !['type', aud.type].includes(k) || (aud.type === 'all' && k !== 'type'))
    if (extra.length) fields.audience = [`Unknown audience keys: ${extra.join(', ')}.`]
    if (aud.type === 'department' && !String(aud.department ?? '').trim()) fields.department = ['Required.']
    if (aud.type === 'level' && !String(aud.level ?? '').trim()) fields.level = ['Required.']
  }
  if ('categories' in body) {
    if (!Array.isArray(body.categories) || body.categories.some((c) => !CATEGORY_TOKENS.includes(c))) fields.categories = ['Unknown category.']
    else if (kind === 'event_reminder' && body.categories.length === 0) fields.categories = ['Choose at least one category.']
  } else if (kind === 'event_reminder') fields.categories = ['Required.']
  if (kind === 'weekly_digest') {
    if (body.timezone !== 'Africa/Lagos') fields.timezone = ['Only Africa/Lagos is supported.']
    if (!Number.isInteger(body.weekday) || body.weekday < 0 || body.weekday > 6) fields.weekday = ['Weekday must be 0 (Monday) to 6.']
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(body.local_time ?? '')) fields.local_time = ['Time must be HH:MM.']
  } else if (!Number.isInteger(body.offset_minutes) || body.offset_minutes <= 0) fields.offset_minutes = ['Offset must be a positive whole number of minutes.']

  const t = body.template
  if (!t || typeof t !== 'object') fields.template = ['Required.']
  else {
    const extra = Object.keys(t).filter((k) => !['subject', 'body_format', 'body', 'body_html'].includes(k))
    if (extra.length) fields['template.extra'] = [`Unknown template keys: ${extra.join(', ')}.`]
    if (!String(t.subject ?? '').trim()) fields['template.subject'] = ['Subject is required.']
    if (t.body_format === 'rich') {
      if ('body' in t || typeof t.body_html !== 'string' || !t.body_html.trim()) fields.body_html = ['Rich templates need body_html and no body.']
    } else if (t.body_format === 'plain') {
      if ('body_html' in t || typeof t.body !== 'string' || !t.body.trim()) fields.body = ['Plain templates need body and no body_html.']
    } else fields.template = ['body_format must be plain or rich.']
    const allowed = PLACEHOLDERS[kind] ?? []
    if (BAD_TEMPLATE(t.subject, allowed) || BAD_TEMPLATE(t.body, allowed) || BAD_TEMPLATE(t.body_html, allowed)) fields.template = ['Only documented placeholders are allowed.']
  }
  return fields
}

/** Canonical stored template: rich → sanitized html + text fallback; plain → escaped html. */
function storeTemplate(t) {
  if (t.body_format === 'rich') {
    const body_html = canonicalizeHtml(t.body_html)
    return { subject: t.subject, body_format: 'rich', body_html, body: htmlToText(body_html) }
  }
  return { subject: t.subject, body_format: 'plain', body: t.body, body_html: `<p>${escapeHtml(t.body)}</p>` }
}

const validation = (fields) => fail(400, 'VALIDATION_ERROR', 'Correct the highlighted fields.', fields)

export function createAutomationBackend({ rules = [], runs = {}, previews = {} } = {}) {
  const store = new Map(rules.map((rule) => [rule.id, structuredClone(rule)]))
  const runStore = new Map(Object.entries(runs).map(([key, value]) => [Number(key), value]))
  const calls = []
  let nextId = Math.max(0, ...store.keys()) + 1
  const log = async (request) => {
    const u = new URL(request.url)
    const raw = ['GET', 'HEAD'].includes(request.method) ? '' : await request.clone().text()
    const entry = { method: request.method, path: u.pathname, query: Object.fromEntries(u.searchParams), body: raw ? JSON.parse(raw) : null }
    calls.push(entry)
    return entry
  }
  const strictQuery = (query) => {
    const bad = Object.keys(query).filter((k) => !['page', 'page_size'].includes(k))
    return bad.length ? fail(400, 'VALIDATION_ERROR', 'Correct the highlighted fields.', Object.fromEntries(bad.map((k) => [k, ['Unknown parameter.']]))) : null
  }
  const find = (id) => store.get(Number(id))
  const missing = () => fail(404, 'NOT_FOUND', 'Not found.')
  const conflict = () => fail(409, 'AUTOMATION_VERSION_CONFLICT', 'This rule was changed elsewhere.')
  const onlyVersion = (body) => Object.keys(body ?? {}).join() === 'version' && Number.isInteger(body.version)
  const bump = (rule) => Object.assign(rule, { version: rule.version + 1, updated_at: '2026-11-10T11:00:00Z' })

  const handlers = [
    http.get(url(A), async ({ request }) => {
      const { query } = await log(request)
      return strictQuery(query) ?? ok(page([...store.values()], query))
    }),
    http.post(url(A), async ({ request }) => {
      const { body } = await log(request)
      const { kind, enabled, ...rest } = body ?? {}
      if (!['weekly_digest', 'event_reminder'].includes(kind)) return validation({ kind: ['Invalid kind.'] })
      if (enabled !== false) return validation({ enabled: ['Rules start disabled: send enabled:false.'] })
      const fields = validateRuleBody(rest, kind)
      if (Object.keys(fields).length) return validation(fields)
      const { template, ...schedule } = rest
      const created = wireRule({ ...schedule, id: nextId, kind, template: storeTemplate(template) })
      nextId += 1
      store.set(created.id, created)
      return ok(created, 'Rule saved. It is disabled.', { status: 201 })
    }),
    http.get(url(`${A}:id/`), async ({ request, params }) => {
      await log(request)
      const rule = find(params.id)
      return rule ? ok(rule) : missing()
    }),
    http.patch(url(`${A}:id/`), async ({ request, params }) => {
      const { body } = await log(request)
      const rule = find(params.id)
      if (!rule) return missing()
      if (!Number.isInteger(body?.version)) return validation({ version: ['Required.'] })
      if (body.version !== rule.version) return conflict()
      const { version, owner_id: ownerId, ...fields } = body
      void version
      if (ownerId !== undefined) {
        if (Object.keys(fields).length) return validation({ owner_id: ['Send owner_id on its own.'] })
        Object.assign(rule, { owner_id: ownerId, owner_active: true, blocked_reason: null })
        return ok(bump(rule), 'Rule reassigned.')
      }
      const errors = validateRuleBody(fields, rule.kind)
      if (Object.keys(errors).length) return validation(errors)
      const { template, ...schedule } = fields
      Object.assign(rule, schedule, { template: storeTemplate(template) })
      return ok(bump(rule), 'Rule saved.')
    }),
    http.post(url(`${A}:id/enable/`), async ({ request, params }) => {
      const { body } = await log(request)
      const rule = find(params.id)
      if (!rule) return missing()
      if (!onlyVersion(body)) return validation({ version: ['Send only {"version": n}.'] })
      if (body.version !== rule.version) return conflict()
      if (rule.owner_active === false) return fail(409, 'AUTOMATION_OWNER_INACTIVE', 'The rule owner is not an active admin.')
      const { template, enabled, ...schedule } = rule
      void enabled
      const fields = validateRuleBody({ ...Object.fromEntries(Object.entries(schedule).filter(([k]) => KEYS[rule.kind].includes(k))), template: { subject: template.subject, body_format: template.body_format, ...(template.body_format === 'rich' ? { body_html: template.body_html } : { body: template.body }) } }, rule.kind)
      if (Object.keys(fields).length) return validation({ schedule: ['The saved schedule is invalid.'], ...fields })
      rule.enabled = true
      return ok(bump(rule), 'Rule enabled.')
    }),
    http.post(url(`${A}:id/disable/`), async ({ request, params }) => {
      const { body } = await log(request)
      const rule = find(params.id)
      if (!rule) return missing()
      if (!onlyVersion(body)) return validation({ version: ['Send only {"version": n}.'] })
      if (body.version !== rule.version) return conflict()
      rule.enabled = false
      return ok(bump(rule), 'Rule disabled.')
    }),
    http.post(url(`${A}:id/preview/`), async ({ request, params }) => {
      const { body } = await log(request)
      const rule = find(params.id)
      if (!rule) return missing()
      if (!onlyVersion(body)) return validation({ version: ['Send only {"version": n}.'] })
      if (body.version !== rule.version) return conflict()
      const override = previews[rule.id]
      return ok({
        subject: rule.template.subject,
        body: rule.template.body,
        body_format: rule.template.body_format,
        rendered_html: rule.template.body_html,
        rendered_text: rule.template.body,
        audience_count: 42,
        skip_reason_code: null,
        source: { window_start: '2026-11-02T07:00:00Z', window_end: '2026-11-09T07:00:00Z', events: [{ id: 5, title: 'Friday khutbah', category: 'jumuah', start_time: '2026-11-06T12:00:00Z' }] },
        ...override,
      })
    }),
    http.get(url(`${A}:id/runs/`), async ({ request, params }) => {
      const { query } = await log(request)
      if (!find(params.id)) return missing()
      return strictQuery(query) ?? ok(page(runStore.get(Number(params.id)) ?? [], query))
    }),
  ]

  return {
    handlers,
    calls,
    store,
    setRuns: (id, list) => runStore.set(Number(id), list),
    only: (method, suffix = '') => calls.filter((c) => c.method === method && c.path.endsWith(suffix)),
  }
}
