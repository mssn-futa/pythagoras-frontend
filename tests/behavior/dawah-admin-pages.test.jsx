import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http } from 'msw'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { server } from '../mocks/server.js'
import { fail, ok, recorder, resetSession, sessionHandlers, storeRefreshToken, student, url, useApiOrigin } from '../fixtures/auth.js'
import { apiHandler, paged, rawEvent, rawResource, renderAdminApp } from '../fixtures/dawah.jsx'
import { TestApp } from '../fixtures/TestApp.jsx'

beforeEach(useApiOrigin)
afterEach(resetSession)

const location = () => screen.getByTestId('location').textContent

describe('route guard (admin only)', () => {
  test('a student session sees access denied and no admin request is made', async () => {
    const events = apiHandler('get', '/dawah/events/', () => ok(paged([])))
    server.use(...sessionHandlers(recorder(), student), events.handler)
    storeRefreshToken()
    render(<TestApp path="/admin/events" />)
    expect(await screen.findByText(/do not have permission|access denied|not allowed/i)).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Events' })).not.toBeInTheDocument()
    expect(events.rec.calls).toEqual([])
  })

  test('an anonymous visitor is sent to sign-in', async () => {
    render(<TestApp path="/admin/content" />)
    expect(await screen.findByRole('button', { name: 'Sign in' })).toBeInTheDocument()
    expect(location()).toBe('/sign-in?next=%2Fadmin%2Fcontent')
  })

  test('an admin reaches the events page', async () => {
    renderAdminApp('/admin/events', [http.get(url('/dawah/events/'), () => ok(paged([rawEvent()])))])
    expect(await screen.findByRole('heading', { name: 'Events' })).toBeInTheDocument()
    expect(await screen.findByRole('link', { name: 'Friday khutbah' })).toHaveAttribute('href', '/admin/events/3')
  })
})

describe('events list', () => {
  test('filters by status, sends page params, shows Lagos time and pages', async () => {
    const seen = []
    const handler = http.get(url('/dawah/events/'), ({ request }) => {
      const search = new URL(request.url).searchParams
      seen.push(Object.fromEntries(search))
      const page = Number(search.get('page'))
      return ok(paged([rawEvent({ id: page, title: `Event ${page}` })], { count: 25, next: page === 1 ? 'next' : null, previous: page === 2 ? 'prev' : null }))
    })
    renderAdminApp('/admin/events', [handler])
    expect(await screen.findByText('Event 1')).toBeInTheDocument()
    expect(screen.getByText(/13:00 WAT/)).toBeInTheDocument()
    expect(seen[0]).toMatchObject({ status: 'all', page: '1', page_size: '20' })

    const user = userEvent.setup()
    await user.selectOptions(screen.getByLabelText('Status'), 'draft')
    expect(await screen.findByText('Event 1')).toBeInTheDocument()
    expect(seen.at(-1)).toMatchObject({ status: 'draft', page: '1' })
    expect(location()).toBe('/admin/events?status=draft')

    await user.click(screen.getByRole('button', { name: 'Next' }))
    expect(await screen.findByText('Event 2')).toBeInTheDocument()
    expect(seen.at(-1)).toMatchObject({ status: 'draft', page: '2' })
    expect(screen.getByText('Page 2 of 2')).toBeInTheDocument()
  })

  test('empty and error states, with retry', async () => {
    let fails = true
    renderAdminApp('/admin/events', [http.get(url('/dawah/events/'), () => (fails ? fail(503, 'SERVICE_UNAVAILABLE', 'Down for maintenance.') : ok(paged([]))))])
    expect(await screen.findByText('Down for maintenance.')).toBeInTheDocument()
    fails = false
    await userEvent.setup().click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByText('No events found')).toBeInTheDocument()
  })
})

