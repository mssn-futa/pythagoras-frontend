import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { server } from '../mocks/server.js'
import { admin, fail, recorder, resetSession, sessionHandlers, storeRefreshToken, student, useApiOrigin } from '../fixtures/auth.js'
import { TestApp } from '../fixtures/TestApp.jsx'
import { createQuizBackend, draftQuiz } from '../fixtures/assessAdminApi.js'
import { arabicClass, createClassBackend, enrollmentRow, moduleRecord, resourceRef } from '../fixtures/assessClassesApi.js'

let active = []
beforeEach(useApiOrigin)
afterEach(() => {
  resetSession()
  // Every request body must match the frozen contract shapes (unknown keys rejected).
  for (const backend of active) expect(backend.state.violations).toEqual([])
  active = []
})

const location = () => screen.getByTestId('location').textContent

function open(path, backend, user = admin, extra = []) {
  active = [backend, ...extra]
  server.use(...sessionHandlers(recorder(), user), ...backend.handlers, ...extra.flatMap((b) => b.handlers))
  storeRefreshToken()
  render(<TestApp path={path} />)
}

const resources = [resourceRef(8, 'Patience', 'aud'), resourceRef(19, 'Recorded lecture', 'vid'), resourceRef(21, 'Notes', 'doc')]
const students = [
  { id: 1, first_name: 'Amina', last_name: 'Yusuf', email: 'amina@example.test' },
  { id: 9, first_name: 'Tunde', last_name: 'Bello', email: 'tunde@example.test' },
]

describe('guard', () => {
  test('students are denied and no class API call is made', async () => {
    const backend = createClassBackend({ classes: [arabicClass()] })
    open('/admin/classes', backend, student)
    expect(await screen.findByRole('heading', { name: 'Access denied' })).toBeVisible()
    expect(backend.state.calls).toEqual([])
  })

  test('anonymous visitors are sent to sign-in', async () => {
    const backend = createClassBackend()
    server.use(...backend.handlers)
    render(<TestApp path="/admin/classes/2/roster" />)
    await waitFor(() => expect(location()).toBe('/sign-in?next=%2Fadmin%2Fclasses%2F2%2Froster'))
    expect(backend.state.calls).toEqual([])
  })
})

describe('class list', () => {
  test('shows real rows, links and a read-only marker for legacy records', async () => {
    const backend = createClassBackend({ classes: [arabicClass({ module_count: 2 }), arabicClass({ id: 3, code: 'GEN200', title: 'General course', kind: 'general', status: 'published' })] })
    open('/admin/classes', backend)
    const card = (await screen.findByRole('heading', { name: 'Arabic for beginners' })).closest('li')
    expect(within(card).getByText('draft')).toBeVisible()
    expect(within(card).getByRole('link', { name: 'Roster for Arabic for beginners' })).toHaveAttribute('href', '/admin/classes/2/roster')
    const legacy = screen.getByRole('heading', { name: 'General course' }).closest('li')
    expect(within(legacy).getByText(/Legacy or unrecognised record/)).toBeVisible()
    expect(within(legacy).queryByRole('link', { name: /Roster/ })).toBeNull()
  })

  test('status filter and pagination go to the server and the URL', async () => {
    const many = Array.from({ length: 25 }, (_, i) => arabicClass({ id: i + 1, code: `C${i + 1}`, title: `Class ${i + 1}`, status: i < 22 ? 'published' : 'draft' }))
    const backend = createClassBackend({ classes: many })
    open('/admin/classes', backend)
    expect(await screen.findByText('Page 1 of 2 · 25 total')).toBeVisible()
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Next' }))
    expect(await screen.findByText('Page 2 of 2 · 25 total')).toBeVisible()
    expect(backend.state.calls.at(-1).search.page).toBe('2')
    await user.selectOptions(screen.getByLabelText('Status'), 'draft')
    expect(await screen.findByRole('heading', { name: 'Class 23' })).toBeVisible()
    expect(location()).toBe('/admin/classes?status=draft')
    expect(backend.state.calls.at(-1).search).toMatchObject({ status: 'draft', page_size: '20' })
  })

  test('empty state, then error with retry', async () => {
    const backend = createClassBackend()
    backend.state.failNext = { method: 'GET', pattern: '/quiz/classes/', response: () => fail(500, 'SERVER_ERROR', 'Boom.') }
    open('/admin/classes', backend)
    expect(await screen.findByRole('alert')).toHaveTextContent('Boom.')
    await userEvent.setup().click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByText(/No Arabic classes yet/)).toBeVisible()
  })
})

