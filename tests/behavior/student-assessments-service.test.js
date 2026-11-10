import { describe, expect, test } from 'vitest'
import {
  buildSubmitPayload, findResultForAttempt, isUncertainOutcome, mapAttempt, mapResult,
} from '../../src/features/assessments/student/api/studentAssessmentsApi.js'
import { formatLagos, describeScore } from '../../src/features/assessments/student/lib/format.js'
import { createServerClock, formatRemaining } from '../../src/features/assessments/student/lib/serverClock.js'
import { server } from '../mocks/server.js'
import { http } from 'msw'
import { ok, recorder, resetSession, sessionHandlers, storeRefreshToken, url, useApiOrigin } from '../fixtures/auth.js'
import { page, rawAttempt, rawResult } from '../fixtures/assessments.js'
import { refreshSession } from '../../src/services/api'
import { afterEach, beforeEach } from 'vitest'

beforeEach(useApiOrigin)
afterEach(resetSession)

describe('payload mapping', () => {
  test('orders questions and options and keeps only safe fields (no answer keys)', () => {
    const attempt = mapAttempt(rawAttempt())
    expect(attempt.questions.map((q) => q.id)).toEqual([10, 11])
    expect(attempt.questions[1].options.map((o) => o.id)).toEqual([111, 112, 113, 114])
    expect(attempt).toMatchObject({ id: 123, quizId: 45, status: 'in_progress', serverTime: '2026-10-12T10:00:00Z', expiresAt: '2026-10-12T10:30:00Z' })
    const serialized = JSON.stringify(attempt)
    expect(serialized).not.toMatch(/is_correct|correct_option|isCorrect/)
    for (const question of attempt.questions) {
      expect(Object.keys(question).sort()).toEqual(['id', 'options', 'order', 'points', 'text'])
      for (const option of question.options) expect(Object.keys(option).sort()).toEqual(['id', 'order', 'text'])
    }
  })

  test('submit payload keys are decimal question-ID strings mapped to option IDs; unanswered omitted', () => {
    const { questions } = mapAttempt(rawAttempt())
    expect(buildSubmitPayload(123, questions, { 10: 102 })).toEqual({ attempt_id: 123, answers: { '10': 102 } })
    expect(buildSubmitPayload(123, questions, { 10: 102, 11: 113 })).toEqual({ attempt_id: 123, answers: { '10': 102, '11': 113 } })
    expect(buildSubmitPayload(123, questions, {})).toEqual({ attempt_id: 123, answers: {} })
    // an option that does not belong to the question is never sent
    expect(buildSubmitPayload(123, questions, { 10: 113 }).answers).toEqual({})
    // only attempt_id and answers: no student or score input
    expect(Object.keys(buildSubmitPayload(123, questions, { 10: 102 }))).toEqual(['attempt_id', 'answers'])
  })

  test('result mapping keeps weighted score/total and tolerates legacy rows', () => {
    expect(mapResult(rawResult({ is_correct: true, snapshot: { q: 1 } }))).toEqual({
      id: 9, attemptId: 123, quizId: 45, quizTitle: 'Arabic week 1', status: 'submitted', score: 2, totalPoints: 3,
      submittedAt: '2026-10-12T10:20:00Z', gradedAt: '2026-10-12T10:20:00Z',
    })
    const legacy = mapResult({ id: 2, quiz_title: 'Old', score: 5, total_points: null, attempt_id: null, submitted_at: null })
    expect(legacy).toMatchObject({ attemptId: null, totalPoints: null, score: 5 })
    expect(describeScore(legacy)).toMatch(/5 points \(total unavailable/)
    expect(describeScore(mapResult(rawResult()))).toBe('2 / 3 points')
  })

  test('dates display in Africa/Lagos', () => {
    expect(formatLagos('2026-10-12T20:00:00Z')).toBe('12 Oct 2026, 21:00 WAT')
    expect(formatLagos(null)).toBe('Not set')
  })

  test('transport and availability failures are uncertain; domain rejections are not', () => {
    expect(isUncertainOutcome({ status: 0 })).toBe(true)
    expect(isUncertainOutcome({ status: 503 })).toBe(true)
    expect(isUncertainOutcome({ status: 429 })).toBe(true)
    expect(isUncertainOutcome({ status: 409, code: 'ATTEMPT_EXPIRED' })).toBe(false)
    expect(isUncertainOutcome({ status: 400 })).toBe(false)
  })
})

describe('server clock', () => {
  test('counts down from server_time using only the monotonic clock', () => {
    let mono = 5000
    const clock = createServerClock('2026-10-12T10:00:00Z', '2026-10-12T10:00:30Z', () => mono)
    expect(clock.remainingMs()).toBe(30_000)
    mono += 10_000
    expect(clock.remainingMs()).toBe(20_000)
    mono += 60_000
    expect(clock.remainingMs()).toBe(0)
  })

  test('a reload re-anchors to a fresh server_time and never resets to the full duration', () => {
    let mono = 0
    const first = createServerClock(rawAttempt().server_time, rawAttempt().expires_at, () => mono)
    expect(first.remainingMs()).toBe(30 * 60_000)
    const reloaded = createServerClock('2026-10-12T10:12:00Z', rawAttempt().expires_at, () => mono)
    expect(reloaded.remainingMs()).toBe(18 * 60_000)
  })

  test('device wall-clock changes cannot move the remaining time', () => {
    const clock = createServerClock('2026-10-12T10:00:00Z', '2026-10-12T10:00:30Z', () => 0)
    const before = clock.remainingMs()
    const realNow = Date.now
    Date.now = () => realNow() + 10 * 3600_000
    try {
      expect(clock.remainingMs()).toBe(before)
    } finally {
      Date.now = realNow
    }
  })

  test('invalid timestamps count as expired rather than unlimited', () => {
    expect(createServerClock('nope', 'nope').remainingMs()).toBe(0)
    expect(formatRemaining(90_000)).toBe('01:30')
    expect(formatRemaining(3_725_000)).toBe('1:02:05')
  })
})

describe('result lookup for a submitted attempt', () => {
  test('scans own history pages for the attempt_id', async () => {
    const rec = recorder()
    storeRefreshToken()
    server.use(...sessionHandlers(rec))
    await refreshSession()
    server.use(http.get(url('/quiz/submissions/'), ({ request }) => {
      const pageNumber = new URL(request.url).searchParams.get('page')
      return pageNumber === '1'
        ? ok(page([rawResult({ id: 1, attempt_id: 1 })], { next: 'x' }))
        : ok(page([rawResult({ id: 2, attempt_id: 123 })]))
    }))
    expect((await findResultForAttempt(123)).id).toBe(2)
    expect(await findResultForAttempt(999)).toBeNull()
  })
})