describe('event create/edit form', () => {
  test('client validation blocks an end time that is not after the start', async () => {
    const create = apiHandler('post', '/dawah/events/', () => ok(rawEvent(), 'Saved.', { status: 201 }))
    renderAdminApp('/admin/events/new', [create.handler])
    const user = userEvent.setup()
    await user.type(await screen.findByLabelText('Title'), 'Friday khutbah')
    await user.type(screen.getByLabelText(/Starts/), '2026-10-09T13:00')
    await user.type(screen.getByLabelText(/Ends/), '2026-10-09T13:00')
    await user.click(screen.getByRole('button', { name: 'Create event' }))
    expect(await screen.findByText('End time must be after the start time.')).toBeInTheDocument()
    expect(create.rec.calls).toEqual([])
  })

  test('submits UTC times, shows server field errors, then opens the saved draft', async () => {
    let attempt = 0
    const create = apiHandler('post', '/dawah/events/', () => {
      attempt += 1
      if (attempt === 1) return fail(400, 'VALIDATION_ERROR', 'Correct the highlighted fields.', { title: ['An event with this title already exists.'] })
      return ok(rawEvent({ id: 5, title: 'Friday khutbah' }), 'Saved.', { status: 201 })
    })
    const detail = http.get(url('/dawah/events/5/'), () => ok(rawEvent({ id: 5 })))
    renderAdminApp('/admin/events/new', [create.handler, detail, http.get(url('/dawah/events/5/resources/'), () => ok(paged([])))])
    const user = userEvent.setup()
    await user.type(await screen.findByLabelText('Title'), 'Friday khutbah')
    await user.type(screen.getByLabelText(/Starts/), '2026-10-09T13:00')
    await user.type(screen.getByLabelText(/Ends/), '2026-10-09T14:00')
    await user.click(screen.getByRole('button', { name: 'Create event' }))
    expect(await screen.findByText('An event with this title already exists.')).toBeInTheDocument()
    expect(screen.getByLabelText('Title')).toHaveAttribute('aria-invalid', 'true')
    expect(create.rec.calls[0].body).toMatchObject({ start_time: '2026-10-09T12:00:00Z', end_time: '2026-10-09T13:00:00Z', title: 'Friday khutbah' })

    await user.click(screen.getByRole('button', { name: 'Create event' }))
    expect(await screen.findByText('Draft event created.')).toBeInTheDocument()
    expect(location()).toBe('/admin/events/5')
  })

  test('reload shows the persisted draft values in Lagos time, edit patches', async () => {
    const patch = apiHandler('patch', '/dawah/events/3/', () => ok(rawEvent({ title: 'Renamed' })))
    renderAdminApp('/admin/events/3', [
      http.get(url('/dawah/events/3/'), () => ok(rawEvent())),
      http.get(url('/dawah/events/3/resources/'), () => ok(paged([]))),
      patch.handler,
    ])
    const user = userEvent.setup()
    const title = await screen.findByLabelText('Title')
    expect(title).toHaveValue('Friday khutbah')
    expect(screen.getByLabelText(/Starts/)).toHaveValue('2026-10-09T13:00')
    await user.clear(title)
    await user.type(title, 'Renamed')
    await user.click(screen.getByRole('button', { name: 'Save changes' }))
    expect(await screen.findByText('Event saved.')).toBeInTheDocument()
    expect(patch.rec.calls[0].body.title).toBe('Renamed')
    expect(screen.getByText('No resources yet')).toBeInTheDocument()
  })
})

