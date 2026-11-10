import { configure, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { delay, http, HttpResponse } from 'msw'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { server } from '../mocks/server.js'
import { act } from '@testing-library/react'
import { fail, ok, recorder, resetSession, sessionHandlers, storeRefreshToken, url, useApiOrigin } from '../fixtures/auth.js'
import { TestApp } from '../fixtures/TestApp.jsx'
import { page, quizHandler, rawAttempt, rawQuiz, rawResult } from '../fixtures/assessments.js'

configure({ asyncUtilTimeout: 5000 })
vi.setConfig({ testTimeout: 20000 })
beforeEach(useApiOrigin)
afterEach(resetSession)

const location = () => screen.getByTestId('location').textContent

/** Signs in through session restoration and mounts the real app at `path`. */
function openAt(path, ...handlers) {
  const rec = recorder()
  server.use(...sessionHandlers(rec), ...handlers)
  storeRefreshToken()
  render(<TestApp path={path} />)
  return rec
}

const submitCalls = (rec) => rec.calls.filter((call) => call.method === 'POST' && call.path === '/quiz/submissions/')

async function answerBoth(actor) {
  await actor.click(await screen.findByRole('radio', { name: 'B' }))
  await actor.click(screen.getByRole('button', { name: 'Next' }))
  await actor.click(screen.getByRole('radio', { name: 'X' }))
  await actor.click(screen.getByRole('button', { name: 'Review answers' }))
}

describe('discovery, instructions and start', () => {
  test('lists available quizzes with Lagos deadline and links to the intro', async () => {
    const rec = recorder()
    openAt('/dawah/quizzes', quizHandler.list(page([rawQuiz()]), rec), quizHandler.detail())
    expect(await screen.findByRole('heading', { name: 'Arabic week 1' })).toBeVisible()
    expect(screen.getByText('30 minutes')).toBeVisible()
    expect(screen.getByText('3 points')).toBeVisible()
    expect(screen.getByText('Closes 12 Oct 2026, 21:00 WAT')).toBeVisible()
    expect(rec.calls).toHaveLength(1)
    await userEvent.setup().click(screen.getByRole('link', { name: 'View Arabic week 1' }))
    expect(location()).toBe('/dawah/quizzes/45')
  })

  test('empty and error states', async () => {
    openAt('/dawah/quizzes', quizHandler.list(page([])))
    expect(await screen.findByText('No quizzes are open right now')).toBeVisible()
  })

  test('list failure offers retry', async () => {
    let calls = 0
    openAt('/dawah/quizzes', http.get(url('/quiz/quizzes/'), () => (++calls === 1 ? fail(503, 'SERVICE_UNAVAILABLE', 'Down.') : ok(page([rawQuiz()])))))
    expect(await screen.findByRole('alert')).toHaveTextContent('Down.')
    await userEvent.setup().click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByRole('heading', { name: 'Arabic week 1' })).toBeVisible()
  })

  test('intro shows duration, deadline, points, attempt policy and consequences', async () => {
    openAt('/dawah/quizzes/45', quizHandler.detail())
    expect(await screen.findByRole('heading', { name: 'Arabic week 1' })).toBeVisible()
    expect(screen.getByText('30 minutes')).toBeVisible()
    expect(screen.getByText('12 Oct 2026, 21:00 WAT')).toBeVisible()
    expect(screen.getByText('3 points')).toBeVisible()
    expect(screen.getByText('One attempt only')).toBeVisible()
    expect(screen.getByText(/after the end time is rejected and not graded/)).toBeVisible()
  })

  test('hidden or closed quiz shows a clear unavailable message', async () => {
    openAt('/dawah/quizzes/45', http.get(url('/quiz/quizzes/45/'), () => fail(404, 'NOT_FOUND', 'Not found.')))
    expect(await screen.findByRole('alert')).toHaveTextContent(/not available/)
  })

  test('start sends exactly one POST and opens the server attempt', async () => {
    const start = recorder()
    openAt('/dawah/quizzes/45', quizHandler.detail(), quizHandler.start(rawAttempt(), start), quizHandler.attempt())
    const actor = userEvent.setup()
    await actor.click(await screen.findByRole('button', { name: 'Start or continue quiz' }))
    expect(await screen.findByText(/Question 1 of 2/)).toBeVisible()
    expect(location()).toBe('/dawah/attempts/123')
    expect(start.calls.filter((call) => call.method === 'POST' && call.path === '/quiz/quizzes/45/attempts/')).toHaveLength(1)
    expect(start.calls[0].body).toEqual({})
  })

  test('start network failure is retryable and never creates a second client attempt', async () => {
    let posts = 0
    const rec = openAt(
      '/dawah/quizzes/45',
      quizHandler.detail(),
      http.post(url('/quiz/quizzes/45/attempts/'), () => (++posts === 1 ? HttpResponse.error() : ok(rawAttempt()))),
      quizHandler.attempt(),
    )
    const actor = userEvent.setup()
    await actor.click(await screen.findByRole('button', { name: 'Start or continue quiz' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/Unable to reach the server/)
    await actor.click(screen.getByRole('button', { name: 'Try starting again' }))
    expect(await screen.findByText(/Question 1 of 2/)).toBeVisible()
    expect(posts).toBe(2)
    expect(rec).toBeDefined()
  })
})

describe('taking and submitting', () => {
  const attemptHandlers = () => [quizHandler.attempt(), quizHandler.detail()]

  test('start → answer → submit sends option IDs keyed by question-ID strings, then shows the persisted result', async () => {
    const rec = recorder()
    openAt('/dawah/attempts/123', ...attemptHandlers(),
      http.post(url('/quiz/submissions/'), async ({ request }) => { await rec.record(request); return ok(rawResult(), 'Result saved.') }),
      quizHandler.result(rawResult()))
    const actor = userEvent.setup()
    expect(await screen.findByText(/Question 1 of 2/)).toBeVisible()
    expect(await screen.findByRole('heading', { name: 'Arabic week 1' })).toBeVisible()
    expect(screen.getByRole('timer')).toHaveTextContent(/^(29:5\d|30:00)$/)
    await answerBoth(actor)
    expect(screen.getByText('2 answers selected', { exact: false })).toBeVisible()
    await actor.click(screen.getByRole('button', { name: 'Confirm and submit' }))

    expect(await screen.findByTestId('result-score')).toHaveTextContent('2 / 3 points')
    expect(location()).toBe('/profile/results/9')
    expect(submitCalls(rec)).toHaveLength(1)
    expect(submitCalls(rec)[0].body).toEqual({ attempt_id: 123, answers: { '10': 102, '11': 112 } })
    expect(screen.getAllByText('12 Oct 2026, 11:20 WAT').length).toBeGreaterThan(0)
  })

  test('unanswered questions are listed before submission and omitted from the payload', async () => {
    const rec = recorder()
    openAt('/dawah/attempts/123', ...attemptHandlers(),
      http.post(url('/quiz/submissions/'), async ({ request }) => { await rec.record(request); return ok(rawResult({ score: 2 })) }),
      quizHandler.result())
    const actor = userEvent.setup()
    await actor.click(await screen.findByRole('radio', { name: 'B' }))
    await actor.click(screen.getByRole('button', { name: 'Review' }))
    expect(screen.getByRole('alert')).toHaveTextContent('1 question not answered. Unanswered questions score zero.')
    expect(screen.getByText('Not answered')).toBeVisible()
    await actor.click(screen.getByRole('button', { name: 'Go to question 2' }))
    expect(screen.getByText(/Question 2 of 2/)).toBeVisible()
    await actor.click(screen.getByRole('button', { name: 'Review' }))
    await actor.click(screen.getByRole('button', { name: 'Confirm and submit' }))
    await screen.findByTestId('result-score')
    expect(submitCalls(rec)[0].body).toEqual({ attempt_id: 123, answers: { '10': 102 } })
  })

  test('network failure after submit: retry replays the identical frozen payload and shows the saved result; no new attempt', async () => {
    const rec = recorder()
    let posts = 0
    openAt('/dawah/attempts/123', ...attemptHandlers(),
      http.post(url('/quiz/submissions/'), async ({ request }) => {
        await rec.record(request)
        // The server accepted the first request but the response was lost.
        return ++posts === 1 ? HttpResponse.error() : ok(rawResult(), 'Result saved.')
      }),
      http.post(url('/quiz/quizzes/:id/attempts/'), async ({ request }) => { await rec.record(request); return ok(rawAttempt()) }),
      quizHandler.result())
    const actor = userEvent.setup()
    await actor.click(await screen.findByRole('radio', { name: 'B' }))
    await actor.click(screen.getByRole('button', { name: 'Review' }))
    await actor.click(screen.getByRole('button', { name: 'Confirm and submit' }))

    expect(await screen.findByText("We couldn't confirm your submission.")).toBeVisible()
    // Answers are locked while the outcome is uncertain, so the payload cannot drift.
    expect(screen.getByRole('button', { name: 'Confirm and submit' })).toBeDisabled()
    await actor.click(screen.getByRole('button', { name: 'Retry submission' }))

    expect(await screen.findByTestId('result-score')).toHaveTextContent('2 / 3 points')
    const submits = submitCalls(rec)
    expect(submits).toHaveLength(2)
    expect(submits[1].body).toEqual(submits[0].body)
    expect(rec.calls.filter((call) => call.path.endsWith('/attempts/') && call.method === 'POST')).toEqual([])
  })

  test('server error on submit is also treated as uncertain and retryable', async () => {
    let posts = 0
    openAt('/dawah/attempts/123', ...attemptHandlers(),
      http.post(url('/quiz/submissions/'), () => (++posts === 1 ? fail(503, 'SERVICE_UNAVAILABLE', 'Down.') : ok(rawResult()))),
      quizHandler.result())
    const actor = userEvent.setup()
    await actor.click(await screen.findByRole('button', { name: 'Review' }))
    await actor.click(screen.getByRole('button', { name: 'Confirm and submit' }))
    await actor.click(await screen.findByRole('button', { name: 'Retry submission' }))
    expect(await screen.findByTestId('result-score')).toBeVisible()
  })

  test('409 SUBMISSION_CONFLICT keeps the first saved result and links to it', async () => {
    const lookup = recorder()
    openAt('/dawah/attempts/123', ...attemptHandlers(),
      http.post(url('/quiz/submissions/'), () => fail(409, 'SUBMISSION_CONFLICT', 'Different answers already saved.')),
      quizHandler.history(page([rawResult()]), lookup),
      quizHandler.result())
    const actor = userEvent.setup()
    await actor.click(await screen.findByRole('button', { name: 'Review' }))
    await actor.click(screen.getByRole('button', { name: 'Confirm and submit' }))
    expect(await screen.findByText('A different set of answers was already saved for this attempt.')).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Retry submission' })).toBeNull()
    await actor.click(screen.getByRole('button', { name: 'View saved result' }))
    expect(await screen.findByTestId('result-score')).toHaveTextContent('2 / 3 points')
    expect(location()).toBe('/profile/results/9')
  })

  test('ATTEMPT_EXPIRED during submit shows the expired state, never a fabricated result', async () => {
    const rec = recorder()
    openAt('/dawah/attempts/123', ...attemptHandlers(),
      http.post(url('/quiz/submissions/'), async ({ request }) => { await rec.record(request); return fail(409, 'ATTEMPT_EXPIRED', 'Time is up.') }))
    const actor = userEvent.setup()
    await actor.click(await screen.findByRole('radio', { name: 'B' }))
    await actor.click(screen.getByRole('button', { name: 'Review' }))
    await actor.click(screen.getByRole('button', { name: 'Confirm and submit' }))
    expect(await screen.findByRole('heading', { name: 'Time is up' })).toBeVisible()
    expect(screen.getByText(/no grade/)).toBeVisible()
    expect(screen.queryByTestId('result-score')).toBeNull()
    expect(submitCalls(rec)).toHaveLength(1)
  })

  test('validation rejection unfreezes the payload so answers can be corrected', async () => {
    const rec = recorder()
    let posts = 0
    openAt('/dawah/attempts/123', ...attemptHandlers(),
      http.post(url('/quiz/submissions/'), async ({ request }) => {
        await rec.record(request)
        return ++posts === 1 ? fail(400, 'VALIDATION_ERROR', 'Invalid answers.') : ok(rawResult())
      }),
      quizHandler.result())
    const actor = userEvent.setup()
    await actor.click(await screen.findByRole('radio', { name: 'B' }))
    await actor.click(screen.getByRole('button', { name: 'Review' }))
    await actor.click(screen.getByRole('button', { name: 'Confirm and submit' }))
    expect(await screen.findByText(/Nothing was saved/)).toBeVisible()
    await actor.click(screen.getByRole('button', { name: 'Go to question 1' }))
    await actor.click(screen.getByRole('radio', { name: 'C' }))
    await actor.click(screen.getByRole('button', { name: 'Review' }))
    await actor.click(screen.getByRole('button', { name: 'Confirm and submit' }))
    await screen.findByTestId('result-score')
    expect(submitCalls(rec).map((call) => call.body.answers)).toEqual([{ '10': 102 }, { '10': 103 }])
  })

  test('countdown reaching zero auto-submits once (best effort) and shows the server verdict', async () => {
    const rec = recorder()
    const soon = rawAttempt({ expires_at: '2026-10-12T10:00:01Z' })
    openAt('/dawah/attempts/123', quizHandler.attempt(soon), quizHandler.detail(),
      http.post(url('/quiz/submissions/'), async ({ request }) => { await rec.record(request); return fail(409, 'ATTEMPT_EXPIRED', 'Late.') }))
    await userEvent.setup().click(await screen.findByRole('radio', { name: 'B' }))
    expect(await screen.findByRole('heading', { name: 'Time is up' }, { timeout: 4000 })).toBeVisible()
    expect(submitCalls(rec)).toHaveLength(1)
    expect(submitCalls(rec)[0].body).toEqual({ attempt_id: 123, answers: { '10': 102 } })
  })
})

describe('reload and existing attempts', () => {
  test('opening the attempt URL resumes the server attempt without a start request, anchored to server_time', async () => {
    const rec = recorder()
    // Reloaded at 10:12 by the server clock: 18 minutes remain, not the full 30.
    openAt('/dawah/attempts/123',
      quizHandler.attempt(rawAttempt({ server_time: '2026-10-12T10:12:00Z' }), rec), quizHandler.detail(),
      http.post(url('/quiz/quizzes/:id/attempts/'), async ({ request }) => { await rec.record(request); return ok(rawAttempt()) }))
    expect(await screen.findByText(/Question 1 of 2/)).toBeVisible()
    expect(screen.getByRole('timer')).toHaveTextContent(/^(17:5\d|18:00)$/)
    expect(rec.calls.filter((call) => call.method === 'POST')).toEqual([])
  })

  test('an attempt already past expiry shows the expired state with no questions', async () => {
    openAt('/dawah/attempts/123', quizHandler.attempt(rawAttempt({ server_time: '2026-10-12T10:31:00Z' })))
    expect(await screen.findByRole('heading', { name: 'Time is up' })).toBeVisible()
    expect(screen.queryByRole('radio')).toBeNull()
  })

  test('an expired status from the server shows the expired state', async () => {
    openAt('/dawah/attempts/123', quizHandler.attempt(rawAttempt({ status: 'expired', questions: [] })))
    expect(await screen.findByRole('heading', { name: 'Time is up' })).toBeVisible()
  })

  test('a submitted attempt reloads to its saved result from history, without resubmitting', async () => {
    const rec = recorder()
    openAt('/dawah/attempts/123',
      quizHandler.attempt(rawAttempt({ status: 'submitted', questions: [] })),
      quizHandler.history(page([rawResult({ id: 4, attempt_id: 7 }), rawResult()]), rec))
    expect(await screen.findByTestId('result-score')).toHaveTextContent('2 / 3 points')
    expect(rec.calls.map((call) => call.method)).toEqual(['GET'])
  })

  test('another student\'s or missing attempt reports not available', async () => {
    openAt('/dawah/attempts/123', http.get(url('/quiz/attempts/123/'), () => fail(404, 'NOT_FOUND', 'Not found.')))
    expect(await screen.findByRole('alert')).toHaveTextContent(/not available/)
  })

  test('permission errors are explained', async () => {
    openAt('/dawah/attempts/123', http.get(url('/quiz/attempts/123/'), () => fail(403, 'PERMISSION_DENIED', 'No.')))
    expect(await screen.findByRole('alert')).toHaveTextContent('You do not have access to this quiz.')
  })
})

describe('history and no answer keys', () => {
  test('history lists own results with weighted score and Lagos time, and paginates', async () => {
    const rec = recorder()
    openAt('/profile/results', http.get(url('/quiz/submissions/'), async ({ request }) => {
      await rec.record(request)
      const pageNumber = new URL(request.url).searchParams.get('page')
      return pageNumber === '2'
        ? ok(page([rawResult({ id: 3, quiz_title: 'Older quiz', score: 1, total_points: 5 })], { previous: 'x' }))
        : ok(page([rawResult()], { next: 'y', count: 2 }))
    }))
    expect(await screen.findByText('2 / 3 points')).toBeVisible()
    expect(screen.getByText('Submitted 12 Oct 2026, 11:20 WAT')).toBeVisible()
    const actor = userEvent.setup()
    await actor.click(screen.getByRole('button', { name: 'Next page' }))
    expect(await screen.findByText('1 / 5 points')).toBeVisible()
    expect(location()).toBe('/profile/results?page=2')
    expect(rec.calls[1].path).toBe('/quiz/submissions/')
  })

  test('history empty and error states', async () => {
    openAt('/profile/results', quizHandler.history(page([])))
    expect(await screen.findByText('No results yet')).toBeVisible()
  })

  test('history failure shows an error', async () => {
    openAt('/profile/results', http.get(url('/quiz/submissions/'), () => fail(403, 'PERMISSION_DENIED', 'No.')))
    expect(await screen.findByRole('alert')).toHaveTextContent('You do not have access to this quiz.')
  })

  test('no answer-key field is rendered or assumed anywhere in the student flow', async () => {
    openAt('/dawah/attempts/123', quizHandler.attempt(), quizHandler.detail())
    const actor = userEvent.setup()
    await screen.findByText(/Question 1 of 2/)
    const radios = screen.getAllByRole('radio')
    expect(radios).toHaveLength(4)
    // Selecting the leaked "correct" option looks identical to selecting any other.
    const className = (name) => screen.getByRole('radio', { name }).closest('label').className
    expect(className('B')).toBe(className('A'))
    await actor.click(screen.getByRole('radio', { name: 'B' }))
    const html = document.body.innerHTML
    expect(html).not.toMatch(/is_correct|correct_option|isCorrect|correctAnswer/)
    expect(within(document.body).queryByText(/incorrect|wrong answer/i)).toBeNull()
  })

  test('result view never shows a correct answer or a pass/fail verdict', async () => {
    openAt('/profile/results/9', quizHandler.result(rawResult({ is_correct: true, correct_option_id: 102 })))
    await screen.findByTestId('result-score')
    expect(document.body.innerHTML).not.toMatch(/is_correct|correct_option/)
    expect(screen.queryByText(/pass|fail/i)).toBeNull()
  })
})

const iso = (offsetMs) => new Date(Date.now() + offsetMs).toISOString()
const liveText = (kind) => document.querySelector(`[aria-live="${kind}"]`)?.textContent
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

describe('timing authority under latency', () => {
  test('auto-submit is sent before expires_at, with a lead margin, after a slow attempt response', async () => {
    const seen = []
    const expiresMs = Date.now() + 6000
    openAt('/dawah/attempts/123',
      http.get(url('/quiz/attempts/123/'), async () => {
        await delay(400) // simulated latency: server_time is already stale on arrival
        return ok(rawAttempt({ server_time: iso(-200), expires_at: new Date(expiresMs).toISOString() }))
      }),
      http.post(url('/quiz/submissions/'), async ({ request }) => {
        const at = Date.now()
        await delay(100) // let the page render the announcement made just before sending
        seen.push({ at, announcement: liveText('assertive'), body: await request.json() })
        return fail(409, 'ATTEMPT_EXPIRED', 'Late.')
      }))
    await userEvent.setup().click(await screen.findByRole('radio', { name: 'B' }))
    await screen.findByRole('heading', { name: 'Time is up' }, { timeout: 9000 })
    expect(seen).toHaveLength(1)
    // Sent at least ~2s early (margin is 3s), never at or after expiry.
    expect(expiresMs - seen[0].at).toBeGreaterThan(1500)
    expect(seen[0].announcement).toBe('Time is almost up. Submitting your answers now.')
    expect(seen[0].body).toEqual({ attempt_id: 123, answers: { '10': 102 } })
  }, 15000)

  test('reaching zero fires the submit exactly once', async () => {
    let posts = 0
    openAt('/dawah/attempts/123',
      quizHandler.attempt(rawAttempt({ server_time: iso(0), expires_at: iso(1000) })),
      http.post(url('/quiz/submissions/'), () => { posts += 1; return fail(409, 'ATTEMPT_EXPIRED', 'Late.') }))
    await screen.findByRole('heading', { name: 'Time is up' })
    await pause(1800)
    expect(posts).toBe(1)
  })

  test.each([
    [299_000, '5 minutes remaining.'],
    [59_000, '1 minute remaining.'],
    [9_000, '10 seconds remaining.'],
  ])('announces %i ms left politely: %s', async (left, text) => {
    openAt('/dawah/attempts/123', quizHandler.attempt(rawAttempt({ server_time: iso(0), expires_at: iso(left) })))
    await screen.findByText(/Question 1 of 2/)
    await vi.waitFor(() => expect(liveText('polite')).toBe(text), { timeout: 3000 })
    expect(liveText('assertive')).toBe('')
  })
})

describe('keyboard focus', () => {
  test('moves focus to the new question legend on Next and Previous', async () => {
    openAt('/dawah/attempts/123', quizHandler.attempt())
    const actor = userEvent.setup()
    await screen.findByText(/Question 1 of 2/)
    await actor.click(screen.getByRole('button', { name: 'Next' }))
    expect(document.activeElement.tagName).toBe('LEGEND')
    expect(document.activeElement).toHaveTextContent('Second question')
    await actor.click(screen.getByRole('button', { name: 'Previous' }))
    expect(document.activeElement).toHaveTextContent('First question')
  })
})

describe('re-sync on visibility, focus and online', () => {
  test.each([
    ['focus', () => window.dispatchEvent(new Event('focus'))],
    ['online', () => window.dispatchEvent(new Event('online'))],
    ['visibilitychange', () => {
      Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
      document.dispatchEvent(new Event('visibilitychange'))
    }],
  ])('%s refetches the attempt, re-anchors the clock and keeps answers', async (_name, fire) => {
    let gets = 0
    openAt('/dawah/attempts/123', http.get(url('/quiz/attempts/123/'), () => {
      gets += 1
      // The first read is at 10:00; every later read says 10:20 on the server clock.
      return ok(rawAttempt({ server_time: gets === 1 ? '2026-10-12T10:00:00Z' : '2026-10-12T10:20:00Z' }))
    }))
    const actor = userEvent.setup()
    await actor.click(await screen.findByRole('radio', { name: 'B' }))
    expect(screen.getByRole('timer')).toHaveTextContent(/^(30:00|29:5\d)$/)
    act(() => fire())
    await vi.waitFor(() => expect(screen.getByRole('timer')).toHaveTextContent(/^(10:00|09:5\d)$/))
    expect(gets).toBe(2)
    expect(screen.getByRole('radio', { name: 'B' })).toBeChecked()
  })

  test('a refetch showing the attempt was submitted moves to the saved result', async () => {
    let gets = 0
    openAt('/dawah/attempts/123',
      http.get(url('/quiz/attempts/123/'), () => ok(++gets === 1 ? rawAttempt() : rawAttempt({ status: 'submitted', submission_id: 9, questions: [] }))),
      quizHandler.result())
    await screen.findByText(/Question 1 of 2/)
    act(() => window.dispatchEvent(new Event('focus')))
    expect(await screen.findByTestId('result-score')).toHaveTextContent('2 / 3 points')
  })

  test('a refetch showing expiry shows the expired state', async () => {
    let gets = 0
    openAt('/dawah/attempts/123',
      http.get(url('/quiz/attempts/123/'), () => ok(++gets === 1 ? rawAttempt() : rawAttempt({ status: 'expired', questions: [] }))))
    await screen.findByText(/Question 1 of 2/)
    act(() => window.dispatchEvent(new Event('focus')))
    expect(await screen.findByRole('heading', { name: 'Time is up' })).toBeVisible()
  })

  test('a failed refetch keeps the current clock and answers', async () => {
    let gets = 0
    openAt('/dawah/attempts/123', http.get(url('/quiz/attempts/123/'), () => (++gets === 1 ? ok(rawAttempt()) : HttpResponse.error())))
    await userEvent.setup().click(await screen.findByRole('radio', { name: 'B' }))
    act(() => window.dispatchEvent(new Event('focus')))
    await vi.waitFor(() => expect(gets).toBe(2))
    await pause(50)
    expect(screen.getByRole('radio', { name: 'B' })).toBeChecked()
  })
})

describe('submit edge cases', () => {
  test('a submit that resolves after the student navigated away does not navigate back', async () => {
    openAt('/dawah/attempts/123', quizHandler.attempt(),
      http.post(url('/quiz/submissions/'), async () => { await delay(500); return ok(rawResult()) }))
    const actor = userEvent.setup()
    await actor.click(await screen.findByRole('button', { name: 'Review' }))
    await actor.click(screen.getByRole('button', { name: 'Confirm and submit' }))
    await actor.click(screen.getByRole('link', { name: 'Home' }))
    expect(location()).toBe('/')
    await pause(900)
    expect(location()).toBe('/')
  })

  test.each([
    [403, 'PERMISSION_DENIED', /no longer have access/],
    [404, 'NOT_FOUND', /couldn't find this attempt/],
    [409, 'CONFLICT', /did not accept this submission: Odd state\./],
  ])('%i on submit shows a specific message and never re-sends automatically', async (status, code, message) => {
    let posts = 0
    openAt('/dawah/attempts/123', quizHandler.attempt(),
      http.post(url('/quiz/submissions/'), () => { posts += 1; return fail(status, code, 'Odd state.') }))
    const actor = userEvent.setup()
    await actor.click(await screen.findByRole('radio', { name: 'B' }))
    await actor.click(screen.getByRole('button', { name: 'Review' }))
    await actor.click(screen.getByRole('button', { name: 'Confirm and submit' }))
    const alerts = await screen.findAllByRole('alert')
    expect(alerts.map((a) => a.textContent).join(' ')).toMatch(message)
    expect(document.body.textContent).not.toMatch(/Nothing was saved/)
    expect(screen.getByRole('button', { name: 'Confirm and submit' })).toBeDisabled()
    await pause(300)
    expect(posts).toBe(1)
  })

  test('Check attempt status re-reads the attempt and unlocks a still-open attempt', async () => {
    let gets = 0
    openAt('/dawah/attempts/123',
      http.get(url('/quiz/attempts/123/'), () => { gets += 1; return ok(rawAttempt()) }),
      http.post(url('/quiz/submissions/'), () => fail(409, 'CONFLICT', 'Odd state.')))
    const actor = userEvent.setup()
    await actor.click(await screen.findByRole('button', { name: 'Review' }))
    await actor.click(screen.getByRole('button', { name: 'Confirm and submit' }))
    await actor.click(await screen.findByRole('button', { name: 'Check attempt status' }))
    await vi.waitFor(() => expect(gets).toBe(2))
    await vi.waitFor(() => expect(screen.getByRole('button', { name: 'Confirm and submit' })).toBeEnabled())
  })
})

describe('intro for an unavailable quiz and frozen result lookup', () => {
  test('404 on the quiz still offers Continue my attempt, which opens the existing attempt', async () => {
    const start = recorder()
    openAt('/dawah/quizzes/45',
      http.get(url('/quiz/quizzes/45/'), () => fail(404, 'NOT_FOUND', 'Not found.')),
      quizHandler.start(rawAttempt(), start), quizHandler.attempt())
    expect(await screen.findByRole('alert')).toHaveTextContent(/not available/)
    await userEvent.setup().click(screen.getByRole('button', { name: 'Continue my attempt' }))
    expect(await screen.findByText(/Question 1 of 2/)).toBeVisible()
    expect(start.calls).toHaveLength(1)
  })

  test('403 on the quiz offers Continue; a failing start shows its error', async () => {
    openAt('/dawah/quizzes/45',
      http.get(url('/quiz/quizzes/45/'), () => fail(403, 'PERMISSION_DENIED', 'No.')),
      http.post(url('/quiz/quizzes/45/attempts/'), () => fail(404, 'NOT_FOUND', 'No attempt.')))
    await userEvent.setup().click(await screen.findByRole('button', { name: 'Continue my attempt' }))
    const alerts = await screen.findAllByRole('alert')
    expect(alerts).toHaveLength(2)
    expect(alerts[1]).toHaveTextContent(/not available/)
    expect(location()).toBe('/dawah/quizzes/45')
  })

  test('a server error on the quiz has no Continue shortcut, only retry', async () => {
    openAt('/dawah/quizzes/45', http.get(url('/quiz/quizzes/45/'), () => fail(503, 'SERVICE_UNAVAILABLE', 'Down.')))
    await screen.findByRole('alert')
    expect(screen.queryByRole('button', { name: 'Continue my attempt' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Try again' })).toBeVisible()
  })

  test('a submitted attempt with submission_id reads the result directly, with no history request', async () => {
    const rec = recorder()
    openAt('/dawah/attempts/123',
      quizHandler.attempt(rawAttempt({ status: 'submitted', submission_id: 9, questions: [] })),
      quizHandler.result(rawResult(), rec))
    expect(await screen.findByTestId('result-score')).toHaveTextContent('2 / 3 points')
    expect(rec.calls.map((c) => c.path)).toEqual(['/quiz/submissions/9/'])
  })

  test('without submission_id one ?attempt= request is made', async () => {
    const queries = []
    openAt('/dawah/attempts/123',
      quizHandler.attempt(rawAttempt({ status: 'submitted', questions: [] })),
      http.get(url('/quiz/submissions/'), ({ request }) => { queries.push(new URL(request.url).search); return ok(page([rawResult()])) }))
    expect(await screen.findByTestId('result-score')).toBeVisible()
    expect(queries).toHaveLength(1)
    expect(new URLSearchParams(queries[0]).get('attempt')).toBe('123')
  })
})
