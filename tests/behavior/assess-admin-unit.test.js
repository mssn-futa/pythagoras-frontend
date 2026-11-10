import { describe, expect, test } from 'vitest'
import { buildQuestionPayload, buildQuizPayload, mapPage, mapQuestion, mapQuiz, mapResult } from '../../src/features/assessments/admin/adminQuizService.js'
import { formatLagos, isoToLagosInput, lagosInputToIso } from '../../src/features/assessments/admin/dates.js'
import { describeAssessmentError } from '../../src/features/assessments/admin/errors.js'
import {
  blankQuestionDraft, hasErrors, publishBlockers, scoreText, validateQuestionDraft, validateQuizDetails,
} from '../../src/features/assessments/admin/quizRules.js'
import { ApiError } from '../../src/services/api'
import { draftQuiz } from '../fixtures/assessAdminApi.js'

const valid = () => ({
  text: 'Q', points: '2', correctIndex: 1,
  options: ['A', 'B', 'C', 'D'].map((text) => ({ id: null, text })),
})

describe('service mapping', () => {
  test('maps persisted ids, order, points and correctness; sorts by order', () => {
    const raw = draftQuiz({ questions: [{ id: 11, text: 'Second', points: 3, order: 2, options: [{ id: 2, text: 'b', order: 2, is_correct: true }, { id: 1, text: 'a', order: 1, is_correct: false }] }, { id: 10, text: 'First', points: 2, order: 1, options: [] }] })
    const quiz = mapQuiz(raw)
    expect(quiz.questions.map((q) => [q.id, q.order, q.points])).toEqual([[10, 1, 2], [11, 2, 3]])
    expect(quiz.questions[1].options).toEqual([{ id: 1, text: 'a', order: 1, isCorrect: false }, { id: 2, text: 'b', order: 2, isCorrect: true }])
    expect(quiz.totalPoints).toBe(5)
    expect(quiz.timeLimit).toBe(30)
  })

  test('list items use server summary; no questions array means unknown, not zero', () => {
    const quiz = mapQuiz({ id: 1, title: 'x', status: 'published', question_count: 4, total_points: 9 })
    expect([quiz.questionCount, quiz.totalPoints]).toEqual([4, 9])
    const bare = mapQuiz({ id: 2, title: 'y' })
    expect([bare.questionCount, bare.totalPoints]).toEqual([null, null])
  })

  test('result rows use flat student fields; legacy row keeps null denominator', () => {
    expect(mapResult({ id: 9, attempt_id: 123, quiz_id: 45, quiz_title: 'T', score: 2, total_points: 5, student_id: 1, student_name: 'Amina Yusuf', student_email: 'a@example.test' }))
      .toMatchObject({ id: 9, attemptId: 123, quizId: 45, score: 2, totalPoints: 5, studentId: 1, studentName: 'Amina Yusuf', studentEmail: 'a@example.test' })
    expect(mapResult({ id: 1, score: 3, total_points: null, student_id: 4, student_name: 'Bilal O', student_email: 'b@example.test' }))
      .toMatchObject({ totalPoints: null, studentId: 4, studentName: 'Bilal O', attemptId: null })
  })

  test('unknown or missing status fails closed (null), never draft', () => {
    expect(mapQuiz({ id: 1, title: 'x' }).status).toBeNull()
    expect(mapQuiz({ id: 1, title: 'x', status: 'archived' }).status).toBeNull()
    expect(mapQuiz({ id: 1, title: 'x', status: 'published' }).status).toBe('published')
  })

  test('non-paginated data is a contract error, not an empty list', () => {
    const bad = [[], { results: [] }, { count: 1 }, null, { count: 'x', results: [] }]
    for (const value of bad) expect(() => mapPage(value, mapQuiz)).toThrow(/unexpected response/)
    expect(mapPage({ count: 0, results: [] }, mapQuiz)).toMatchObject({ count: 0, results: [] })
    expect(() => mapQuiz([])).toThrow(/unexpected response/)
  })

  test('questions that are not 4-option MCQ with one correct are flagged legacy', () => {
    const opts = (n, correct = 1) => Array.from({ length: n }, (_, i) => ({ id: i + 1, text: String(i), order: i + 1, is_correct: i < correct }))
    expect(mapQuestion({ id: 1, text: 'q', type: 'mcq', points: 1, order: 1, options: opts(4) }).legacy).toBe(false)
    expect(mapQuestion({ id: 1, text: 'q', type: 'mcq', points: 1, order: 1, options: opts(3) }).legacy).toBe(true)
    expect(mapQuestion({ id: 1, text: 'q', type: 'mcq', points: 1, order: 1, options: opts(4, 2) }).legacy).toBe(true)
    expect(mapQuestion({ id: 1, text: 'q', type: 'text', points: 1, order: 1, options: [] }).legacy).toBe(true)
  })

  test('request payloads follow the D3 examples', () => {
    expect(buildQuizPayload({ title: ' Arabic week 1 ', description: ' d ', timeLimit: 30, deadline: '2026-10-12T20:00:00Z' }))
      .toEqual({ title: 'Arabic week 1', description: 'd', time_limit: 30, deadline: '2026-10-12T20:00:00Z' })
    expect(buildQuizPayload({ title: 't', description: '', timeLimit: null, deadline: null, relatedEvent: null }).related_event).toBeNull()
    expect(buildQuestionPayload({ text: ' Question ', points: 2, order: 1, correctIndex: 1, options: ['A', 'B', 'C', 'D'].map((text) => ({ id: null, text })) })).toEqual({
      type: 'mcq', text: 'Question', points: 2, order: 1,
      options: [
        { text: 'A', order: 1, is_correct: false }, { text: 'B', order: 2, is_correct: true },
        { text: 'C', order: 3, is_correct: false }, { text: 'D', order: 4, is_correct: false },
      ],
    })
  })

  test('question payload never carries option ids (D3 question body only)', () => {
    const payload = buildQuestionPayload({ text: 'Q', points: 1, order: 3, correctIndex: 0, options: [{ id: 7, text: 'A' }, { id: 8, text: 'B' }, { id: 9, text: 'C' }, { id: 10, text: 'D' }] })
    expect(payload.options.every((o) => !('id' in o))).toBe(true)
    expect(payload.order).toBe(3)
  })
})

