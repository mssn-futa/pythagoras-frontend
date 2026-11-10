import { http } from 'msw'
import { ok, url } from './auth.js'

// Synthetic, test-only payloads shaped like the frozen D3 examples. The raw
// shapes deliberately include answer-key fields a defective server might leak,
// so tests prove the student client never uses or renders them (A12).
export const T0 = '2026-10-12T10:00:00Z'
export const T30 = '2026-10-12T10:30:00Z'

export const rawQuestions = () => [
  {
    id: 11, text: 'Second question', points: 1, order: 2, is_correct: true,
    options: [
      { id: 114, text: 'Z', order: 4 }, { id: 111, text: 'W', order: 1 },
      { id: 112, text: 'X', order: 2, is_correct: true }, { id: 113, text: 'Y', order: 3 },
    ],
  },
  {
    id: 10, text: 'First question', points: 2, order: 1, correct_option_id: 102,
    options: [
      { id: 101, text: 'A', order: 1, is_correct: false }, { id: 102, text: 'B', order: 2, is_correct: true },
      { id: 103, text: 'C', order: 3, is_correct: false }, { id: 104, text: 'D', order: 4, is_correct: false },
    ],
  },
]

export const rawAttempt = (over = {}) => ({
  id: 123, quiz_id: 45, status: 'in_progress', started_at: T0, expires_at: T30, server_time: T0,
  questions: rawQuestions(), ...over,
})

export const rawResult = (over = {}) => ({
  id: 9, attempt_id: 123, quiz_id: 45, quiz_title: 'Arabic week 1', status: 'submitted',
  score: 2, total_points: 3, submitted_at: '2026-10-12T10:20:00Z', graded_at: '2026-10-12T10:20:00Z', ...over,
})

export const rawQuiz = (over = {}) => ({
  id: 45, title: 'Arabic week 1', description: 'Weekly assessment', time_limit: 30,
  deadline: '2026-10-12T20:00:00Z', status: 'published', total_points: 3, question_count: 2, ...over,
})

export const page = (results, extra = {}) => ({ count: results.length, next: null, previous: null, results, ...extra })

/** Handlers for the quiz endpoints the pages call; tests override pieces via server.use first. */
export const quizHandler = {
  list: (data, rec) => http.get(url('/quiz/quizzes/'), async ({ request }) => { await rec?.record(request); return ok(data) }),
  detail: (data = rawQuiz(), rec) => http.get(url('/quiz/quizzes/:id/'), async ({ request }) => { await rec?.record(request); return ok(data) }),
  start: (data = rawAttempt(), rec) => http.post(url('/quiz/quizzes/:id/attempts/'), async ({ request }) => { await rec?.record(request); return ok(data, 'Attempt retrieved.') }),
  attempt: (data = rawAttempt(), rec) => http.get(url('/quiz/attempts/:id/'), async ({ request }) => { await rec?.record(request); return ok(data, 'Attempt retrieved.') }),
  result: (data = rawResult(), rec) => http.get(url('/quiz/submissions/:id/'), async ({ request }) => { await rec?.record(request); return ok(data) }),
  history: (data, rec) => http.get(url('/quiz/submissions/'), async ({ request }) => { await rec?.record(request); return ok(data) }),
}
