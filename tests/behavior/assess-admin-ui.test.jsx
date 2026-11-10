import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { server } from '../mocks/server.js'
import { admin, fail, recorder, resetSession, sessionHandlers, storeRefreshToken, student, useApiOrigin } from '../fixtures/auth.js'
import { TestApp } from '../fixtures/TestApp.jsx'
import { createQuizBackend, draftQuiz } from '../fixtures/assessAdminApi.js'

beforeEach(useApiOrigin)
afterEach(resetSession)

const location = () => screen.getByTestId('location').textContent

function open(path, backend, user = admin) {
  server.use(...sessionHandlers(recorder(), user), ...backend.handlers)
  storeRefreshToken()
  render(<TestApp path={path} />)
}

const published = (overrides = {}) => draftQuiz({ id: 7, status: 'published', published_at: '2026-10-01T09:00:00Z', title: 'Published quiz', ...overrides })

describe('guard', () => {
  test('students are denied; no quiz API call is made', async () => {
    const backend = createQuizBackend({ quizzes: [draftQuiz()] })
    open('/admin/quizzes', backend, student)
    expect(await screen.findByRole('heading', { name: 'Access denied' })).toBeVisible()
    expect(backend.state.calls).toEqual([])
  })

  test('anonymous visitors are sent to sign-in', async () => {
    const backend = createQuizBackend()
    server.use(...backend.handlers)
    render(<TestApp path="/admin/quizzes" />)
    await waitFor(() => expect(location()).toBe('/sign-in?next=%2Fadmin%2Fquizzes'))
    expect(backend.state.calls).toEqual([])
  })
})

describe('quiz list', () => {
  test('shows real rows with status, weighted total and links', async () => {
    const backend = createQuizBackend({ quizzes: [draftQuiz(), published()] })
    open('/admin/quizzes', backend)
    expect(await screen.findByRole('heading', { name: 'Arabic week 1' })).toBeVisible()
    const card = screen.getByRole('heading', { name: 'Published quiz' }).closest('li')
    expect(within(card).getByText('published')).toBeVisible()
    expect(within(card).getByText('5')).toBeVisible() // 2 + 3 points, not 2 questions
    expect(within(card).getByRole('link', { name: 'Results for Published quiz' })).toHaveAttribute('href', '/admin/quizzes/7/results')
    expect(screen.getByRole('link', { name: 'Edit Arabic week 1' })).toHaveAttribute('href', '/admin/quizzes/5')
  })

  test('status filter requests the filtered list and keeps it in the URL', async () => {
    const backend = createQuizBackend({ quizzes: [draftQuiz(), published()] })
    open('/admin/quizzes', backend)
    await screen.findByRole('heading', { name: 'Arabic week 1' })
    await userEvent.setup().selectOptions(screen.getByLabelText('Status'), 'published')
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Arabic week 1' })).toBeNull())
    expect(screen.getByRole('heading', { name: 'Published quiz' })).toBeVisible()
    expect(location()).toBe('/admin/quizzes?status=published')
    expect(backend.state.calls.at(-1).search).toMatchObject({ status: 'published', page: '1', page_size: '20' })
  })

  test('paginates with page and page_size', async () => {
    const many = Array.from({ length: 25 }, (_, index) => draftQuiz({ id: index + 1, title: `Quiz ${index + 1}`, questions: [] }))
    const backend = createQuizBackend({ quizzes: many })
    open('/admin/quizzes', backend)
    expect(await screen.findByText('Page 1 of 2 · 25 total')).toBeVisible()
    await userEvent.setup().click(screen.getByRole('button', { name: 'Next' }))
    expect(await screen.findByText('Page 2 of 2 · 25 total')).toBeVisible()
    expect(backend.state.calls.at(-1).search.page).toBe('2')
    expect(screen.getAllByRole('listitem')).toHaveLength(5)
  })

  test('empty state and load failure with retry', async () => {
    const backend = createQuizBackend()
    backend.state.failNext = { method: 'GET', pattern: '/quiz/quizzes/', response: () => fail(500, 'SERVER_ERROR', 'The server had a problem.') }
    open('/admin/quizzes', backend)
    expect(await screen.findByRole('alert')).toHaveTextContent('The server had a problem.')
    await userEvent.setup().click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByText(/No quizzes yet/)).toBeVisible()
  })
})