describe('question validation (D3 authoring rules)', () => {
  test('a valid question has no errors', () => {
    expect(hasErrors(validateQuestionDraft(valid()))).toBe(false)
    expect(hasErrors(validateQuestionDraft(blankQuestionDraft()))).toBe(true)
    expect(blankQuestionDraft().points).toBe('1') // default points 1
  })

  test('requires question text', () => {
    expect(validateQuestionDraft({ ...valid(), text: '   ' }).text).toBeTruthy()
  })

  test.each(['0', '-1', '1.5', 'abc', '', '2e1'])('points %j is rejected', (points) => {
    expect(validateQuestionDraft({ ...valid(), points }).points).toBeTruthy()
  })

  test('exactly four options', () => {
    const draft = valid()
    expect(validateQuestionDraft({ ...draft, options: draft.options.slice(0, 3) }).options).toBeTruthy()
    expect(validateQuestionDraft({ ...draft, options: [...draft.options, { text: 'E' }] }).options).toBeTruthy()
  })

  test('empty options are flagged per option', () => {
    const draft = valid()
    draft.options[2].text = '  '
    expect(validateQuestionDraft(draft).optionTexts[2]).toBeTruthy()
  })

  test('duplicate options are rejected after normalization (trim, inner whitespace, case)', () => {
    const draft = valid()
    draft.options[0].text = 'Good  morning'
    draft.options[3].text = '  good morning '
    expect(validateQuestionDraft(draft).optionTexts[3]).toMatch(/option A/)
    draft.options[3].text = '  b '
    const errors = validateQuestionDraft(draft)
    expect(errors.optionTexts[3]).toMatch(/option B/)
    expect(errors.optionTexts[1]).toBeUndefined()
  })

  test('exactly one correct option must be selected', () => {
    expect(validateQuestionDraft({ ...valid(), correctIndex: null }).correct).toBeTruthy()
    expect(validateQuestionDraft({ ...valid(), correctIndex: 4 }).correct).toBeTruthy()
  })
})

