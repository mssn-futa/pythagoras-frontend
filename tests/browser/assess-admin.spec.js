import { test, expect } from './test.js'

// Synthetic, test-only API for the admin assessment journey (D3 contracts).
const API = 'https://api.pythagoras.test'
const admin = {
  id: 2, email: 'admin@example.test', first_name: 'Bilal', last_name: 'Okafor',
  matric_number: null, department: 'Computer Science', level: '300', role: 'admin', is_active: true,
}

const corsFor = (route) => ({
  'Access-Control-Allow-Origin': route.request().headers().origin ?? '',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type, Accept',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
})

async function mockApi(page) {
  const quiz = { id: 51, title: '', description: '', status: 'draft', type: 'arabic', time_limit: null, deadline: null, published_at: null, related_event: null, questions: [] }
  let created = false
  const calls = []
  const reply = (route, status, data, message = 'OK.') =>
    route.fulfill({ status, headers: corsFor(route), contentType: 'application/json', body: JSON.stringify({ success: true, data, message }) })

  await page.route(`${API}/**`, async (route) => {
    const request = route.request()
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: corsFor(route) })
    const { pathname } = new URL(request.url())
    const body = request.postDataJSON?.() ?? null
    calls.push({ method: request.method(), path: pathname, body })

    if (pathname === '/accounts/refresh/') return reply(route, 200, { access: 'access-1', refresh: 'refresh-1' })
    if (pathname === '/accounts/me/') return reply(route, 200, admin)
    if (pathname === '/quiz/classes/') return reply(route, 200, { count: 0, next: null, previous: null, results: [] })
    if (pathname === '/quiz/quizzes/' && request.method() === 'GET') {
      const results = created ? [{ ...quiz, question_count: quiz.questions.length, total_points: quiz.questions.reduce((t, q) => t + q.points, 0) }] : []
      return reply(route, 200, { count: results.length, next: null, previous: null, results })
    }
    if (pathname === '/quiz/quizzes/' && request.method() === 'POST') {
      Object.assign(quiz, body)
      created = true
      return reply(route, 201, quiz, 'Saved.')
    }
    if (pathname === '/quiz/quizzes/51/' && request.method() === 'GET') return reply(route, 200, quiz)
    if (pathname === '/quiz/quizzes/51/questions/') {
      quiz.questions.push({ id: 61, ...body, options: body.options.map((option, index) => ({ id: 70 + index, ...option })) })
      return reply(route, 201, quiz.questions[0], 'Saved.')
    }
    if (pathname === '/quiz/quizzes/51/publish/') {
      quiz.status = 'published'
      quiz.published_at = '2026-10-01T09:00:00Z'
      return reply(route, 200, quiz, 'Published.')
    }
    if (pathname === '/quiz/quizzes/51/submissions/') {
      return reply(route, 200, {
        count: 1, next: null, previous: null,
        results: [{ id: 9, attempt_id: 123, quiz_id: 51, quiz_title: quiz.title, status: 'submitted', score: 2, total_points: 2, submitted_at: '2026-10-12T10:20:00Z', graded_at: '2026-10-12T10:20:00Z', student_id: 1, student_name: 'Amina Yusuf', student_email: 'amina@example.test' }],
      })
    }
    return route.fulfill({ status: 404, headers: corsFor(route), contentType: 'application/json', body: JSON.stringify({ success: false, data: { code: 'NOT_FOUND' }, message: 'Not found.' }) })
  })
  return { calls, quiz }
}

test('admin authors, publishes and reviews a quiz', async ({ page }) => {
  await page.route('https://fonts.googleapis.com/**', (route) => route.fulfill({ contentType: 'text/css', body: '' }))
  await page.addInitScript(() => sessionStorage.setItem('pythagoras.refreshToken', 'refresh-0'))
  const api = await mockApi(page)

  await page.goto('/admin/quizzes')
  await expect(page.getByText(/No quizzes yet/)).toBeVisible()
  await page.getByRole('link', { name: 'New quiz' }).click()

  await page.getByLabel('Title').fill('Arabic week 1')
  await page.getByLabel(/Time limit/).fill('30')
  await page.getByLabel(/Deadline/).fill('2099-10-12T21:00')
  await page.getByRole('button', { name: 'Save draft' }).click()
  await expect(page).toHaveURL('/admin/quizzes/51')
  await expect(page.getByText('Draft saved. You can now add questions.')).toBeVisible()

  await page.getByRole('button', { name: 'Add question' }).first().click()
  const form = page.getByRole('form', { name: 'New question' })
  await form.getByLabel('Question', { exact: true }).fill('Choose the greeting')
  await form.getByLabel('Points').fill('2')
  for (const [letter, text] of [['A', 'Marhaba'], ['B', 'Salam'], ['C', 'Shukran'], ['D', 'Afwan']]) {
    await form.getByLabel(`Option ${letter}`, { exact: true }).fill(text)
  }
  await form.getByLabel('Option A is correct').check()
  await form.getByRole('button', { name: 'Add question' }).click()
  await expect(page.getByText('Question added.')).toBeVisible()

  await page.getByRole('button', { name: 'Publish quiz' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Publish quiz' }).click()
  await expect(page.getByText(/Quiz published\./)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Add question' })).toHaveCount(0)

  await page.getByRole('link', { name: 'View results' }).click()
  await expect(page).toHaveURL('/admin/quizzes/51/results')
  await expect(page.getByRole('cell', { name: /^Amina Yusuf/ })).toBeVisible()
  await expect(page.getByRole('cell', { name: '2 / 2' })).toBeVisible()

  expect(api.calls.find((call) => call.path === '/quiz/quizzes/51/questions/').body).toEqual({
    type: 'mcq', text: 'Choose the greeting', points: 2, order: 1,
    options: [
      { text: 'Marhaba', order: 1, is_correct: true }, { text: 'Salam', order: 2, is_correct: false },
      { text: 'Shukran', order: 3, is_correct: false }, { text: 'Afwan', order: 4, is_correct: false },
    ],
  })
  expect(api.calls.find((call) => call.method === 'POST' && call.path === '/quiz/quizzes/').body.deadline).toBe('2099-10-12T20:00:00Z')

  // No horizontal page scroll on any viewport.
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
  expect(overflow).toBe(false)
})
