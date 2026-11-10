import { http } from 'msw'
import { audio } from './dawah.js'
import { fail, ok, url } from './auth.js'

// Strict, stateful stand-in for the D3 student class/enrollment/module API (synthetic data only).
// It records contract violations (unexpected bodies/params) and every module request made
// without an active enrollment in a published class, so tests can prove gating.

export const rawClass = (over = {}) => ({
  id: 2, code: 'ARB101', title: 'Arabic for beginners', description: 'Greetings and basics.', kind: 'arabic', status: 'published',
  created_at: '2026-10-01T09:00:00Z', updated_at: '2026-10-01T09:00:00Z', ...over,
})

const VID = 'dQw4w9WgXcQ'
export const rawVideo = (id, over = {}) =>
  audio(id, {
    type: 'vid', title: `Lecture ${id}`, storage_status: 'not_applicable', media_url: null, duration: null,
    playback: { provider: 'youtube', video_id: VID, watch_url: `https://www.youtube.com/watch?v=${VID}`, embed_url: `https://www.youtube-nocookie.com/embed/${VID}` },
    ...over,
  })
export const rawDoc = (id, over = {}) =>
  audio(id, {
    type: 'doc', title: `Workbook ${id}`, media_url: `https://media.example.test/workbook-${id}.pdf`, duration: null,
    file_name: `workbook-${id}.pdf`, content_type: 'application/pdf', size_bytes: 2048, ...over,
  })
export const rawModule = (over = {}) => ({
  id: 20, title: 'Greetings', body: 'Line one.\nLine two <b>not html</b>', order: 1, status: 'published', resources: [], quizzes: [], ...over,
})

export function createLearningBackend({ classes = [rawClass()], modules = {}, enrollments = {} } = {}) {
  const state = {
    classes: structuredClone(classes),
    modules: structuredClone(modules),
    enrollments: structuredClone(enrollments), // classId -> {id, status} | undefined
    calls: [], violations: [], deniedModuleCalls: [], failNext: null, nextId: 6,
  }
  const findClass = (id) => state.classes.find((item) => String(item.id) === String(id))
  const mine = (id) => state.enrollments[id]
  const row = (id) => ({ id: mine(id).id, course_id: Number(id), student_id: 1, status: mine(id).status })
  const log = async (request, params) => {
    const text = ['GET', 'DELETE'].includes(request.method) ? '' : await request.clone().text()
    const u = new URL(request.url)
    const call = { method: request.method, path: u.pathname, search: Object.fromEntries(u.searchParams), body: text ? JSON.parse(text) : null, params }
    state.calls.push(call)
    return call
  }
  const planned = (call) => {
    const p = state.failNext
    if (p && p.method === call.method && call.path.endsWith(p.suffix)) {
      state.failNext = null
      return p.response()
    }
    return null
  }
  const handle = (method, path, fn) =>
    http[method](url(path), async ({ request, params }) => {
      const call = await log(request, params)
      return planned(call) ?? fn(call, params)
    })
  const checkPage = (call) => {
    const allowed = ['page', 'page_size']
    for (const key of Object.keys(call.search)) if (!allowed.includes(key)) state.violations.push(`unexpected query ${key} on ${call.path}`)
  }
  const readable = (id) => findClass(id)?.status === 'published' && mine(id)?.status === 'active'

  const handlers = [
    handle('get', '/quiz/classes/', (call) => {
      checkPage(call)
      const rows = state.classes.filter((item) => item.status === 'published')
      return ok({ count: rows.length, next: null, previous: null, results: rows })
    }),
    handle('get', '/quiz/classes/:id/', (call, params) => (findClass(params.id) ? ok(findClass(params.id)) : fail(404, 'NOT_FOUND', 'Not found.'))),
    handle('get', '/quiz/classes/:id/enrollment/', (call, params) => (mine(params.id) ? ok(row(params.id)) : fail(404, 'NOT_FOUND', 'No enrollment.'))),
    handle('post', '/quiz/classes/:id/enrollment/', (call, params) => {
      if (call.body && Object.keys(call.body).length) state.violations.push(`enroll body ${JSON.stringify(call.body)}`)
      const klass = findClass(params.id)
      if (!klass) return fail(404, 'NOT_FOUND', 'Not found.')
      if (klass.status !== 'published') return fail(409, 'CLASS_NOT_OPEN', 'This class is not open for enrollment.')
      if (!mine(params.id)) state.enrollments[params.id] = { id: state.nextId++, status: 'active' }
      else state.enrollments[params.id].status = 'active' // replay or reactivation: same record
      return ok(row(params.id), 'Enrolled.')
    }),
    handle('delete', '/quiz/classes/:id/enrollment/', (call, params) => {
      if (mine(params.id)) mine(params.id).status = 'withdrawn'
      return mine(params.id) ? ok(row(params.id), 'Withdrawn.') : fail(404, 'NOT_FOUND', 'No enrollment.')
    }),
    handle('get', '/quiz/classes/:id/modules/', (call, params) => {
      checkPage(call)
      if (!readable(params.id)) {
        state.deniedModuleCalls.push(call.path)
        return fail(403, 'NOT_ENROLLED', 'Enroll to read modules.')
      }
      const rows = (state.modules[params.id] ?? []).filter((item) => item.status === 'published')
      return ok({ count: rows.length, next: null, previous: null, results: rows })
    }),
    handle('get', '/quiz/classes/:id/modules/:mid/', (call, params) => {
      if (!readable(params.id)) {
        state.deniedModuleCalls.push(call.path)
        return fail(403, 'NOT_ENROLLED', 'Enroll to read modules.')
      }
      const found = (state.modules[params.id] ?? []).find((item) => String(item.id) === String(params.mid) && item.status === 'published')
      return found ? ok(found) : fail(404, 'NOT_FOUND', 'Not found.')
    }),
  ]
  return { state, handlers, count: (method, suffix) => state.calls.filter((c) => c.method === method && c.path.endsWith(suffix)).length }
}