describe('class create and edit', () => {
  test('creates a draft with the exact payload and lands on the saved class', async () => {
    const backend = createClassBackend()
    open('/admin/classes/new', backend)
    const user = userEvent.setup()
    await user.type(await screen.findByLabelText('Code'), 'ARB102')
    await user.type(screen.getByLabelText('Title'), 'Intermediate Arabic')
    await user.type(screen.getByLabelText('Description'), 'Reading practice')
    await user.click(screen.getByRole('button', { name: 'Save draft class' }))
    expect(await screen.findByText('Draft class saved. You can now add modules.')).toBeVisible()
    expect(location()).toBe('/admin/classes/500')
    expect(await screen.findByRole('button', { name: 'Publish class' })).toBeVisible() // saved class fully loaded
    expect(backend.callsTo('POST', '/quiz/classes/')[0].body).toEqual({ code: 'ARB102', title: 'Intermediate Arabic', description: 'Reading practice' })
    expect(backend.state.classes[0]).toMatchObject({ kind: 'arabic', status: 'draft' })
  })

  test('blank fields are caught locally; a server field error lands on the field', async () => {
    const backend = createClassBackend({ classes: [arabicClass()] })
    open('/admin/classes/new', backend)
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: 'Save draft class' }))
    expect(screen.getByText('Enter a class code.')).toBeVisible()
    expect(backend.state.calls).toEqual([])
    await user.type(screen.getByLabelText('Code'), 'ARB101')
    await user.type(screen.getByLabelText('Title'), 'Duplicate')
    await user.click(screen.getByRole('button', { name: 'Save draft class' }))
    expect(await screen.findByText('A class with this code already exists.')).toBeVisible()
    expect(screen.getByLabelText('Code')).toHaveAttribute('aria-invalid', 'true')
    expect(location()).toBe('/admin/classes/new')
  })

  test('edit saves and reloads; a network failure keeps the typed values', async () => {
    const backend = createClassBackend({ classes: [arabicClass()] })
    open('/admin/classes/2', backend)
    const user = userEvent.setup()
    const title = await screen.findByLabelText('Title')
    expect(screen.getByRole('button', { name: 'Save details' })).toBeDisabled()
    await user.clear(title)
    await user.type(title, 'Arabic basics')
    backend.state.failNext = { method: 'PATCH', pattern: '/quiz/classes/2/', response: () => fail(503, 'SERVER_ERROR', 'Unavailable.') }
    await user.click(screen.getByRole('button', { name: 'Save details' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Unavailable.')
    expect(screen.getByLabelText('Title')).toHaveValue('Arabic basics')
    await user.click(screen.getByRole('button', { name: 'Save details' }))
    expect(await screen.findByText('Class details saved.')).toBeVisible()
    expect(backend.callsTo('PATCH', '/quiz/classes/2/').at(-1).body).toEqual({ code: 'ARB101', title: 'Arabic basics', description: 'Greetings and basics.' })
    expect(screen.getByRole('heading', { name: 'Arabic basics' })).toBeVisible()
  })

  test('a closed class has locked details and no lifecycle action', async () => {
    const backend = createClassBackend({ classes: [arabicClass({ status: 'closed' })] })
    open('/admin/classes/2', backend)
    expect(await screen.findByLabelText('Title')).toBeDisabled()
    expect(screen.getByText(/cannot be reopened/)).toBeVisible()
    expect(screen.queryByRole('button', { name: /Publish class|Close class/ })).toBeNull()
  })

  test('a legacy course is read-only with no sections', async () => {
    const backend = createClassBackend({ classes: [arabicClass({ kind: 'general' })] })
    open('/admin/classes/2', backend)
    expect(await screen.findByText(/legacy or general academic course/)).toBeVisible()
    expect(screen.getByLabelText('Title')).toBeDisabled()
    expect(screen.queryByRole('navigation', { name: 'Class sections' })).toBeNull()
    expect(screen.queryByRole('button', { name: /Publish class|Delete draft class/ })).toBeNull()
  })

  test('missing class shows the not-found message with a way back', async () => {
    open('/admin/classes/77', createClassBackend())
    expect(await screen.findByRole('alert')).toHaveTextContent(/no longer exists/)
    expect(screen.getByRole('link', { name: 'Back to classes' })).toHaveAttribute('href', '/admin/classes')
  })
})

describe('lifecycle', () => {
  test('publish confirms, calls publish, then shows the persisted status', async () => {
    const backend = createClassBackend({ classes: [arabicClass()] })
    open('/admin/classes/2', backend)
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: 'Publish class' }))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Publish class' }))
    expect(await screen.findByText(/Class published\./)).toBeVisible()
    expect(backend.callsTo('POST', '/quiz/classes/2/publish/')).toHaveLength(1)
    expect(await screen.findByRole('button', { name: 'Close class' })).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Publish class' })).toBeNull()
  })

  test('closing explains the consequence and locks the class', async () => {
    const backend = createClassBackend({ classes: [arabicClass({ status: 'published' })] })
    open('/admin/classes/2', backend)
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: 'Close class' }))
    expect(within(screen.getByRole('dialog')).getByText(/New enrollment stops/)).toBeVisible()
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Close class' }))
    expect(await screen.findByText(/Class closed\./)).toBeVisible()
    expect(screen.getByLabelText('Title')).toBeDisabled()
  })

  test('a publish conflict (already published elsewhere) shows the message and reloads the real state', async () => {
    const backend = createClassBackend({ classes: [arabicClass()] })
    open('/admin/classes/2', backend)
    await screen.findByRole('button', { name: 'Publish class' })
    backend.state.classes[0].status = 'published' // another admin published it
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Publish class' }))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Publish class' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/A published class cannot be published/)
    expect(await screen.findByRole('button', { name: 'Close class' })).toBeVisible()
  })

  test('deleting a draft that modules reference is refused with a clear message', async () => {
    const backend = createClassBackend({ classes: [arabicClass()], modules: { 2: [moduleRecord()] } })
    open('/admin/classes/2', backend)
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: 'Delete draft class' }))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete draft class' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/referenced elsewhere and cannot be deleted/)
    expect(location()).toBe('/admin/classes/2')
  })

  test('deleting an unreferenced draft returns to the list with a notice', async () => {
    const backend = createClassBackend({ classes: [arabicClass()] })
    open('/admin/classes/2', backend)
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: 'Delete draft class' }))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete draft class' }))
    expect(await screen.findByText('Draft class deleted.')).toBeVisible()
    expect(await screen.findByText(/No Arabic classes yet/)).toBeVisible() // list loaded: nothing left in flight
    expect(location()).toBe('/admin/classes')
    expect(backend.state.classes).toEqual([])
  })
})