describe('quiz details and publish readiness', () => {
  test('title required; time limit 1-180 whole minutes when given', () => {
    expect(validateQuizDetails({ title: ' ', time_limit: '' }).title).toBeTruthy()
    expect(validateQuizDetails({ title: 'x', time_limit: '' })).toEqual({})
    for (const bad of ['0', '181', '2.5', 'abc']) expect(validateQuizDetails({ title: 'x', time_limit: bad }).time_limit).toBeTruthy()
    expect(validateQuizDetails({ title: 'x', time_limit: '', deadline: '2026-02-30T10:00' }).deadline).toBeTruthy()
    for (const good of ['1', '180']) expect(validateQuizDetails({ title: 'x', time_limit: good })).toEqual({})
  })

  test('blockers: empty quiz, missing time/deadline, past deadline', () => {
    const now = Date.parse('2026-10-01T00:00:00Z')
    expect(publishBlockers(mapQuiz(draftQuiz({ deadline: '2026-12-01T00:00:00Z' })), { now })).toEqual([])
    expect(publishBlockers(mapQuiz({ ...draftQuiz({ questions: [], time_limit: null, deadline: null }) }), { now })).toHaveLength(3)
    expect(publishBlockers(mapQuiz(draftQuiz({ deadline: '2026-09-01T00:00:00Z' })), { now })).toEqual(['The deadline must be in the future.'])
    const legacy = draftQuiz({ deadline: '2026-12-01T00:00:00Z', questions: [{ id: 1, type: 'text', text: 'old', points: 1, order: 1, options: [] }] })
    expect(publishBlockers(mapQuiz(legacy), { now })[0]).toMatch(/Question 1 is a legacy question/)
  })

  test('score text uses the weighted denominator, not a question count', () => {
    expect(scoreText({ score: 2, totalPoints: 5 })).toBe('2 / 5')
    expect(scoreText({ score: 2, totalPoints: null })).toMatch(/total unavailable/)
    expect(scoreText({ score: null, totalPoints: null })).toBe('—')
  })
})

describe('Africa/Lagos dates', () => {
  test('input is Lagos wall time (UTC+1) converted to UTC with Z', () => {
    expect(lagosInputToIso('2026-10-12T21:00')).toBe('2026-10-12T20:00:00Z')
    expect(lagosInputToIso('2026-01-01T00:30')).toBe('2025-12-31T23:30:00Z')
    expect(isoToLagosInput('2026-10-12T20:00:00Z')).toBe('2026-10-12T21:00')
    expect(lagosInputToIso('')).toBeNull()
    expect(lagosInputToIso('12-10-2026')).toBeNull()
    for (const impossible of ['2026-02-30T10:00', '2026-13-01T10:00', '2026-10-12T25:00', '2026-10-12T10:61']) expect(lagosInputToIso(impossible)).toBeNull()
    expect(isoToLagosInput(null)).toBe('')
  })

  test('display is in Lagos regardless of the machine zone', () => {
    expect(formatLagos('2026-10-12T23:30:00Z')).toMatch(/13 Oct 2026/)
    expect(formatLagos(null)).toBe('—')
  })
})

describe('error mapping', () => {
  test('QUIZ_IMMUTABLE gets actionable text', () => {
    const described = describeAssessmentError(new ApiError({ status: 409, code: 'QUIZ_IMMUTABLE', message: 'x' }))
    expect(described.immutable).toBe(true)
    expect(described.message).toMatch(/title and description/)
  })

  test('field errors split from unknown ones; network failure says nothing was saved', () => {
    const described = describeAssessmentError(new ApiError({ status: 400, code: 'VALIDATION_ERROR', message: 'Correct the highlighted fields.', fields: { title: ['Required.'], deadline: ['Must be in the future.'] } }), ['title'])
    expect(described.fields).toEqual({ title: ['Required.'] })
    expect(described.message).toMatch(/Must be in the future/)
    expect(describeAssessmentError(new ApiError({ status: 0, code: 'NETWORK_ERROR', message: 'n' })).message).toMatch(/Nothing was saved/)
    expect(describeAssessmentError(new ApiError({ status: 0, code: 'TIMEOUT', message: 't' })).message).toMatch(/may have been saved; reload/)
  })
})