describe('create draft', () => {
  test('saves the D3 draft payload with the deadline converted from Lagos time, then opens it', async () => {
    const backend = createQuizBackend()
    open('/admin/quizzes/new', backend)
    const actor = userEvent.setup()
    await actor.type(await screen.findByLabelText('Title'), 'Arabic week 1')
    await actor.type(screen.getByLabelText('Description'), 'Weekly assessment')
    await actor.type(screen.getByLabelText(/Time limit/), '30')
    await actor.type(screen.getByLabelText(/Deadline/), '2099-10-12T21:00')
    await actor.click(screen.getByRole('button', { name: 'Save draft' }))

    expect(await screen.findByText('Draft saved. You can now add questions.')).toBeVisible()
    expect(backend.callsTo('POST', '/quiz/quizzes/')[0].body).toEqual({
      title: 'Arabic week 1', description: 'Weekly assessment', time_limit: 30, deadline: '2099-10-12T20:00:00Z', related_event: null,
    })
    expect(location()).toBe('/admin/quizzes/100')
    expect(screen.getByLabelText(/Deadline/)).toHaveValue('2099-10-12T21:00')
  })

  test('client validation blocks the request; server field errors are shown on the field', async () => {
    const backend = createQuizBackend()
    open('/admin/quizzes/new', backend)
    const actor = userEvent.setup()
    await actor.click(await screen.findByRole('button', { name: 'Save draft' }))
    expect(screen.getByText('Enter a title.')).toBeVisible()
    expect(backend.state.calls).toEqual([])

    await actor.type(screen.getByLabelText('Title'), 'T')
    await actor.type(screen.getByLabelText(/Time limit/), '500')
    await actor.click(screen.getByRole('button', { name: 'Save draft' }))
    expect(screen.getByText(/from 1 to 180/)).toBeVisible()

    await actor.clear(screen.getByLabelText(/Time limit/))
    backend.state.failNext = {
      method: 'POST', pattern: '/quiz/quizzes/',
      response: () => fail(400, 'VALIDATION_ERROR', 'Correct the highlighted fields.', { deadline: ['Deadline must be in the future.'] }),
    }
    await actor.click(screen.getByRole('button', { name: 'Save draft' }))
    expect(await screen.findByText('Deadline must be in the future.')).toBeVisible()
    expect(screen.getByLabelText(/Deadline/)).toHaveAttribute('aria-invalid', 'true')
    expect(location()).toBe('/admin/quizzes/new')
  })

  test('a failed save keeps the form and says nothing was saved', async () => {
    const backend = createQuizBackend()
    open('/admin/quizzes/new', backend)
    const actor = userEvent.setup()
    await actor.type(await screen.findByLabelText('Title'), 'Keep me')
    backend.state.failNext = { method: 'POST', pattern: '/quiz/quizzes/', response: () => fail(503, 'SERVICE_UNAVAILABLE', 'Service unavailable.') }
    await actor.click(screen.getByRole('button', { name: 'Save draft' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Service unavailable.')
    expect(screen.getByLabelText('Title')).toHaveValue('Keep me')
    expect(backend.state.quizzes).toEqual([])
  })
})

describe('draft editor', () => {
  test('loads persisted questions with IDs, order and points', async () => {
    const backend = createQuizBackend({ quizzes: [draftQuiz()] })
    open('/admin/quizzes/5', backend)
    expect(await screen.findByRole('heading', { name: /Questions \(2\)/ })).toHaveTextContent('5 points in total')
    expect(screen.getByText('2 points')).toBeVisible()
    expect(screen.getByText('3 points')).toBeVisible()
    expect(screen.getAllByText('(correct)')).toHaveLength(2)
    expect(screen.getByLabelText(/Deadline/)).toHaveValue('2099-10-12T21:00')
  })

  test('add question: enforces the four-option rules before any request, then posts the D3 body', async () => {
    const backend = createQuizBackend({ quizzes: [draftQuiz({ questions: [] })] })
    open('/admin/quizzes/5', backend)
    const actor = userEvent.setup()
    await actor.click(await screen.findByRole('button', { name: 'Add question' }))
    const form = screen.getByRole('form', { name: 'New question' })
    const q = within(form)
    expect(q.getByLabelText('Points')).toHaveValue('1')

    await actor.click(q.getByRole('button', { name: 'Add question' }))
    expect(q.getByText('Enter the question text.')).toBeVisible()
    expect(q.getAllByText('Enter the option text.')).toHaveLength(4)
    expect(q.getByText('Mark exactly one option as the correct answer.')).toBeVisible()
    expect(backend.callsTo('POST', '/questions/')).toHaveLength(0)

    await actor.type(q.getByLabelText('Question'), 'Choose the greeting')
    await actor.type(q.getByLabelText('Option A'), 'Marhaba')
    await actor.type(q.getByLabelText('Option B'), 'marhaba ')
    await actor.type(q.getByLabelText('Option C'), 'Shukran')
    await actor.type(q.getByLabelText('Option D'), 'Afwan')
    await actor.click(q.getByLabelText('Option A is correct'))
    await actor.clear(q.getByLabelText('Points'))
    await actor.type(q.getByLabelText('Points'), '0')
    await actor.click(q.getByRole('button', { name: 'Add question' }))
    expect(q.getByText(/Same as option A/)).toBeVisible()
    expect(q.getByText('Points must be a whole number greater than 0.')).toBeVisible()
    expect(backend.callsTo('POST', '/questions/')).toHaveLength(0)

    await actor.clear(q.getByLabelText('Option B'))
    await actor.type(q.getByLabelText('Option B'), 'Salam')
    await actor.clear(q.getByLabelText('Points'))
    await actor.type(q.getByLabelText('Points'), '2')
    await actor.click(q.getByRole('button', { name: 'Add question' }))

    expect(await screen.findByText('Question added.')).toBeVisible()
    expect(backend.callsTo('POST', '/quiz/quizzes/5/questions/')[0].body).toEqual({
      type: 'mcq', text: 'Choose the greeting', points: 2, order: 1,
      options: [
        { text: 'Marhaba', order: 1, is_correct: true }, { text: 'Salam', order: 2, is_correct: false },
        { text: 'Shukran', order: 3, is_correct: false }, { text: 'Afwan', order: 4, is_correct: false },
      ],
    })
    expect(screen.getByRole('heading', { name: /Questions \(1\)/ })).toBeVisible()
  })

  test('new questions are appended after the highest persisted order', async () => {
    const backend = createQuizBackend({ quizzes: [draftQuiz()] })
    open('/admin/quizzes/5', backend)
    const actor = userEvent.setup()
    await actor.click(await screen.findByRole('button', { name: 'Add question' }))
    const q = within(screen.getByRole('form', { name: 'New question' }))
    await actor.type(q.getByLabelText('Question'), 'Third')
    for (const [letter, text] of [['A', 'a1'], ['B', 'b1'], ['C', 'c1'], ['D', 'd1']]) await actor.type(q.getByLabelText(`Option ${letter}`), text)
    await actor.click(q.getByLabelText('Option D is correct'))
    await actor.click(q.getByRole('button', { name: 'Add question' }))
    await screen.findByText('Question added.')
    const body = backend.callsTo('POST', '/questions/')[0].body
    expect([body.order, body.points]).toEqual([3, 1])
  })

  test('editing keeps the persisted option IDs, order and points; delete asks first', async () => {
    const backend = createQuizBackend({ quizzes: [draftQuiz()] })
    open('/admin/quizzes/5', backend)
    const actor = userEvent.setup()
    await actor.click(await screen.findByRole('button', { name: 'Edit question 1' }))
    const q = within(screen.getByRole('form', { name: 'Edit question 1' }))
    expect(q.getByLabelText('Option B is correct')).toBeChecked()
    await actor.clear(q.getByLabelText('Question'))
    await actor.type(q.getByLabelText('Question'), 'Greeting (revised)')
    await actor.click(q.getByLabelText('Option C is correct'))
    await actor.click(q.getByRole('button', { name: 'Save question' }))
    await screen.findByText('Question updated.')
    const call = backend.callsTo('PATCH', '/quiz/question/10/')[0]
    expect(call.body).toMatchObject({ type: 'mcq', text: 'Greeting (revised)', points: 2, order: 1 })
    expect(call.body.options.map((o) => [o.id, o.order, o.is_correct])).toEqual([[100, 1, false], [101, 2, false], [102, 3, true], [103, 4, false]])

    await actor.click(screen.getByRole('button', { name: 'Delete question 2' }))
    expect(backend.callsTo('DELETE', '/quiz/question/')).toHaveLength(0)
    await actor.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete question' }))
    await screen.findByText('Question deleted.')
    expect(backend.callsTo('DELETE', '/quiz/question/11/')).toHaveLength(1)
  })

  test('server field errors on a question appear in the editor and the draft is kept', async () => {
    const backend = createQuizBackend({ quizzes: [draftQuiz({ questions: [] })] })
    open('/admin/quizzes/5', backend)
    const actor = userEvent.setup()
    await actor.click(await screen.findByRole('button', { name: 'Add question' }))
    const q = within(screen.getByRole('form', { name: 'New question' }))
    await actor.type(q.getByLabelText('Question'), 'Q')
    for (const [letter, text] of [['A', 'a'], ['B', 'b'], ['C', 'c'], ['D', 'd']]) await actor.type(q.getByLabelText(`Option ${letter}`), text)
    await actor.click(q.getByLabelText('Option A is correct'))
    backend.state.failNext = {
      method: 'POST', pattern: '/questions/',
      response: () => fail(400, 'VALIDATION_ERROR', 'Correct the highlighted fields.', { options: ['Options must be different.'] }),
    }
    await actor.click(q.getByRole('button', { name: 'Add question' }))
    expect(await q.findByText('Options must be different.')).toBeVisible()
    expect(q.getByLabelText('Question')).toHaveValue('Q')
  })

  test('409 QUIZ_IMMUTABLE on save explains the lock and reloads the real (published) state', async () => {
    const backend = createQuizBackend({ quizzes: [draftQuiz()] })
    open('/admin/quizzes/5', backend)
    const actor = userEvent.setup()
    await actor.click(await screen.findByRole('button', { name: 'Edit question 1' }))
    backend.find(5).status = 'published' // someone published it in another tab
    backend.find(5).published_at = '2026-10-01T09:00:00Z'
    await actor.click(within(screen.getByRole('form', { name: 'Edit question 1' })).getByRole('button', { name: 'Save question' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/published, so its questions/)
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Add question' })).toBeNull())
    expect(screen.getByText('published')).toBeVisible()
    expect(screen.queryByRole('form', { name: 'Edit question 1' })).toBeNull()
  })

  test('details save sends the full draft payload including related_event', async () => {
    const backend = createQuizBackend({ quizzes: [draftQuiz()] })
    open('/admin/quizzes/5', backend)
    const actor = userEvent.setup()
    await actor.clear(await screen.findByLabelText('Title'))
    await actor.type(screen.getByLabelText('Title'), 'Renamed')
    await actor.click(screen.getByRole('button', { name: 'Save draft details' }))
    await screen.findByText('Draft saved.')
    expect(backend.callsTo('PATCH', '/quiz/quizzes/5/')[0].body).toEqual({
      title: 'Renamed', description: 'Weekly assessment', time_limit: 30, deadline: '2099-10-12T20:00:00Z', related_event: null,
    })
  })

  test('delete draft needs confirmation and returns to the list', async () => {
    const backend = createQuizBackend({ quizzes: [draftQuiz()] })
    open('/admin/quizzes/5', backend)
    const actor = userEvent.setup()
    await actor.click(await screen.findByRole('button', { name: 'Delete draft' }))
    expect(backend.callsTo('DELETE', '/quiz/quizzes/5/')).toHaveLength(0)
    await actor.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete draft' }))
    await waitFor(() => expect(location()).toBe('/admin/quizzes'))
    expect(await screen.findByText('Draft deleted.')).toBeVisible()
  })
})

describe('publish and close', () => {
  test('publish confirms with immutability text, then shows the locked published state', async () => {
    const backend = createQuizBackend({ quizzes: [draftQuiz()] })
    open('/admin/quizzes/5', backend)
    const actor = userEvent.setup()
    await actor.click(await screen.findByRole('button', { name: 'Publish quiz' }))
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveTextContent('2 questions, 5 points in total, 30 minutes')
    expect(dialog).toHaveTextContent(/cannot be changed\. Only the title and description/)
    expect(backend.callsTo('POST', '/publish/')).toHaveLength(0)
    await actor.click(within(dialog).getByRole('button', { name: 'Publish quiz' }))

    expect(await screen.findByText(/Quiz published\. Its questions, answers, timing and links are now locked/)).toBeVisible()
    expect(backend.callsTo('POST', '/quiz/quizzes/5/publish/')[0].body).toBeNull()
    expect(screen.getByText('published')).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Add question' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Edit question 1' })).toBeNull()
    expect(screen.getByLabelText(/Time limit/)).toBeDisabled()
    expect(screen.getByLabelText(/Deadline/)).toBeDisabled()
    expect(screen.getByRole('link', { name: 'View results' })).toBeVisible()
  })

  test('publish is blocked with reasons for an empty quiz and while details are unsaved', async () => {
    const backend = createQuizBackend({ quizzes: [draftQuiz({ questions: [] })] })
    open('/admin/quizzes/5', backend)
    expect(await screen.findByRole('button', { name: 'Publish quiz' })).toBeDisabled()
    expect(screen.getByText('Add at least one question.')).toBeVisible()
  })

  test('a server publish rejection is shown and the quiz stays a draft', async () => {
    const backend = createQuizBackend({ quizzes: [draftQuiz()] })
    backend.state.failNext = {
      method: 'POST', pattern: '/publish/',
      response: () => fail(400, 'VALIDATION_ERROR', 'The quiz cannot be published.', { deadline: ['The deadline must be in the future.'] }),
    }
    open('/admin/quizzes/5', backend)
    const actor = userEvent.setup()
    await actor.click(await screen.findByRole('button', { name: 'Publish quiz' }))
    await actor.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Publish quiz' }))
    expect(await screen.findByText('The deadline must be in the future.', { selector: 'p' })).toBeVisible()
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getByText('draft')).toBeVisible()
  })

  test('published quiz: only title/description can be corrected, sent alone', async () => {
    const backend = createQuizBackend({ quizzes: [published()] })
    open('/admin/quizzes/7', backend)
    const actor = userEvent.setup()
    expect(await screen.findByText(/This quiz is published\. Questions, options, points/)).toBeVisible()
    await actor.clear(screen.getByLabelText('Title'))
    await actor.type(screen.getByLabelText('Title'), 'Corrected title')
    await actor.click(screen.getByRole('button', { name: 'Save title and description' }))
    expect(await screen.findByText('Title and description updated.')).toBeVisible()
    expect(backend.callsTo('PATCH', '/quiz/quizzes/7/')[0].body).toEqual({ title: 'Corrected title', description: 'Weekly assessment' })
    expect(backend.find(7).questions).toHaveLength(2)
  })

  test('close confirms and explains in-flight attempts', async () => {
    const backend = createQuizBackend({ quizzes: [published()] })
    open('/admin/quizzes/7', backend)
    const actor = userEvent.setup()
    await actor.click(await screen.findByRole('button', { name: 'Close quiz' }))
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveTextContent(/Attempts already in progress can still be submitted/)
    await actor.click(within(dialog).getByRole('button', { name: 'Close quiz' }))
    expect(await screen.findByText(/Quiz closed\./)).toBeVisible()
    expect(backend.callsTo('POST', '/quiz/quizzes/7/close/')).toHaveLength(1)
    expect(screen.getByText('closed')).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Close quiz' })).toBeNull()
  })

  test('missing quiz shows a clear error', async () => {
    const backend = createQuizBackend()
    open('/admin/quizzes/999', backend)
    expect(await screen.findByRole('alert')).toHaveTextContent(/no longer exists/)
  })
})

describe('results', () => {
  const rows = [
    { id: 9, attempt_id: 123, quiz_id: 7, quiz_title: 'Published quiz', status: 'submitted', score: 2, total_points: 5, submitted_at: '2026-10-12T10:20:00Z', graded_at: '2026-10-12T10:20:00Z', student_id: 1, student_name: 'Amina Yusuf', student_email: 'amina@example.test' },
    { id: 10, attempt_id: 124, quiz_id: 7, quiz_title: 'Published quiz', status: 'submitted', score: 5, total_points: 5, submitted_at: '2026-10-12T11:00:00Z', graded_at: '2026-10-12T11:00:00Z', student_id: 3, student_name: 'Chidi Eze', student_email: 'chidi@example.test' },
    { id: 11, attempt_id: null, quiz_id: 7, quiz_title: 'Published quiz', status: 'submitted', score: 1, total_points: null, submitted_at: '2026-10-01T11:00:00Z', graded_at: null, student_id: 4, student_name: 'Legacy Student', student_email: 'legacy@example.test' },
  ]

  test('lists real rows with weighted score/total and Lagos times; no thresholds or keys', async () => {
    const backend = createQuizBackend({ quizzes: [published()], results: { 7: rows } })
    open('/admin/quizzes/7/results', backend)
    expect(await screen.findByText('Amina Yusuf')).toBeVisible()
    const row = screen.getByText('Amina Yusuf').closest('tr')
    expect(row).toHaveTextContent('2 / 5')
    expect(row).toHaveTextContent('amina@example.test')
    expect(row).toHaveTextContent('12 Oct 2026')
    expect(screen.getByText('5 / 5')).toBeVisible()
    expect(screen.getByText('1 (total unavailable)')).toBeVisible() // legacy: never an invented denominator
    expect(screen.queryByText(/pass|fail/i)).toBeNull()
    expect(screen.getByRole('heading', { name: 'Results: Published quiz' })).toBeVisible()
  })

  test('per-student detail loads GET /quiz/submissions/{id}/', async () => {
    const backend = createQuizBackend({ quizzes: [published()], results: { 7: rows } })
    open('/admin/quizzes/7/results', backend)
    await userEvent.setup().click(await screen.findByRole('button', { name: 'View result for Chidi Eze' }))
    const detail = await screen.findByRole('complementary', { name: 'Result detail' })
    expect(await within(detail).findByText('5 / 5')).toBeVisible()
    expect(within(detail).getByText('chidi@example.test')).toBeVisible()
    expect(within(detail).getByText('124')).toBeVisible()
    expect(backend.callsTo('GET', '/quiz/submissions/10/')).toHaveLength(1)
  })

  test('empty and failed result loads', async () => {
    const backend = createQuizBackend({ quizzes: [published()] })
    open('/admin/quizzes/7/results', backend)
    expect(await screen.findByText('No submissions yet.')).toBeVisible()
  })

  test('a failed results request offers retry', async () => {
    const backend = createQuizBackend({ quizzes: [published()], results: { 7: rows } })
    backend.state.failNext = { method: 'GET', pattern: '/submissions/', response: () => fail(500, 'SERVER_ERROR', 'The server had a problem.') }
    open('/admin/quizzes/7/results', backend)
    expect(await screen.findByRole('alert')).toHaveTextContent('The server had a problem.')
    await userEvent.setup().click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByText('Amina Yusuf')).toBeVisible()
  })
})
