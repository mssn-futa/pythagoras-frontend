import { configure, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { server } from '../mocks/server.js'
import { fail, ok, recorder, resetSession, sessionHandlers, storeRefreshToken, url, useApiOrigin } from '../fixtures/auth.js'
import { TestApp } from '../fixtures/TestApp.jsx'
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
    expect(await screen.findByRole('alert')).toHaveTextContent('not available')
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull()
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