describe('modules', () => {
  const three = () => [
    moduleRecord({ id: 20, title: 'Greetings', order: 1, status: 'published', resources: [resourceRef(8, 'Patience')] }),
    moduleRecord({ id: 21, title: 'Numbers', order: 2 }),
    moduleRecord({ id: 22, title: 'Colours', order: 3 }),
  ]

  test('lists modules by persisted order with state, resources and actions', async () => {
    const backend = createClassBackend({ classes: [arabicClass({ status: 'published' })], modules: { 2: [three()[2], three()[0], three()[1]] } })
    open('/admin/classes/2/modules', backend)
    const items = await screen.findAllByRole('listitem')
    expect(items.map((li) => li.querySelector('p').textContent)).toEqual(['1. Greetings', '2. Numbers', '3. Colours'])
    expect(within(items[0]).getByText('published')).toBeVisible()
    expect(within(items[0]).getByText('1 resource')).toBeVisible()
    expect(within(items[0]).queryByRole('button', { name: /Delete/ })).toBeNull() // published: unpublish first
    expect(screen.getByRole('button', { name: 'Move Greetings up' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Move Colours down' })).toBeDisabled()
  })

  test('moving a module up PATCHes only {order} for the modules whose position changed, then reloads', async () => {
    const backend = createClassBackend({ classes: [arabicClass({ status: 'published' })], modules: { 2: three() } })
    open('/admin/classes/2/modules', backend)
    await userEvent.setup().click(await screen.findByRole('button', { name: 'Move Colours up' }))
    expect(await screen.findByText('Module order saved.')).toBeVisible()
    expect(backend.callsTo('PATCH', '/modules/').map((c) => [c.path, c.body])).toEqual([
      ['/quiz/classes/2/modules/22/', { order: 2 }],
      ['/quiz/classes/2/modules/21/', { order: 3 }],
    ])
    await waitFor(() => expect(screen.getAllByRole('listitem').map((li) => li.querySelector('p').textContent)).toEqual(['1. Greetings', '2. Colours', '3. Numbers']))
  })

  test('a failed reorder shows the error and the persisted order', async () => {
    const backend = createClassBackend({ classes: [arabicClass({ status: 'published' })], modules: { 2: three() } })
    open('/admin/classes/2/modules', backend)
    const user = userEvent.setup()
    await screen.findByRole('button', { name: 'Move Numbers up' })
    backend.state.failNext = { method: 'PATCH', pattern: '/modules/', response: () => fail(409, 'CLASS_CLOSED', 'Closed.') }
    await user.click(screen.getByRole('button', { name: 'Move Numbers up' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/conflicts with the current state/)
    expect(screen.getAllByRole('listitem').map((li) => li.querySelector('p').textContent)).toEqual(['1. Greetings', '2. Numbers', '3. Colours'])
  })

  test('publish and unpublish are explicit calls; draft delete is allowed and protected delete is explained', async () => {
    const backend = createClassBackend({ classes: [arabicClass({ status: 'published' })], modules: { 2: [three()[0], three()[1], { ...three()[2], quizzes: [{ id: 4, title: 'Week 1', status: 'published' }] }] } })
    open('/admin/classes/2/modules', backend)
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: 'Unpublish Greetings' }))
    expect(await screen.findByText(/"Greetings" unpublished/)).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Publish Numbers' }))
    expect(await screen.findByText(/"Numbers" published/)).toBeVisible()
    expect(backend.state.calls.filter((c) => c.method === 'POST').map((c) => c.path)).toEqual(['/quiz/classes/2/modules/20/unpublish/', '/quiz/classes/2/modules/21/publish/'])

    await user.click(screen.getByRole('button', { name: 'Delete Colours' }))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete module' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/referenced elsewhere/)
    expect(screen.getByText('3. Colours')).toBeVisible()

    await user.click(screen.getByRole('button', { name: 'Delete Greetings' }))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete module' }))
    expect(await screen.findByText('"Greetings" deleted.')).toBeVisible()
    expect(screen.queryByText('1. Greetings')).toBeNull()
  })

  test('empty and error states; closed class is read-only', async () => {
    const empty = createClassBackend({ classes: [arabicClass({ status: 'closed' })] })
    empty.state.failNext = { method: 'GET', pattern: '/modules/', response: () => fail(500, 'SERVER_ERROR', 'Boom.') }
    open('/admin/classes/2/modules', empty)
    expect(await screen.findByRole('alert')).toHaveTextContent('Boom.')
    await userEvent.setup().click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByText('No modules yet.')).toBeVisible()
    expect(screen.queryByRole('link', { name: 'Add module' })).toBeNull()
    expect(screen.getByText(/closed, so modules are read-only/)).toBeVisible()
  })

  test('creates a module with the D3 payload, picking published resources by ID; order defaults to the end', async () => {
    const backend = createClassBackend({ classes: [arabicClass({ status: 'published' })], modules: { 2: three() }, resources })
    open('/admin/classes/2/modules/new', backend)
    const user = userEvent.setup()
    expect(await screen.findByLabelText('Order')).toHaveValue('4')
    await user.type(screen.getByLabelText('Title'), 'Arabic greetings')
    await user.type(screen.getByLabelText(/Lesson text/), 'Lesson text')
    await user.click(await screen.findByRole('button', { name: 'Attach Patience' }))
    await user.click(screen.getByRole('button', { name: 'Attach Recorded lecture' }))
    expect(screen.getByRole('button', { name: 'Remove Patience' })).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Save draft module' }))
    await waitFor(() => expect(location()).toBe('/admin/classes/2/modules/500'))
    expect(await screen.findByText('Module saved as a draft.')).toBeVisible()
    expect(await screen.findByRole('button', { name: 'Save module' })).toBeVisible() // saved module fully loaded: no request left in flight
    expect(backend.callsTo('POST', '/quiz/classes/2/modules/')[0].body).toEqual({ title: 'Arabic greetings', body: 'Lesson text', order: 4, resource_ids: [8, 19] })
  })

  test('resource search sends the archive filters and a removed resource is not sent', async () => {
    const backend = createClassBackend({ classes: [arabicClass()], resources })
    open('/admin/classes/2/modules/new', backend)
    const user = userEvent.setup()
    await screen.findByRole('button', { name: 'Attach Patience' })
    await user.type(screen.getByLabelText('Search resources'), 'note')
    await user.selectOptions(screen.getByLabelText('Resource type'), 'doc')
    await user.click(screen.getByRole('button', { name: 'Search resources' }))
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Attach Patience' })).toBeNull())
    expect(backend.callsTo('GET', '/dawah/archive/').at(-1).search).toMatchObject({ search: 'note', type: 'doc', page_size: '10' })
    await user.click(screen.getByRole('button', { name: 'Attach Notes' }))
    await user.click(screen.getByRole('button', { name: 'Remove Notes' }))
    await user.type(screen.getByLabelText('Title'), 'T')
    await user.type(screen.getByLabelText(/Lesson text/), 'B')
    await user.click(screen.getByRole('button', { name: 'Save draft module' }))
    await waitFor(() => expect(backend.callsTo('POST', '/quiz/classes/2/modules/')).toHaveLength(1))
    expect(backend.callsTo('POST', '/quiz/classes/2/modules/')[0].body.resource_ids).toEqual([])
    expect(await screen.findByRole('button', { name: 'Save module' })).toBeVisible() // saved module fully loaded
  })

  test('a server rejection of resource_ids (backend publication check) is shown on the resources and the draft is kept', async () => {
    const backend = createClassBackend({ classes: [arabicClass()], resources })
    open('/admin/classes/2/modules/new', backend)
    const user = userEvent.setup()
    await user.type(await screen.findByLabelText('Title'), 'T')
    await user.type(screen.getByLabelText(/Lesson text/), 'B')
    await user.click(await screen.findByRole('button', { name: 'Attach Patience' }))
    backend.state.resources = [] // the resource was unpublished meanwhile
    await user.click(screen.getByRole('button', { name: 'Save draft module' }))
    expect(await screen.findByText('One or more resources are not published or do not exist.')).toBeVisible()
    expect(screen.getByLabelText('Title')).toHaveValue('T')
    expect(location()).toBe('/admin/classes/2/modules/new')
  })

  test('editing keeps hidden attachments attached, shows linked quizzes, and sends the full D3 body', async () => {
    const module = moduleRecord({ id: 20, resources: [resourceRef(8, 'Patience')], resource_ids: [8, 99], quizzes: [{ id: 4, title: 'Week 1 quiz', status: 'published' }] })
    const backend = createClassBackend({ classes: [arabicClass({ status: 'published' })], modules: { 2: [module] }, resources: [...resources, { ...resourceRef(99, 'Hidden'), hidden: true }] })
    open('/admin/classes/2/modules/20', backend)
    const user = userEvent.setup()
    expect(await screen.findByText(/1 attached resource is currently hidden/)).toBeVisible()
    expect(screen.getByRole('link', { name: 'Week 1 quiz' })).toHaveAttribute('href', '/admin/quizzes/4')
    expect(screen.getByRole('button', { name: 'Save module' })).toBeDisabled()
    await user.clear(screen.getByLabelText('Title'))
    await user.type(screen.getByLabelText('Title'), 'Greetings v2')
    await user.click(screen.getByRole('button', { name: 'Save module' }))
    expect(await screen.findByText('Module saved.')).toBeVisible()
    expect(backend.callsTo('PATCH', '/quiz/classes/2/modules/20/')[0].body).toEqual({ title: 'Greetings v2', body: 'Lesson text', order: 1, resource_ids: [8, 99] })
  })

  test('module form validation is local; a closed class locks the form', async () => {
    const backend = createClassBackend({ classes: [arabicClass()], resources })
    open('/admin/classes/2/modules/new', backend)
    const user = userEvent.setup()
    await user.clear(await screen.findByLabelText('Order'))
    await user.type(screen.getByLabelText('Order'), 'x')
    await user.click(screen.getByRole('button', { name: 'Save draft module' }))
    expect(screen.getByText('Enter a title.')).toBeVisible()
    expect(screen.getByText('Order must be a whole number of 1 or more.')).toBeVisible()
    expect(backend.callsTo('POST', '/modules/')).toEqual([])
  })

  test('module form is disabled for a closed class', async () => {
    const backend = createClassBackend({ classes: [arabicClass({ status: 'closed' })], modules: { 2: [moduleRecord()] } })
    open('/admin/classes/2/modules/20', backend)
    expect(await screen.findByLabelText('Title')).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Save module' })).toBeDisabled()
    expect(screen.queryByLabelText('Search resources')).toBeNull()
  })
})

describe('roster', () => {
  const roster = () => ({
    2: [enrollmentRow(6, 1, 'Amina Yusuf'), enrollmentRow(7, 4, 'Bashir Ade', 'withdrawn'), enrollmentRow(8, 5, 'Chidi Eze')],
  })

  test('shows enrollments with state and dates; filters by status and search through the server', async () => {
    const backend = createClassBackend({ classes: [arabicClass({ status: 'published' })], enrollments: roster() })
    open('/admin/classes/2/roster', backend)
    const user = userEvent.setup()
    expect(await screen.findByText('Amina Yusuf')).toBeVisible()
    const row = screen.getByText('Bashir Ade').closest('tr')
    expect(within(row).getByText('withdrawn')).toBeVisible()
    expect(within(row).getByText(/5 Oct 2026/)).toBeVisible()
    await user.selectOptions(screen.getByLabelText('Status'), 'withdrawn')
    await waitFor(() => expect(screen.queryByText('Amina Yusuf')).toBeNull())
    expect(location()).toBe('/admin/classes/2/roster?status=withdrawn')
    await user.selectOptions(screen.getByLabelText('Status'), '')
    await user.type(screen.getByLabelText('Search students'), 'chidi')
    await user.click(screen.getByRole('button', { name: 'Search' }))
    await waitFor(() => expect(screen.queryByText('Amina Yusuf')).toBeNull())
    expect(screen.getByText('Chidi Eze')).toBeVisible()
    expect(backend.callsTo('GET', '/enrollments/').at(-1).search).toMatchObject({ search: 'chidi', page: '1', page_size: '20' })
  })

  test('paginates, and shows a filtered empty state', async () => {
    const many = Array.from({ length: 23 }, (_, i) => enrollmentRow(100 + i, 100 + i, `Student ${i + 1}`))
    const backend = createClassBackend({ classes: [arabicClass({ status: 'published' })], enrollments: { 2: many } })
    open('/admin/classes/2/roster', backend)
    const user = userEvent.setup()
    expect(await screen.findByText('Page 1 of 2 · 23 total')).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Next' }))
    expect(await screen.findByText('Page 2 of 2 · 23 total')).toBeVisible()
    expect(backend.callsTo('GET', '/enrollments/').at(-1).search.page).toBe('2')
    await user.type(screen.getByLabelText('Search students'), 'zzz')
    await user.click(screen.getByRole('button', { name: 'Search' }))
    expect(await screen.findByText('No enrollments match these filters.')).toBeVisible()
  })

  test('empty roster and load error with retry', async () => {
    const backend = createClassBackend({ classes: [arabicClass({ status: 'published' })] })
    backend.state.failNext = { method: 'GET', pattern: '/enrollments/', response: () => fail(500, 'SERVER_ERROR', 'Boom.') }
    open('/admin/classes/2/roster', backend)
    expect(await screen.findByRole('alert')).toHaveTextContent('Boom.')
    await userEvent.setup().click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByText('No students are enrolled yet.')).toBeVisible()
  })

  test('withdraw confirms and POSTs status withdrawn; reinstate POSTs active for the same student', async () => {
    const backend = createClassBackend({ classes: [arabicClass({ status: 'published' })], enrollments: roster() })
    open('/admin/classes/2/roster', backend)
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: 'Withdraw Amina Yusuf' }))
    expect(within(screen.getByRole('dialog')).getByText(/enrollment record is kept/)).toBeVisible()
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Withdraw' }))
    expect(await screen.findByText('Amina Yusuf withdrawn.')).toBeVisible()
    await user.click(await screen.findByRole('button', { name: 'Reinstate Bashir Ade' }))
    expect(await screen.findByText('Bashir Ade reinstated.')).toBeVisible()
    expect(backend.callsTo('POST', '/enrollments/').map((c) => c.body)).toEqual([{ student_id: 1, status: 'withdrawn' }, { student_id: 4, status: 'active' }])
    expect(backend.state.enrollments[2].map((r) => r.status)).toEqual(['withdrawn', 'active', 'active'])
    expect(backend.state.enrollments[2]).toHaveLength(3) // same records, no duplicates
  })

  test('a conflict on an action (class closed meanwhile) is explained and locks the roster', async () => {
    const backend = createClassBackend({ classes: [arabicClass({ status: 'published' })], enrollments: roster() })
    open('/admin/classes/2/roster', backend)
    const user = userEvent.setup()
    await screen.findByRole('button', { name: 'Reinstate Bashir Ade' })
    backend.state.classes[0].status = 'closed'
    await user.click(screen.getByRole('button', { name: 'Reinstate Bashir Ade' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/conflicts with the current state\. A closed class/)
    await waitFor(() => expect(screen.queryByRole('button', { name: /Reinstate|Withdraw/ })).toBeNull())
    expect(screen.getByText(/roster is read-only/)).toBeVisible()
  })

  test('enrolls a found student through the D1 student list', async () => {
    const backend = createClassBackend({ classes: [arabicClass({ status: 'published' })], enrollments: roster(), students })
    open('/admin/classes/2/roster', backend)
    const user = userEvent.setup()
    await user.type(await screen.findByLabelText('Find a student to enroll'), 'tunde')
    await user.click(screen.getByRole('button', { name: 'Find student' }))
    await user.click(await screen.findByRole('button', { name: 'Enroll Tunde Bello' }))
    expect(await screen.findByText('Tunde Bello enrolled.')).toBeVisible()
    expect(backend.callsTo('GET', '/accounts/students/')[0].search).toMatchObject({ search: 'tunde' })
    expect(backend.callsTo('POST', '/enrollments/')[0].body).toEqual({ student_id: 9, status: 'active' })
    expect(await screen.findByText('Tunde Bello')).toBeVisible()
  })

  test('a draft class offers no enrollment', async () => {
    const backend = createClassBackend({ classes: [arabicClass()], students })
    open('/admin/classes/2/roster', backend)
    expect(await screen.findByText(/Students can enroll only after it is published/)).toBeVisible()
    expect(screen.queryByLabelText('Find a student to enroll')).toBeNull()
  })
})

