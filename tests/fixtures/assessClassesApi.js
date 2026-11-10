import { http, HttpResponse } from 'msw'
import { ok, fail, url } from './auth.js'

const only = (value, keys) => value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).every((key) => keys.includes(key))

/** Strict request-body checks for the D3 class/module/roster contract (unknown keys rejected). */
export const classBodyViolation = (body) => {
  if (!only(body, ['code', 'title', 'description'])) return `class body keys ${JSON.stringify(Object.keys(body ?? {}))}`
  if (!['code', 'title', 'description'].every((key) => typeof body[key] === 'string')) return 'class field types'
  return null
}
export const moduleBodyViolation = (body, { partial }) => {
  if (!only(body, ['title', 'body', 'order', 'resource_ids'])) return `module body keys ${JSON.stringify(Object.keys(body ?? {}))}`
  if (!partial && !['title', 'body', 'order', 'resource_ids'].every((key) => key in body)) return 'module create needs title, body, order, resource_ids'
  if ('title' in body && typeof body.title !== 'string') return 'module title type'
  if ('body' in body && typeof body.body !== 'string') return 'module body type'
  if ('order' in body && !(Number.isInteger(body.order) && body.order >= 1)) return 'module order must be a positive integer'
  if ('resource_ids' in body && !(Array.isArray(body.resource_ids) && body.resource_ids.every(Number.isInteger))) return 'resource_ids must be integers'
  return null
}
export const enrollmentBodyViolation = (body) => {
  if (!only(body, ['student_id', 'status'])) return `enrollment body keys ${JSON.stringify(Object.keys(body ?? {}))}`
  if (!Number.isInteger(body.student_id) || !['active', 'withdrawn'].includes(body.status)) return 'enrollment field types'
  return null
}

const page = (rows, search) => {
  const number = Number(search.page ?? 1)
  const size = Number(search.page_size ?? 20)
  return { count: rows.length, next: null, previous: null, results: rows.slice((number - 1) * size, number * size) }
}

export const arabicClass = (overrides = {}) => ({
  id: 2, code: 'ARB101', title: 'Arabic for beginners', description: 'Greetings and basics.', kind: 'arabic', status: 'draft',
  created_at: '2026-10-01T09:00:00Z', updated_at: '2026-10-01T09:00:00Z', ...overrides,
})
export const resourceRef = (id, title, type = 'aud') => ({ id, title, type, event: { id: 3, title: 'Friday khutbah' } })
export const moduleRecord = (overrides = {}) => ({ id: 20, title: 'Greetings', body: 'Lesson text', order: 1, status: 'draft', resources: [], quizzes: [], ...overrides })
export const enrollmentRow = (id, studentId, name, status = 'active', overrides = {}) => ({
  id, course_id: 2, student_id: studentId, status, student_name: name, student_email: `${name.split(' ')[0].toLowerCase()}@example.test`,
  enrolled_at: '2026-10-02T08:00:00Z', withdrawn_at: status === 'withdrawn' ? '2026-10-05T08:00:00Z' : null, ...overrides,
})

