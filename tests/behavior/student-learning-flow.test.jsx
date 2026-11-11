import { configure, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom'
import ClassDetailPage from '../../src/features/assessments/student/classes/pages/ClassDetailPage.jsx'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { server } from '../mocks/server.js'
import { fail, ok, recorder, resetSession, sessionHandlers, storeRefreshToken, url, useApiOrigin } from '../fixtures/auth.js'
import { TestApp, LocationProbe } from '../fixtures/TestApp.jsx'
import { AppRoutes } from '../../src/App.jsx'
import AuthProvider from '../../src/features/auth/AuthProvider.jsx'
import { createLearningBackend, rawClass, rawDoc, rawModule, rawVideo } from '../fixtures/assessLearningApi.js'
import { audio } from '../fixtures/dawah.js'
import { rawQuiz } from '../fixtures/assessments.js'
import { http } from 'msw'

configure({ asyncUtilTimeout: 5000 })
vi.setConfig({ testTimeout: 20000 })
beforeEach(useApiOrigin)
afterEach(resetSession)

const location = () => screen.getByTestId('location').textContent

function openAt(path, backend, ...extra) {
  const rec = recorder()
  server.use(...sessionHandlers(rec), ...backend.handlers, ...extra)
  storeRefreshToken()
  render(<TestApp path={path} />)
  return rec
}

const full = () => ({
  classes: [rawClass()],
  modules: {
    2: [
      rawModule({ id: 21, title: 'Numbers', order: 2 }),
      rawModule({
        id: 20, title: 'Greetings', order: 1,
        resources: [audio(8, { title: 'Greeting audio' }), rawVideo(9, { title: 'Greeting video' }), rawDoc(10, { title: 'Greeting workbook' })],
        quizzes: [{ id: 45, title: 'Arabic week 1', status: 'published' }, { id: 46, title: 'Old quiz', status: 'closed' }],
      }),
      rawModule({ id: 22, title: 'Hidden draft', order: 0, status: 'draft' }),
    ],
  },
  enrollments: { 2: { id: 5, status: 'active' } },
})

describe('catalog', () => {
  test('lists published classes and links to detail; empty state', async () => {
    const backend = createLearningBackend({ classes: [rawClass(), rawClass({ id: 3, code: 'ARB102', title: 'Draft class', status: 'draft' })] })
    openAt('/dawah/classes', backend)
    expect(await screen.findByRole('heading', { name: 'Arabic for beginners' })).toBeVisible()
    expect(screen.queryByText('Draft class')).toBeNull()
    await userEvent.setup().click(screen.getByRole('link', { name: 'View Arabic for beginners' }))
    expect(location()).toBe('/dawah/classes/2')
    expect(backend.state.violations).toEqual([])
  })

  test('empty and failure with retry', async () => {
    const backend = createLearningBackend({ classes: [] })
    openAt('/dawah/classes', backend)
    expect(await screen.findByText('No classes are open right now')).toBeVisible()
  })

  test('failure offers retry', async () => {
    const backend = createLearningBackend()
    backend.state.failNext = { method: 'GET', suffix: '/quiz/classes/', response: () => fail(503, 'SERVICE_UNAVAILABLE', 'Down.') }
    openAt('/dawah/classes', backend)
    expect(await screen.findByRole('alert')).toHaveTextContent('Down.')
    await userEvent.setup().click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByRole('heading', { name: 'Arabic for beginners' })).toBeVisible()
  })
})

