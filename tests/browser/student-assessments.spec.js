import { test, expect } from './test.js'

// Synthetic, test-only API shaped like the frozen D3 examples (no real backend).
const API = 'https://api.pythagoras.test'
const student = {
  id: 1, email: 'student@example.test', first_name: 'Amina', last_name: 'Yusuf', matric_number: 'CSC/21/001',
  department: 'Computer Science', level: '300', role: 'student', is_active: true,
}
const quiz = {
  id: 45, title: 'Arabic week 1', description: 'Weekly assessment', time_limit: 30,
  deadline: '2026-10-12T20:00:00Z', status: 'published', total_points: 3, question_count: 2,
}
const questions = [
  { id: 10, text: 'First question', points: 2, order: 1, options: [101, 102, 103, 104].map((id, i) => ({ id, text: `Option ${'ABCD'[i]}`, order: i + 1 })) },
  { id: 11, text: 'Second question', points: 1, order: 2, options: [111, 112, 113, 114].map((id, i) => ({ id, text: `Choice ${'WXYZ'[i]}`, order: i + 1 })) },
]
const result = {
  id: 9, attempt_id: 123, quiz_id: 45, quiz_title: 'Arabic week 1', status: 'submitted', score: 2, total_points: 3,
  submitted_at: '2026-10-12T10:20:00Z', graded_at: '2026-10-12T10:20:00Z',
}

const corsFor = (route) => ({
  'Access-Control-Allow-Origin': route.request().headers().origin ?? '',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type, Accept',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
})

async function mockApi(page) {
  const calls = []
  let submitted = false
  let submitFailures = 1 // the first submit reaches the server but its response is lost
  const reply = (route, status, data, message = 'OK.') =>
    route.fulfill({ status, headers: corsFor(route), contentType: 'application/json', body: JSON.stringify({ success: status < 400, data, message }) })

  await page.route(`${API}/**`, async (route) => {
    const request = route.request()
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: corsFor(route) })
    const path = new URL(request.url()).pathname
    const body = request.postDataJSON?.() ?? null
    calls.push({ method: request.method(), path, body })

    if (path === '/accounts/refresh/') return reply(route, 200, { access: 'access-1', refresh: 'refresh-1' })
    if (path === '/accounts/me/') return reply(route, 200, student)
    if (path === '/quiz/quizzes/') return reply(route, 200, { count: 1, next: null, previous: null, results: [quiz] })
    if (path === '/quiz/quizzes/45/') return reply(route, 200, quiz)
    if (path === '/quiz/quizzes/45/attempts/') {
      return reply(route, 200, attempt(), 'Attempt retrieved.')
    }
    if (path === '/quiz/attempts/123/') return reply(route, 200, attempt(), 'Attempt retrieved.')
    if (path === '/quiz/submissions/' && request.method() === 'POST') {
      submitted = true
      if (submitFailures-- > 0) return route.abort('connectionreset')
      return reply(route, 200, result, 'Result saved.')
    }
    if (path === '/quiz/submissions/') return reply(route, 200, { count: submitted ? 1 : 0, next: null, previous: null, results: submitted ? [result] : [] })
    if (path === '/quiz/submissions/9/') return reply(route, 200, result)
    return reply(route, 404, { code: 'NOT_FOUND' }, 'Not found.')
  })
  return { calls, submits: () => calls.filter((c) => c.method === 'POST' && c.path === '/quiz/submissions/') }

  function attempt() {
    // Start/reload always report the same server-owned expiry; server_time moves on.
    return { id: 123, quiz_id: 45, status: 'in_progress', started_at: '2026-10-12T10:00:00Z', expires_at: '2036-10-12T10:30:00Z', server_time: '2036-10-12T10:00:00Z', questions }
  }
}

test('discover → start → answer → submit (lost response, replay) → reload result → history', async ({ page, isMobile }, testInfo) => {
  await page.route('https://fonts.googleapis.com/**', (route) => route.fulfill({ contentType: 'text/css', body: '' }))
  const api = await mockApi(page)
  await page.addInitScript(() => sessionStorage.setItem('pythagoras.refreshToken', 'refresh-0'))

  await page.goto('/dawah/quizzes')
  await expect(page.getByRole('heading', { name: 'Arabic week 1' })).toBeVisible()
  await expect(page.getByText('Closes 12 Oct 2026, 21:00 WAT')).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('list.png') })

  await page.getByRole('link', { name: 'View Arabic week 1' }).click()
  await expect(page).toHaveURL('/dawah/quizzes/45')
  await expect(page.getByText('One attempt only')).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('intro.png') })

  await page.getByRole('button', { name: 'Start or continue quiz' }).click()
  await expect(page).toHaveURL('/dawah/attempts/123')
  await expect(page.getByText(/Question 1 of 2/)).toBeVisible()
  await expect(page.getByRole('timer')).toBeVisible()

  await page.getByRole('radio', { name: 'Option B' }).check()
  await page.screenshot({ path: testInfo.outputPath('question.png') })
  await page.getByRole('button', { name: 'Next' }).click()
  await page.getByRole('radio', { name: 'Choice X' }).check()
  await page.getByRole('button', { name: 'Review answers' }).click()
  await expect(page.getByText('All questions have an answer.')).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('review.png') })

  await page.getByRole('button', { name: 'Confirm and submit' }).click()
  await expect(page.getByText("We couldn't confirm your submission.")).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('uncertain.png') })
  await page.getByRole('button', { name: 'Retry submission' }).click()

  await expect(page).toHaveURL('/profile/results/9')
  await expect(page.getByTestId('result-score')).toHaveText('2 / 3 points')
  const submits = api.submits()
  expect(submits).toHaveLength(2)
  expect(submits[1].body).toEqual(submits[0].body)
  expect(submits[0].body).toEqual({ attempt_id: 123, answers: { '10': 102, '11': 112 } })
  expect(api.calls.filter((c) => c.path === '/quiz/quizzes/45/attempts/')).toHaveLength(1)
  await page.screenshot({ path: testInfo.outputPath('result.png') })

  await page.reload()
  await expect(page.getByTestId('result-score')).toHaveText('2 / 3 points')

  await page.goto('/profile/results')
  await expect(page.getByText('2 / 3 points')).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('history.png') })

  if (isMobile) {
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(overflow).toBeLessThanOrEqual(0)
  }
})