/** Stateful in-memory stand-in for the D3 admin class API (synthetic data only). */
export function createClassBackend({ classes = [], modules = {}, enrollments = {}, resources = [], students = [] } = {}) {
  const state = {
    classes: structuredClone(classes), modules: structuredClone(modules), enrollments: structuredClone(enrollments),
    resources: structuredClone(resources), students: structuredClone(students),
    calls: [], violations: [], nextId: 500, failNext: null,
  }
  const record = async (request, params) => {
    const text = ['GET', 'DELETE'].includes(request.method) ? '' : await request.clone().text()
    const call = { method: request.method, path: new URL(request.url).pathname, search: Object.fromEntries(new URL(request.url).searchParams), body: text ? JSON.parse(text) : null, params }
    state.calls.push(call)
    return call
  }
  const violation = (what) => {
    state.violations.push(what)
    return fail(400, 'CONTRACT_VIOLATION', `Test contract violation: ${what}`)
  }
  const guard = (call) => {
    const planned = state.failNext
    if (planned && planned.method === call.method && call.path.includes(planned.pattern)) {
      state.failNext = null
      return planned.response()
    }
    return null
  }
  const findClass = (id) => state.classes.find((item) => String(item.id) === String(id))
  const modulesOf = (id) => (state.modules[id] ??= [])
  const withResources = (module) => ({ ...module, resources: module.resources })
  const resolve = (ids) => ids.map((id) => state.resources.find((resource) => resource.id === id)).filter(Boolean)
  const route = (method, path, handler) =>
    http[method](url(path), async ({ request, params }) => {
      const call = await record(request, params)
      const blocked = guard(call)
      if (blocked) return blocked
      const target = path.includes(':id') ? findClass(params.id) : null
      if (path.includes(':id') && !target) return fail(404, 'NOT_FOUND', 'Not found.')
      return handler({ call, params, target })
    })

  const handlers = [
    route('get', '/quiz/classes/', ({ call }) => {
      const rows = state.classes.filter((item) => !call.search.status || item.status === call.search.status)
      return ok(page(rows, call.search))
    }),
    route('post', '/quiz/classes/', ({ call }) => {
      const bad = classBodyViolation(call.body)
      if (bad) return violation(bad)
      if (!call.body.code.trim()) return fail(400, 'VALIDATION_ERROR', 'Correct the highlighted fields.', { code: ['This field may not be blank.'] })
      if (state.classes.some((item) => item.code === call.body.code)) return fail(400, 'VALIDATION_ERROR', 'Correct the highlighted fields.', { code: ['A class with this code already exists.'] })
      const created = { id: state.nextId++, kind: 'arabic', status: 'draft', created_at: '2026-10-03T09:00:00Z', updated_at: '2026-10-03T09:00:00Z', ...call.body }
      state.classes.push(created)
      return ok(created, 'Saved.', { status: 201 })
    }),
    route('get', '/quiz/classes/:id/', ({ target }) => ok(target)),
    route('patch', '/quiz/classes/:id/', ({ call, target }) => {
      const bad = classBodyViolation(call.body)
      if (bad) return violation(bad)
      if (target.status === 'closed') return fail(409, 'CLASS_CLOSED', 'A closed class cannot be edited.')
      if (state.classes.some((item) => item.id !== target.id && item.code === call.body.code)) return fail(400, 'VALIDATION_ERROR', 'Correct the highlighted fields.', { code: ['A class with this code already exists.'] })
      Object.assign(target, call.body, { updated_at: '2026-10-04T09:00:00Z' })
      return ok(target, 'Saved.')
    }),
    route('delete', '/quiz/classes/:id/', ({ target }) => {
      if (target.status !== 'draft') return fail(409, 'CLASS_NOT_DRAFT', 'Only draft classes can be deleted.')
      if (modulesOf(target.id).length) return fail(409, 'RESOURCE_REFERENCED', 'This class has modules.')
      state.classes = state.classes.filter((item) => item !== target)
      return new HttpResponse(null, { status: 204 })
    }),
    route('post', '/quiz/classes/:id/publish/', ({ target }) => {
      if (target.status !== 'draft') return fail(409, 'INVALID_STATE', `A ${target.status} class cannot be published.`)
      target.status = 'published'
      return ok(target, 'Published.')
    }),
    route('post', '/quiz/classes/:id/close/', ({ target }) => {
      if (target.status !== 'published') return fail(409, 'INVALID_STATE', `A ${target.status} class cannot be closed.`)
      target.status = 'closed'
      return ok(target, 'Closed.')
    }),

    route('get', '/quiz/classes/:id/modules/', ({ call, target }) => ok(page([...modulesOf(target.id)].sort((a, b) => a.order - b.order).map(withResources), call.search))),
    route('post', '/quiz/classes/:id/modules/', ({ call, target }) => {
      const bad = moduleBodyViolation(call.body, { partial: false })
      if (bad) return violation(bad)
      if (target.status === 'closed') return fail(409, 'CLASS_CLOSED', 'A closed class cannot gain modules.')
      if (!call.body.title.trim()) return fail(400, 'VALIDATION_ERROR', 'Correct the highlighted fields.', { title: ['This field may not be blank.'] })
      const found = resolve(call.body.resource_ids)
      if (found.length !== call.body.resource_ids.length) return fail(400, 'VALIDATION_ERROR', 'Correct the highlighted fields.', { resource_ids: ['One or more resources are not published or do not exist.'] })
      const created = { id: state.nextId++, course_id: target.id, status: 'draft', quizzes: [], title: call.body.title, body: call.body.body, order: call.body.order, resources: found }
      modulesOf(target.id).push(created)
      return ok(created, 'Saved.', { status: 201 })
    }),
    route('get', '/quiz/classes/:id/modules/:moduleId/', ({ params, target }) => {
      const module = modulesOf(target.id).find((item) => String(item.id) === params.moduleId)
      return module ? ok(module) : fail(404, 'NOT_FOUND', 'Not found.')
    }),
    route('patch', '/quiz/classes/:id/modules/:moduleId/', ({ call, params, target }) => {
      const module = modulesOf(target.id).find((item) => String(item.id) === params.moduleId)
      if (!module) return fail(404, 'NOT_FOUND', 'Not found.')
      const bad = moduleBodyViolation(call.body, { partial: true })
      if (bad) return violation(bad)
      if (target.status === 'closed') return fail(409, 'CLASS_CLOSED', 'A closed class cannot be edited.')
      const { resource_ids: ids, ...rest } = call.body
      if (ids) {
        const found = resolve(ids)
        if (found.length !== ids.length) return fail(400, 'VALIDATION_ERROR', 'Correct the highlighted fields.', { resource_ids: ['One or more resources are not published or do not exist.'] })
        module.resources = found
      }
      Object.assign(module, rest)
      return ok(module, 'Saved.')
    }),
    route('delete', '/quiz/classes/:id/modules/:moduleId/', ({ params, target }) => {
      const module = modulesOf(target.id).find((item) => String(item.id) === params.moduleId)
      if (!module) return fail(404, 'NOT_FOUND', 'Not found.')
      if (module.status !== 'draft') return fail(409, 'MODULE_PUBLISHED', 'Unpublish the module before deleting it.')
      if (module.quizzes.length) return fail(409, 'RESOURCE_REFERENCED', 'A quiz references this module.')
      state.modules[target.id] = modulesOf(target.id).filter((item) => item !== module)
      return new HttpResponse(null, { status: 204 })
    }),
    route('post', '/quiz/classes/:id/modules/:moduleId/publish/', ({ params, target }) => {
      const module = modulesOf(target.id).find((item) => String(item.id) === params.moduleId)
      module.status = 'published'
      return ok(module, 'Published.')
    }),
    route('post', '/quiz/classes/:id/modules/:moduleId/unpublish/', ({ params, target }) => {
      const module = modulesOf(target.id).find((item) => String(item.id) === params.moduleId)
      module.status = 'draft'
      return ok(module, 'Unpublished.')
    }),

    route('get', '/quiz/classes/:id/enrollments/', ({ call, target }) => {
      const needle = (call.search.search ?? '').toLowerCase()
      const rows = (state.enrollments[target.id] ?? []).filter(
        (row) => (!call.search.status || row.status === call.search.status) && (!needle || `${row.student_name} ${row.student_email}`.toLowerCase().includes(needle)),
      )
      return ok(page(rows, call.search))
    }),
    route('post', '/quiz/classes/:id/enrollments/', ({ call, target }) => {
      const bad = enrollmentBodyViolation(call.body)
      if (bad) return violation(bad)
      if (target.status === 'closed') return fail(409, 'CLASS_CLOSED', 'A closed class does not accept enrollment changes.')
      const rows = (state.enrollments[target.id] ??= [])
      let row = rows.find((item) => item.student_id === call.body.student_id)
      if (!row && target.status !== 'published') return fail(409, 'CLASS_NOT_PUBLISHED', 'Only published classes accept enrollment.')
      if (!row) {
        const student = state.students.find((item) => item.id === call.body.student_id)
        if (!student) return fail(400, 'VALIDATION_ERROR', 'Correct the highlighted fields.', { student_id: ['Unknown student.'] })
        row = enrollmentRow(state.nextId++, student.id, `${student.first_name} ${student.last_name}`, 'active', { course_id: target.id })
        rows.push(row)
      }
      row.status = call.body.status
      row.withdrawn_at = call.body.status === 'withdrawn' ? '2026-10-06T08:00:00Z' : null
      return ok(row, 'Saved.')
    }),

    http.get(url('/dawah/archive/'), async ({ request }) => {
      const call = await record(request)
      const blocked = guard(call)
      if (blocked) return blocked
      const needle = (call.search.search ?? '').toLowerCase()
      const rows = state.resources.filter((item) => (!call.search.type || item.type === call.search.type) && (!needle || item.title.toLowerCase().includes(needle)))
      return ok(page(rows, call.search))
    }),
    http.get(url('/accounts/students/'), async ({ request }) => {
      const call = await record(request)
      const blocked = guard(call)
      if (blocked) return blocked
      const needle = (call.search.search ?? '').toLowerCase()
      const rows = state.students.filter((item) => `${item.first_name} ${item.last_name} ${item.email}`.toLowerCase().includes(needle))
      return ok(page(rows, call.search))
    }),
  ]
  return { state, handlers, callsTo: (method, pattern) => state.calls.filter((c) => c.method === method && c.path.includes(pattern)) }
}