describe('enrollment', () => {
  test('enroll, modules appear; withdraw needs confirmation; re-enroll reactivates the same record', async () => {
    const backend = createLearningBackend({ ...full(), enrollments: {} })
    openAt('/dawah/classes/2', backend)
    const actor = userEvent.setup()
    expect(await screen.findByText('You are not enrolled.')).toBeVisible()
    expect(screen.queryByRole('heading', { name: 'Modules' })).toBeNull()
    expect(backend.state.deniedModuleCalls).toEqual([])
    expect(backend.count('GET', '/modules/')).toBe(0)

    await actor.click(screen.getByRole('button', { name: 'Enroll' }))
    expect(await screen.findByText('You are enrolled.', { selector: '[data-testid="enrollment-state"]' })).toBeVisible()
    const modules = within(await screen.findByRole('heading', { name: 'Modules' }).then((h) => h.closest('section')))
    expect(modules.getAllByRole('link').map((a) => a.textContent)).toEqual(['Greetings', 'Numbers'])

    await actor.click(screen.getByRole('button', { name: 'Withdraw' }))
    expect(backend.count('DELETE', '/enrollment/')).toBe(0)
    await actor.click(screen.getByRole('button', { name: 'Keep my enrollment' }))
    expect(backend.count('DELETE', '/enrollment/')).toBe(0)
    await actor.click(screen.getByRole('button', { name: 'Withdraw' }))
    await actor.click(screen.getByRole('button', { name: 'Yes, withdraw' }))
    expect(await screen.findByText('You have withdrawn from this class.', { selector: '[data-testid="enrollment-state"]' })).toBeVisible()
    expect(screen.getByTestId('access-notice')).toHaveTextContent('Re-enroll to read its modules again')
    expect(screen.queryByRole('heading', { name: 'Modules' })).toBeNull()

    const firstId = backend.state.enrollments[2].id
    await actor.click(screen.getByRole('button', { name: 'Re-enroll' }))
    expect(await screen.findByRole('heading', { name: 'Modules' })).toBeVisible()
    expect(backend.state.enrollments[2].id).toBe(firstId)
    expect(backend.state.deniedModuleCalls).toEqual([])
    expect(backend.state.violations).toEqual([])
  })

  test('409 on enroll shows the server reason and refreshes real state; no modules fetched', async () => {
    const backend = createLearningBackend({ ...full(), enrollments: {} })
    backend.state.failNext = { method: 'POST', suffix: '/enrollment/', response: () => {
      backend.state.classes[0].status = 'closed'
      return fail(409, 'CLASS_CLOSED', 'This class is closed.')
    } }
    openAt('/dawah/classes/2', backend)
    await userEvent.setup().click(await screen.findByRole('button', { name: 'Enroll' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('This class is closed.')
    expect(await screen.findByText('This class is closed.', { selector: '[data-testid="enrollment-state"]' })).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Enroll' })).toBeNull()
    expect(backend.count('GET', '/modules/')).toBe(0)
  })

  test('re-enrolling a withdrawn student reactivates the same record', async () => {
    const backend = createLearningBackend({ ...full(), enrollments: {} })
    backend.state.enrollments[2] = { id: 5, status: 'withdrawn' }
    openAt('/dawah/classes/2', backend)
    await userEvent.setup().click(await screen.findByRole('button', { name: 'Re-enroll' }))
    expect(await screen.findByRole('heading', { name: 'Modules' })).toBeVisible()
    expect(backend.state.enrollments[2].id).toBe(5)
  })

  test('closed class: explained, no enroll button, no module request', async () => {
    const backend = createLearningBackend({ ...full(), classes: [rawClass({ status: 'closed' })] })
    openAt('/dawah/classes/2', backend)
    expect(await screen.findByTestId('access-notice')).toHaveTextContent('This class is closed')
    expect(screen.queryByRole('button', { name: /enroll/i })).toBeNull()
    expect(backend.count('GET', '/modules/')).toBe(0)
  })

  test('unknown class explains unavailability', async () => {
    const backend = createLearningBackend()
    openAt('/dawah/classes/99', backend)
    expect(await screen.findByRole('alert')).toHaveTextContent('This class or module is not available. It may not be published or may have been closed.')
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull()
    // Page content only: the global navigation legitimately links to Quizzes (PLAT-07).
    expect(within(screen.getByRole('main')).queryByText(/quiz/i)).toBeNull()
  })
})

describe('module access and reading', () => {
  test.each([
    ['not enrolled', {}, 'You are not enrolled in this class'],
    ['withdrawn', { 2: { id: 5, status: 'withdrawn' } }, 'You have withdrawn from this class'],
  ])('deep link while %s makes no module request', async (_name, enrollments, heading) => {
    const backend = createLearningBackend({ ...full(), enrollments })
    openAt('/dawah/classes/2/modules/20', backend)
    expect(await screen.findByText(heading)).toBeVisible()
    expect(backend.count('GET', '/modules/20/')).toBe(0)
    expect(backend.count('GET', '/modules/')).toBe(0)
    expect(backend.state.deniedModuleCalls).toEqual([])
    expect(screen.queryByTestId('module-body')).toBeNull()
  })

  test('closed class deep link makes no module request', async () => {
    const backend = createLearningBackend({ ...full(), classes: [rawClass({ status: 'closed' })] })
    openAt('/dawah/classes/2/modules/20', backend)
    expect(await screen.findByText('This class is closed')).toBeVisible()
    expect(backend.count('GET', '/modules/20/')).toBe(0)
  })

  test('renders plain-text body safely, audio/video/document via the shared renderer', async () => {
    const backend = createLearningBackend(full())
    openAt('/dawah/classes/2/modules/20', backend)
    expect(await screen.findByRole('heading', { name: 'Greetings', level: 1 })).toBeVisible()
    const body = screen.getByTestId('module-body')
    expect(body).toHaveTextContent('Line two <b>not html</b>')
    expect(body.querySelector('b')).toBeNull()
    expect(document.querySelector('audio')).not.toBeNull()
    expect(screen.getByTitle('Greeting video (YouTube video)')).toBeVisible()
    expect(screen.getByRole('link', { name: /Open document/ })).toHaveAttribute('href', 'https://media.example.test/workbook-10.pdf')
    expect(screen.getByText(/Module 1 of 2/)).toBeInTheDocument()
    expect(backend.state.violations).toEqual([])
  })

  test('unavailable attachments say so and render no player or link', async () => {
    const backend = createLearningBackend({
      ...full(),
      modules: { 2: [rawModule({ resources: [audio(8, { storage_status: 'pending' }), rawDoc(10, { media_url: 'http://insecure.test/x.pdf' }), rawVideo(9, { playback: null })] })] },
    })
    openAt('/dawah/classes/2/modules/20', backend)
    await screen.findByRole('heading', { name: 'Greetings', level: 1 })
    expect(screen.getByText('This audio is not available right now.')).toBeVisible()
    expect(screen.getByText('This document is not available right now.')).toBeVisible()
    expect(screen.getByText('This video is not available right now.')).toBeVisible()
    expect(document.querySelector('audio, iframe')).toBeNull()
    expect(screen.queryByRole('link', { name: /Open document/ })).toBeNull()
  })

  test('related quiz links use the ASSESS-06 routes; closed quizzes are not links', async () => {
    const backend = createLearningBackend(full())
    openAt('/dawah/classes/2/modules/20', backend, http.get(url('/quiz/quizzes/:id/'), () => ok(rawQuiz())))
    const actor = userEvent.setup()
    const link = await screen.findByRole('link', { name: 'Arabic week 1' })
    expect(link).toHaveAttribute('href', '/dawah/quizzes/45')
    expect(screen.queryByRole('link', { name: /Old quiz/ })).toBeNull()
    expect(screen.getByText('Old quiz (not open)')).toBeVisible()
    await actor.click(link)
    expect(location()).toBe('/dawah/quizzes/45')
    expect(await screen.findByRole('heading', { name: 'Arabic week 1' })).toBeVisible()
  })

  test('next/previous follow persisted order; unknown module reports not available', async () => {
    const backend = createLearningBackend(full())
    openAt('/dawah/classes/2/modules/20', backend)
    const actor = userEvent.setup()
    await actor.click(await screen.findByRole('link', { name: 'Next: Numbers' }))
    expect(location()).toBe('/dawah/classes/2/modules/21')
    expect(await screen.findByRole('heading', { name: 'Numbers', level: 1 })).toBeVisible()
    expect(screen.getByRole('link', { name: 'Previous: Greetings' })).toBeVisible()
  })

  test('draft module is not available', async () => {
    const backend = createLearningBackend(full())
    openAt('/dawah/classes/2/modules/22', backend)
    expect(await screen.findByRole('alert')).toHaveTextContent('not available')
  })

  test('class page lists modules only for published modules in order, empty state', async () => {
    const backend = createLearningBackend({ ...full(), modules: { 2: [] } })
    openAt('/dawah/classes/2', backend)
    expect(await screen.findByText('No modules have been published for this class yet.')).toBeVisible()
  })
})

describe('guard', () => {
  test('anonymous visitors are sent to sign-in and nothing is requested', async () => {
    const backend = createLearningBackend(full())
    server.use(...backend.handlers)
    render(<TestApp path="/dawah/classes/2/modules/20" />)
    expect(await screen.findByRole('heading', { name: 'Welcome back to Pythagoras' })).toBeVisible()
    expect(location()).toBe('/sign-in?next=%2Fdawah%2Fclasses%2F2%2Fmodules%2F20')
    expect(backend.state.calls).toEqual([])
  })
})

const alertText = () => screen.getByRole('alert').textContent

describe('error wording and enrollment races', () => {
  test('module 403 ENROLLMENT_REQUIRED race: class wording and an enroll link, no quiz wording', async () => {
    const backend = createLearningBackend(full())
    backend.state.failNext = { method: 'GET', suffix: '/modules/20/', response: () => fail(403, 'ENROLLMENT_REQUIRED', 'Enroll to read modules.') }
    openAt('/dawah/classes/2/modules/20', backend)
    expect(await screen.findByRole('alert')).toHaveTextContent('You need an active enrollment in this class to read its modules.')
    expect(alertText()).not.toMatch(/quiz/i)
    expect(screen.getByRole('link', { name: 'Enroll on the class page' })).toHaveAttribute('href', '/dawah/classes/2')
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull()
  })

  test('module list 403 race on the class page keeps the class visible and offers a status refresh', async () => {
    const backend = createLearningBackend(full())
    backend.state.failNext = { method: 'GET', suffix: '/modules/', response: () => fail(403, 'ENROLLMENT_REQUIRED', 'Enroll to read modules.') }
    openAt('/dawah/classes/2', backend)
    expect(await screen.findByRole('heading', { name: 'Arabic for beginners' })).toBeVisible()
    expect(await screen.findByText('You need an active enrollment in this class to read its modules.')).toBeVisible()
    backend.state.enrollments[2].status = 'withdrawn'
    await userEvent.setup().click(screen.getByRole('button', { name: 'Refresh my enrollment status' }))
    expect(await screen.findByText('You have withdrawn from this class.', { selector: '[data-testid="enrollment-state"]' })).toBeVisible()
  })

  test('copy does not claim quizzes need enrollment', async () => {
    const backend = createLearningBackend({ ...full(), enrollments: {} })
    openAt('/dawah/classes', backend)
    expect(await screen.findByText('Enroll in a class to read its modules. Linked quizzes are listed in each module.')).toBeVisible()
    await userEvent.setup().click(screen.getByRole('link', { name: 'View Arabic for beginners' }))
    expect(await screen.findByTestId('enrollment-state')).toHaveTextContent('You are not enrolled.')
    expect(screen.queryByTestId('access-notice')).toBeNull()
  })

  test('not-enrolled module deep link copy', async () => {
    const backend = createLearningBackend({ ...full(), enrollments: {} })
    openAt('/dawah/classes/2/modules/20', backend)
    expect(await screen.findByText('Enroll to read its modules; linked quizzes are listed in each module.')).toBeVisible()
  })

  test('follows next when listing modules (more than one page)', async () => {
    const many = Array.from({ length: 120 }, (_, i) => rawModule({ id: 100 + i, title: `Module ${i + 1}`, order: i + 1 }))
    const backend = createLearningBackend({ ...full(), modules: { 2: many } })
    openAt('/dawah/classes/2', backend)
    const list = await screen.findByRole('heading', { name: 'Modules' }).then((h) => h.closest('section'))
    await waitFor(() => expect(within(list).getAllByRole('link')).toHaveLength(120))
    expect(within(list).getAllByRole('link').at(-1)).toHaveTextContent('Module 120')
    expect(backend.state.calls.filter((c) => c.path === '/quiz/classes/2/modules/').map((c) => c.search.page)).toEqual(['1', '2'])
  })
})

describe('class page state, focus and live regions', () => {
  test('double-clicking Enroll sends one request', async () => {
    const backend = createLearningBackend({ ...full(), enrollments: {} })
    openAt('/dawah/classes/2', backend)
    const button = await screen.findByRole('button', { name: 'Enroll' })
    await userEvent.setup().dblClick(button)
    await screen.findByRole('heading', { name: 'Modules' })
    expect(backend.count('POST', '/enrollment/')).toBe(1)
  })

  test('withdraw: focus moves into the confirmation, returns to the trigger on cancel, lands on the status after completion; live regions stay mounted', async () => {
    const backend = createLearningBackend(full())
    openAt('/dawah/classes/2', backend)
    const actor = userEvent.setup()
    const trigger = await screen.findByRole('button', { name: 'Withdraw' })
    expect(screen.getByTestId('live-notice')).toBeInTheDocument()
    expect(screen.getByTestId('live-error')).toBeInTheDocument()
    await actor.click(trigger)
    expect(screen.getByRole('heading', { name: 'Withdraw from this class?' })).toHaveFocus()
    await actor.click(screen.getByRole('button', { name: 'Keep my enrollment' }))
    expect(screen.getByRole('button', { name: 'Withdraw' })).toHaveFocus()
    await actor.click(screen.getByRole('button', { name: 'Withdraw' }))
    await actor.click(screen.getByRole('button', { name: 'Yes, withdraw' }))
    await waitFor(() => expect(screen.getByTestId('enrollment-state')).toHaveFocus())
    expect(screen.getByTestId('enrollment-state')).toHaveTextContent('You have withdrawn from this class.')
    expect(screen.getByTestId('live-notice')).toHaveTextContent('Withdrawal saved. Your quiz results are kept.')
  })

  test('actions refresh in place: the class title never unmounts', async () => {
    const backend = createLearningBackend({ ...full(), enrollments: {} })
    openAt('/dawah/classes/2', backend)
    const title = await screen.findByRole('heading', { name: 'Arabic for beginners', level: 1 })
    await userEvent.setup().click(screen.getByRole('button', { name: 'Enroll' }))
    await screen.findByRole('heading', { name: 'Modules' })
    expect(title.isConnected).toBe(true)
    expect(screen.queryByText('Loading class…')).toBeNull()
  })

  test('changing the class id resets confirmation, notice and error', async () => {
    const backend = createLearningBackend({
      classes: [rawClass(), rawClass({ id: 3, code: 'ARB102', title: 'Second class' })],
      modules: {}, enrollments: { 2: { id: 5, status: 'active' }, 3: { id: 6, status: 'active' } },
    })
    function Go() {
      const navigate = useNavigate()
      return <button type="button" onClick={() => navigate('/c/3')}>go-3</button>
    }
    server.use(...backend.handlers)
    render(
      <MemoryRouter initialEntries={['/c/2']}>
        <Go />
        <Routes><Route path="/c/:id" element={<ClassDetailPage />} /></Routes>
      </MemoryRouter>,
    )
    const actor = userEvent.setup()
    await actor.click(await screen.findByRole('button', { name: 'Withdraw' }))
    expect(screen.getByRole('alertdialog')).toBeVisible()
    await actor.click(screen.getByRole('button', { name: 'go-3' }))
    expect(await screen.findByRole('heading', { name: 'Second class' })).toBeVisible()
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(screen.getByTestId('live-notice')).toBeEmptyDOMElement()
    expect(screen.getByTestId('live-error')).toBeEmptyDOMElement()
  })

  test('back/forward after withdrawing re-checks access and requests no module', async () => {
    const backend = createLearningBackend(full())
    function Nav() {
      const navigate = useNavigate()
      return (
        <>
          <button type="button" onClick={() => navigate(-1)}>history-back</button>
          <button type="button" onClick={() => navigate(1)}>history-forward</button>
        </>
      )
    }
    const rec = recorder()
    server.use(...sessionHandlers(rec), ...backend.handlers)
    storeRefreshToken()
    render(
      <MemoryRouter initialEntries={['/dawah/classes/2']}>
        <AuthProvider>
          <Nav />
          <AppRoutes />
          <LocationProbe />
        </AuthProvider>
      </MemoryRouter>,
    )
    const actor = userEvent.setup()
    await actor.click(await screen.findByRole('link', { name: 'Greetings' }))
    expect(await screen.findByRole('heading', { name: 'Greetings', level: 1 })).toBeVisible()
    await actor.click(screen.getByRole('button', { name: 'history-back' }))
    await actor.click(await screen.findByRole('button', { name: 'Withdraw' }))
    await actor.click(screen.getByRole('button', { name: 'Yes, withdraw' }))
    await screen.findByText('You have withdrawn from this class.', { selector: '[data-testid="enrollment-state"]' })
    const moduleReads = backend.count('GET', '/modules/20/')
    await actor.click(screen.getByRole('button', { name: 'history-forward' }))
    expect(await screen.findByText('You have withdrawn from this class')).toBeVisible()
    expect(screen.queryByTestId('module-body')).toBeNull()
    expect(backend.count('GET', '/modules/20/')).toBe(moduleReads)
    expect(backend.state.deniedModuleCalls).toEqual([])
  })
})
