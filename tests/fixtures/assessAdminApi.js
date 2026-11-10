import { http, HttpResponse } from 'msw'
import { ok, fail, url } from './auth.js'

/**
 * Stateful in-memory stand-in for the D3 admin quiz API (synthetic data only).
 * Mirrors the contract assumptions in adminQuizService.js, including 409
 * QUIZ_IMMUTABLE for grading edits after publication.
 */
export function createQuizBackend({ quizzes = [], results = {} } = {}) {
  const state = {
    quizzes: structuredClone(quizzes),
    results: structuredClone(results),
    calls: [],
    nextId: 100,
    failNext: null, // { method, pattern, response }
  }
  const find = (id) => state.quizzes.find((quiz) => String(quiz.id) === String(id))
  const record = async (request, params) => {
    const text = ['GET', 'DELETE'].includes(request.method) ? '' : await request.clone().text()
    const call = {
      method: request.method,
      path: new URL(request.url).pathname,
      search: Object.fromEntries(new URL(request.url).searchParams),
      body: text ? JSON.parse(text) : null,
      params,
    }
    state.calls.push(call)
    return call
  }
  const guard = (call) => {
    const planned = state.failNext
    if (planned && planned.method === call.method && call.path.includes(planned.pattern)) {
      state.failNext = null
      return planned.response()
    }
    return null
  }
  const withSummary = (quiz) => {
    const { questions, ...rest } = quiz
    return { ...rest, question_count: questions.length, total_points: questions.reduce((sum, q) => sum + q.points, 0) }
  }
  const immutable = () => fail(409, 'QUIZ_IMMUTABLE', 'Published quizzes cannot be edited.')

  const handlers = [
    http.get(url('/quiz/quizzes/'), async ({ request }) => {
      const call = await record(request)
      const blocked = guard(call)
      if (blocked) return blocked
      const { status, page = '1', page_size: pageSize = '20' } = call.search
      const filtered = state.quizzes.filter((quiz) => !status || quiz.status === status)
      const start = (Number(page) - 1) * Number(pageSize)
      return ok({ count: filtered.length, next: null, previous: null, results: filtered.slice(start, start + Number(pageSize)).map(withSummary) })
    }),
    http.post(url('/quiz/quizzes/'), async ({ request }) => {
      const call = await record(request)
      const blocked = guard(call)
      if (blocked) return blocked
      const quiz = { id: state.nextId++, status: 'draft', type: 'arabic', published_at: null, questions: [], ...call.body }
      state.quizzes.push(quiz)
      return ok(withSummary(quiz), 'Saved.', { status: 201 })
    }),
    http.get(url('/quiz/quizzes/:id/'), async ({ request, params }) => {
      const call = await record(request, params)
      const blocked = guard(call)
      if (blocked) return blocked
      const quiz = find(params.id)
      return quiz ? ok(quiz) : fail(404, 'NOT_FOUND', 'Not found.')
    }),
    http.patch(url('/quiz/quizzes/:id/'), async ({ request, params }) => {
      const call = await record(request, params)
      const blocked = guard(call)
      if (blocked) return blocked
      const quiz = find(params.id)
      if (quiz.status !== 'draft' && Object.keys(call.body).some((key) => !['title', 'description'].includes(key))) return immutable()
      Object.assign(quiz, call.body)
      return ok(quiz, 'Saved.')
    }),
    http.delete(url('/quiz/quizzes/:id/'), async ({ request, params }) => {
      const call = await record(request, params)
      const blocked = guard(call)
      if (blocked) return blocked
      state.quizzes = state.quizzes.filter((quiz) => String(quiz.id) !== params.id)
      return new HttpResponse(null, { status: 204 })
    }),
    http.post(url('/quiz/quizzes/:id/questions/'), async ({ request, params }) => {
      const call = await record(request, params)
      const blocked = guard(call)
      if (blocked) return blocked
      const quiz = find(params.id)
      if (quiz.status !== 'draft') return immutable()
      const question = {
        id: state.nextId++,
        ...call.body,
        options: call.body.options.map((option) => ({ id: state.nextId++, ...option })),
      }
      quiz.questions.push(question)
      return ok(question, 'Saved.', { status: 201 })
    }),
    http.patch(url('/quiz/question/:id/'), async ({ request, params }) => {
      const call = await record(request, params)
      const blocked = guard(call)
      if (blocked) return blocked
      const quiz = state.quizzes.find((candidate) => candidate.questions.some((q) => String(q.id) === params.id))
      if (quiz.status !== 'draft') return immutable()
      const question = quiz.questions.find((q) => String(q.id) === params.id)
      Object.assign(question, call.body)
      return ok(question)
    }),
    http.delete(url('/quiz/question/:id/'), async ({ request, params }) => {
      const call = await record(request, params)
      const blocked = guard(call)
      if (blocked) return blocked
      for (const quiz of state.quizzes) quiz.questions = quiz.questions.filter((q) => String(q.id) !== params.id)
      return new HttpResponse(null, { status: 204 })
    }),
    http.post(url('/quiz/quizzes/:id/publish/'), async ({ request, params }) => {
      const call = await record(request, params)
      const blocked = guard(call)
      if (blocked) return blocked
      const quiz = find(params.id)
      quiz.status = 'published'
      quiz.published_at = '2026-10-01T09:00:00Z'
      return ok(quiz, 'Published.')
    }),
    http.post(url('/quiz/quizzes/:id/close/'), async ({ request, params }) => {
      const call = await record(request, params)
      const blocked = guard(call)
      if (blocked) return blocked
      find(params.id).status = 'closed'
      return ok(find(params.id), 'Closed.')
    }),
    http.get(url('/quiz/quizzes/:id/submissions/'), async ({ request, params }) => {
      const call = await record(request, params)
      const blocked = guard(call)
      if (blocked) return blocked
      const rows = state.results[params.id] ?? []
      return ok({ count: rows.length, next: null, previous: null, results: rows })
    }),
    http.get(url('/quiz/submissions/:id/'), async ({ request, params }) => {
      const call = await record(request, params)
      const blocked = guard(call)
      if (blocked) return blocked
      const row = Object.values(state.results).flat().find((r) => String(r.id) === params.id)
      return row ? ok(row) : fail(404, 'NOT_FOUND', 'Not found.')
    }),
  ]
  return { state, handlers, find, callsTo: (method, pattern) => state.calls.filter((c) => c.method === method && c.path.includes(pattern)) }
}

export const options = (correct = 1, texts = ['A', 'B', 'C', 'D']) =>
  texts.map((text, index) => ({ id: 1000 + index * 7 + texts.length, text, order: index + 1, is_correct: index === correct }))

export const sampleQuestion = (id, text, points, order, correct = 1) => ({
  id,
  type: 'mcq',
  text,
  points,
  order,
  options: ['A', 'B', 'C', 'D'].map((letter, index) => ({ id: id * 10 + index, text: `${text} ${letter}`, order: index + 1, is_correct: index === correct })),
})

export const draftQuiz = (overrides = {}) => ({
  id: 5,
  title: 'Arabic week 1',
  description: 'Weekly assessment',
  status: 'draft',
  type: 'arabic',
  time_limit: 30,
  deadline: '2099-10-12T20:00:00Z',
  published_at: null,
  related_event: null,
  questions: [sampleQuestion(10, 'Greeting', 2, 1), sampleQuestion(11, 'Farewell', 3, 2, 0)],
  ...overrides,
})