describe('event publication and deletion', () => {
  function eventServer(initial) {
    const state = { status: initial, deleteCode: null }
    const calls = []
    const handlers = [
      http.get(url('/dawah/events/3/'), () => ok(rawEvent({ status: state.status }))),
      http.get(url('/dawah/events/3/resources/'), () => ok(paged([rawResource()]))),
      http.post(url('/dawah/events/3/publish/'), () => { calls.push('publish'); state.status = 'published'; return ok(rawEvent({ status: 'published' })) }),
      http.post(url('/dawah/events/3/unpublish/'), () => { calls.push('unpublish'); state.status = 'unpublished'; return ok(rawEvent({ status: 'unpublished' })) }),
      http.delete(url('/dawah/events/3/'), () => {
        calls.push('delete')
        return state.deleteCode ? fail(409, state.deleteCode, 'Referenced by a quiz.') : new Response(null, { status: 204 })
      }),
      http.get(url('/dawah/events/'), () => ok(paged([]))),
    ]
    return { state, calls, handlers }
  }

  test('draft → published → unpublished → republished, reloading server state each time', async () => {
    const server_ = eventServer('draft')
    renderAdminApp('/admin/events/3', server_.handlers)
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: 'Publish event' }))
    expect(await screen.findByText('Event published.')).toBeInTheDocument()
    const publication = screen.getByRole('region', { name: 'Publication' })
    await user.click(await within(publication).findByRole('button', { name: 'Unpublish event' }))
    await user.click(within(publication).getByRole('button', { name: 'Unpublish' }))
    expect(await screen.findByText('Event unpublished.')).toBeInTheDocument()
    await user.click(await screen.findByRole('button', { name: 'Republish event' }))
    expect(await screen.findByText('Event published.')).toBeInTheDocument()
    expect(server_.calls).toEqual(['publish', 'unpublish', 'publish'])
  })

  test('a publish conflict is reported and state is unchanged', async () => {
    const server_ = eventServer('draft')
    server_.handlers.unshift(http.post(url('/dawah/events/3/publish/'), () => fail(409, 'INVALID_STATE', 'Event timing is invalid for publication.')))
    renderAdminApp('/admin/events/3', server_.handlers)
    await userEvent.setup().click(await screen.findByRole('button', { name: 'Publish event' }))
    expect(await screen.findByText('Event timing is invalid for publication.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Publish event' })).toBeEnabled()
  })

  test('RESOURCE_REFERENCED deletion conflict gets actionable copy and keeps the page', async () => {
    const server_ = eventServer('unpublished')
    server_.state.deleteCode = 'RESOURCE_REFERENCED'
    renderAdminApp('/admin/events/3', server_.handlers)
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: 'Delete event' }))
    await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Delete event' }))
    expect(await screen.findByText(/referenced by a quiz, so it cannot be deleted/i)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Friday khutbah' })).toBeInTheDocument()
  })

  test('successful delete returns to the list; published events cannot be deleted', async () => {
    const server_ = eventServer('draft')
    renderAdminApp('/admin/events/3', server_.handlers)
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: 'Delete event' }))
    await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Delete event' }))
    expect(await screen.findByRole('heading', { name: 'Events' })).toBeInTheDocument()
    expect(location()).toBe('/admin/events')
    expect(server_.calls).toEqual(['delete'])
  })

  test('published events show no delete control', async () => {
    renderAdminApp('/admin/events/3', eventServer('published').handlers)
    expect(await screen.findByRole('button', { name: 'Unpublish event' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Delete event' })).not.toBeInTheDocument()
  })
})

describe('content list and resource page', () => {
  test('content page lists an event\'s resources with type/status filters and empty state', async () => {
    renderAdminApp('/admin/content?event=3', [
      http.get(url('/dawah/events/'), () => ok(paged([rawEvent()]))),
      http.get(url('/dawah/events/3/resources/'), () => ok(paged([
        rawResource({ id: 8, title: 'Patience', status: 'published', storage_status: 'ready' }),
        rawResource({ id: 9, title: 'Slides', type: 'doc', storage_status: 'ready' }),
      ]))),
    ])
    expect(await screen.findByRole('link', { name: 'Patience' })).toHaveAttribute('href', '/admin/events/3/resources/8')
    expect(screen.getByRole('link', { name: 'Slides' })).toBeInTheDocument()
    const user = userEvent.setup()
    await user.selectOptions(screen.getByLabelText('Type'), 'doc')
    expect(screen.queryByRole('link', { name: 'Patience' })).not.toBeInTheDocument()
    await user.selectOptions(screen.getByLabelText('Status'), 'published')
    expect(await screen.findByText('No resources match these filters.')).toBeInTheDocument()
  })

  test('creating a resource saves a draft once then opens its upload page', async () => {
    const create = apiHandler('post', '/dawah/events/3/resources/', () => ok(rawResource({ id: 21, title: 'Patience' }), 'Saved.', { status: 201 }))
    renderAdminApp('/admin/events/3/resources/new', [
      http.get(url('/dawah/events/3/'), () => ok(rawEvent())),
      create.handler,
      http.get(url('/dawah/events/3/resources/21/'), () => ok(rawResource({ id: 21, title: 'Patience' }))),
    ])
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: 'Save draft' }))
    expect(await screen.findByText('Enter a title.')).toBeInTheDocument()
    await user.type(screen.getByLabelText('Title'), 'Patience')
    await user.click(screen.getByRole('button', { name: 'Save draft' }))
    expect(await screen.findByText('Draft saved. Now upload the audio file.')).toBeInTheDocument()
    expect(location()).toBe('/admin/events/3/resources/21')
    expect(create.rec.calls).toHaveLength(1)
    expect(create.rec.calls[0].body).toEqual({ title: 'Patience', type: 'aud' })
  })

  function resourceServer({ status = 'draft', storage = 'none', publishError = null } = {}) {
    const state = { status, storage }
    const calls = []
    return {
      state, calls,
      handlers: [
        http.get(url('/dawah/events/3/'), () => ok(rawEvent({ status: 'published' }))),
        http.get(url('/dawah/events/3/resources/8/'), () => ok(rawResource({ status: state.status, storage_status: state.storage, media_url: state.status === 'published' ? 'https://media.example.test/k.mp3' : null }))),
        http.post(url('/dawah/events/3/resources/8/publish/'), () => {
          calls.push('publish')
          if (publishError) return publishError
          state.status = 'published'
          return ok({})
        }),
        http.post(url('/dawah/events/3/resources/8/unpublish/'), () => { calls.push('unpublish'); state.status = 'unpublished'; return ok({}) }),
        http.delete(url('/dawah/events/3/resources/8/'), () => { calls.push('delete'); return new Response(null, { status: 204 }) }),
        http.get(url('/dawah/events/3/resources/'), () => ok(paged([]))),
        http.get(url('/dawah/events/'), () => ok(paged([]))),
      ],
    }
  }

  test('publishing audio that is not ready shows MEDIA_NOT_READY and stays a draft', async () => {
    const res = resourceServer({ publishError: fail(409, 'MEDIA_NOT_READY', 'Not ready.') })
    renderAdminApp('/admin/events/3/resources/8', res.handlers)
    await userEvent.setup().click(await screen.findByRole('button', { name: 'Publish resource' }))
    expect(await screen.findByText(/audio is not ready yet/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Publish resource' })).toBeEnabled()
  })

  test('ready audio publishes, can be unpublished, and then deleted', async () => {
    const res = resourceServer({ storage: 'ready' })
    renderAdminApp('/admin/events/3/resources/8', res.handlers)
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: 'Publish resource' }))
    expect(await screen.findByText('Resource published.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Delete resource' })).not.toBeInTheDocument()
    expect(screen.getByText(/Published audio cannot be replaced/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Unpublish resource' }))
    await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Unpublish' }))
    expect(await screen.findByText('Resource unpublished.')).toBeInTheDocument()
    await user.click(await screen.findByRole('button', { name: 'Delete resource' }))
    await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Delete resource' }))
    expect(await screen.findByRole('heading', { name: 'Friday khutbah' })).toBeInTheDocument()
    expect(res.calls).toEqual(['publish', 'unpublish', 'delete'])
  })
})