describe('quiz draft related class', () => {
  test('lists Arabic classes only, sends related_course on create, and never clears it by omission on edit', async () => {
    const classes = [arabicClass({ status: 'published' }), arabicClass({ id: 3, code: 'GEN', title: 'General', kind: 'general' })]
    const quizzes = createQuizBackend({ quizzes: [draftQuiz({ related_course: 2 })], classes })
    open('/admin/quizzes/5', quizzes, admin)
    const select = await screen.findByLabelText('Related Arabic class (optional)')
    await waitFor(() => expect(within(select).getByRole('option', { name: /ARB101: Arabic for beginners/ })).toBeVisible())
    expect(within(select).queryByRole('option', { name: /General/ })).toBeNull()
    expect(select).toHaveValue('2')
    const user = userEvent.setup()
    await user.clear(screen.getByLabelText('Title'))
    await user.type(screen.getByLabelText('Title'), 'Renamed')
    await user.click(screen.getByRole('button', { name: 'Save draft details' }))
    await screen.findByText('Draft saved.')
    expect(quizzes.callsTo('PATCH', '/quiz/quizzes/5/')[0].body).not.toHaveProperty('related_course')
    await user.selectOptions(select, '')
    await user.click(screen.getByRole('button', { name: 'Save draft details' }))
    await waitFor(() => expect(quizzes.callsTo('PATCH', '/quiz/quizzes/5/')).toHaveLength(2))
    expect(quizzes.callsTo('PATCH', '/quiz/quizzes/5/')[1].body).toMatchObject({ related_course: null })
  })

  test('new draft carries the chosen class; a published quiz shows the link locked', async () => {
    const classes = [arabicClass({ status: 'published' })]
    const quizzes = createQuizBackend({ classes })
    open('/admin/quizzes/new', quizzes)
    const user = userEvent.setup()
    await user.type(await screen.findByLabelText('Title'), 'Week 1')
    await user.type(screen.getByLabelText(/Time limit/), '30')
    await user.type(screen.getByLabelText(/Deadline/), '2099-10-12T21:00')
    const select = screen.getByLabelText('Related Arabic class (optional)')
    await waitFor(() => expect(within(select).getAllByRole('option')).toHaveLength(2))
    await user.selectOptions(select, '2')
    await user.click(screen.getByRole('button', { name: 'Save draft' }))
    await screen.findByText('Draft saved. You can now add questions.')
    expect(quizzes.callsTo('POST', '/quiz/quizzes/')[0].body).toMatchObject({ related_event: null, related_course: 2 })
  })

  test('published quiz: association is read-only', async () => {
    const quizzes = createQuizBackend({ quizzes: [draftQuiz({ id: 7, status: 'published', related_course: 2, published_at: '2026-10-01T09:00:00Z' })], classes: [arabicClass({ status: 'published' })] })
    open('/admin/quizzes/7', quizzes)
    const select = await screen.findByLabelText('Related Arabic class (optional)')
    expect(select).toBeDisabled()
    expect(select).toHaveValue('2')
  })
})
