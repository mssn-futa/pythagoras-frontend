import { http } from 'msw'
import { ok, url } from './auth.js'

// Synthetic, test-only dashboard data shaped like the D0 paginated envelope and
// the D2/D3/D4 list items the feature services map.
export const page = (results, count = results.length, next = null) => ({ count, next, previous: null, results })
export const emptyPage = page([])

export const upcomingEvent = (id, overrides = {}) => ({
  id, title: `Event ${id}`, category: 'jumuah', status: 'published', location: 'Central mosque',
  start_time: '2026-11-20T12:00:00Z', end_time: '2026-11-20T14:00:00Z', ...overrides,
})
export const studentQuiz = (id, overrides = {}) => ({
  id, title: `Quiz ${id}`, description: '', time_limit: 30, deadline: '2036-11-30T20:00:00Z', status: 'published', ...overrides,
})
export const studentClass = (id, overrides = {}) => ({ id, code: `ARB10${id}`, title: `Arabic ${id}`, status: 'published', module_count: 3, ...overrides })
export const submission = (id, overrides = {}) => ({
  id, attempt_id: 100 + id, quiz_id: 40 + id, quiz_title: `Quiz ${40 + id}`, status: 'submitted', score: 2, total_points: 3,
  submitted_at: '2026-11-01T10:20:00Z', graded_at: '2026-11-01T10:20:00Z', ...overrides,
})

function track(calls, request) {
  const u = new URL(request.url)
  calls.push({ method: request.method, path: u.pathname, query: Object.fromEntries(u.searchParams), auth: request.headers.get('authorization') })
}

/**
 * The four student dashboard sources. Each override is a resolver
 * `(request) => Response` (or a plain data object for an ok() page).
 */
export function studentDashboardHandlers(overrides = {}) {
  const calls = []
  const sources = {
    events: ['/dawah/events/', page([upcomingEvent(1), upcomingEvent(2, { title: 'Weekly halaqah', location: '' })])],
    quizzes: ['/quiz/quizzes/', page([studentQuiz(45, { title: 'Arabic week 1' })])],
    classes: ['/quiz/classes/', page([studentClass(2, { title: 'Arabic for beginners' })])],
    results: ['/quiz/submissions/', page([submission(9, { quiz_title: 'Arabic week 1' })], 4)],
  }
  const handlers = Object.entries(sources).map(([key, [path, data]]) =>
    http.get(url(path), async ({ request }) => {
      track(calls, request)
      const override = overrides[key]
      if (typeof override === 'function') return override(request)
      return ok(override ?? data)
    }),
  )
  return { handlers, calls, callsTo: (path) => calls.filter((call) => call.path === path) }
}

export const defaultCounts = Object.freeze({
  students: 120,
  activeStudents: 111,
  publishedEvents: 7,
  quizzes: { published: 3, draft: 2, closed: 5 },
  classes: 4,
  broadcasts: { queued: 1, processing: 2, uncertain: 1 },
  automations: page([{ id: 1, enabled: true }, { id: 2, enabled: false }, { id: 3, enabled: true }]),
})

/**
 * Admin dashboard count sources. `counts` overrides any entry; an entry may be
 * a number, or a resolver `(request) => Response` to fail/hold that source.
 */
export function adminDashboardHandlers(counts = {}) {
  const calls = []
  const c = { ...defaultCounts, ...counts }
  const respond = (value, request) => (typeof value === 'function' ? value(request) : ok(page([], value)))
  const handlers = [
    http.get(url('/accounts/students/'), ({ request }) => {
      track(calls, request)
      const active = new URL(request.url).searchParams.get('is_active') === 'true'
      return respond(active ? c.activeStudents : c.students, request)
    }),
    http.get(url('/dawah/events/'), ({ request }) => {
      track(calls, request)
      return respond(c.publishedEvents, request)
    }),
    http.get(url('/quiz/quizzes/'), ({ request }) => {
      track(calls, request)
      const status = new URL(request.url).searchParams.get('status')
      return respond(typeof c.quizzes === 'function' ? c.quizzes : c.quizzes[status], request)
    }),
    http.get(url('/quiz/classes/'), ({ request }) => {
      track(calls, request)
      return respond(c.classes, request)
    }),
    http.get(url('/dawah/broadcasts/'), ({ request }) => {
      track(calls, request)
      const state = new URL(request.url).searchParams.get('state')
      return respond(typeof c.broadcasts === 'function' ? c.broadcasts : c.broadcasts[state], request)
    }),
    http.get(url('/dawah/automations/'), ({ request }) => {
      track(calls, request)
      return typeof c.automations === 'function' ? c.automations(request) : ok(c.automations)
    }),
  ]
  return { handlers, calls }
}
