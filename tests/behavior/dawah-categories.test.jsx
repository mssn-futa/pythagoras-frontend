import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http } from 'msw'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { ok, resetSession, url, useApiOrigin } from '../fixtures/auth.js'
import { audio, event, page, publicHandlers } from '../fixtures/dawah.js'
import { apiHandler, paged, rawEvent, renderAdminApp } from '../fixtures/dawah.jsx'
import { TestApp } from '../fixtures/TestApp.jsx'
import { server } from '../mocks/server.js'
import { EVENT_CATEGORIES, categoryLabel } from '../../src/features/dawah/categories.js'

beforeEach(() => {
  useApiOrigin()
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
})
afterEach(resetSession)

describe('category label mapping', () => {
  test('canonical tokens map to human labels, other text is shown raw', () => {
    expect(EVENT_CATEGORIES.map((c) => c.value)).toEqual(['dawah_night', 'usroh', 'special_lecture', 'jumuah'])
    expect(categoryLabel('dawah_night')).toBe("Da'wah Night")
    expect(categoryLabel('usroh')).toBe('Usroh')
    expect(categoryLabel('special_lecture')).toBe('Special lecture')
    expect(categoryLabel('jumuah')).toBe("Jumu'ah")
    expect(categoryLabel('Halaqah')).toBe('Halaqah')
    expect(categoryLabel(undefined)).toBe('')
  })
})

describe('admin event form category', () => {
  const eventHandlers = (extra) => [
    http.get(url('/dawah/events/3/'), () => ok(rawEvent(extra))),
    http.get(url('/dawah/events/3/resources/'), () => ok(paged([]))),
  ]

  test('offers the four canonical options plus Other and sends the token', async () => {
    const patch = apiHandler('patch', '/dawah/events/3/', () => ok(rawEvent()))
    renderAdminApp('/admin/events/3', [...eventHandlers({ category: '' }), patch.handler])
    const user = userEvent.setup()
    const select = await screen.findByLabelText('Category')
    expect(within(select).getAllByRole('option').map((o) => o.textContent)).toEqual([
      'No category', "Da'wah Night", 'Usroh', 'Special lecture', "Jumu'ah", 'Other…',
    ])
    expect(screen.queryByLabelText('Other category')).not.toBeInTheDocument()
    await user.selectOptions(select, 'Special lecture')
    await user.click(screen.getByRole('button', { name: 'Save changes' }))
    await screen.findByText('Event saved.')
    expect(patch.rec.calls[0].body.category).toBe('special_lecture')
  })

  test('Other reveals free text and sends it trimmed', async () => {
    const patch = apiHandler('patch', '/dawah/events/3/', () => ok(rawEvent()))
    renderAdminApp('/admin/events/3', [...eventHandlers({ category: 'usroh' }), patch.handler])
    const user = userEvent.setup()
    const select = await screen.findByLabelText('Category')
    expect(select).toHaveValue('usroh')
    await user.selectOptions(select, 'Other…')
    const other = screen.getByLabelText('Other category')
    expect(other).toHaveValue('')
    await user.type(other, '  Halaqah ')
    await user.click(screen.getByRole('button', { name: 'Save changes' }))
    await screen.findByText('Event saved.')
    expect(patch.rec.calls[0].body.category).toBe('Halaqah')
  })

  test('editing an event with a non-canonical category preselects Other with its value', async () => {
    const patch = apiHandler('patch', '/dawah/events/3/', () => ok(rawEvent()))
    renderAdminApp('/admin/events/3', [...eventHandlers({ category: 'Halaqah' }), patch.handler])
    const user = userEvent.setup()
    const select = await screen.findByLabelText('Category')
    expect(select).toHaveValue('__other__')
    expect(screen.getByLabelText('Other category')).toHaveValue('Halaqah')
    await user.click(screen.getByRole('button', { name: 'Save changes' }))
    await screen.findByText('Event saved.')
    expect(patch.rec.calls[0].body.category).toBe('Halaqah')
  })

  test('a canonical category is preselected without the free-text input', async () => {
    renderAdminApp('/admin/events/3', eventHandlers({ category: 'jumuah' }))
    expect(await screen.findByLabelText('Category')).toHaveValue('jumuah')
    expect(screen.queryByLabelText('Other category')).not.toBeInTheDocument()
  })
})

describe('public category display and filter', () => {
  const serve = (handlers) => server.use(...publicHandlers(handlers).list)

  test('archive cards show the label for tokens and raw text otherwise', async () => {
    serve({
      '/dawah/archive/': () =>
        ok(page([audio(8), audio(9, { event: { ...audio(9).event, category: 'Halaqah' } })])),
    })
    render(<TestApp path="/dawah" />)
    expect(await screen.findAllByText(/Jumu'ah/)).not.toHaveLength(0)
    expect(screen.getAllByText(/Halaqah/)).not.toHaveLength(0)
    expect(screen.queryByText(/jumuah/)).not.toBeInTheDocument()
  })

  test('event detail shows the human label', async () => {
    serve()
    render(<TestApp path="/dawah/events/3" />)
    expect(await screen.findByRole('heading', { name: event.title })).toBeInTheDocument()
    expect(screen.getByText(/Jumu'ah/)).toBeInTheDocument()
  })

  test('category filter is a select of Any plus the four, kept in the URL param', async () => {
    const h = publicHandlers()
    server.use(...h.list)
    const user = userEvent.setup()
    render(<TestApp path="/dawah" />)
    await screen.findByText('2 recordings')
    const select = screen.getByLabelText('Category')
    expect(within(select).getAllByRole('option').map((o) => o.textContent)).toEqual([
      'Any', "Da'wah Night", 'Usroh', 'Special lecture', "Jumu'ah",
    ])
    await user.selectOptions(select, 'Usroh')
    await user.click(screen.getByRole('button', { name: 'Apply filters' }))
    expect(screen.getByTestId('location')).toHaveTextContent('/dawah?category=usroh')
    await vi.waitFor(() => expect(h.calls.filter((c) => c.path === '/dawah/archive/').at(-1).query.category).toBe('usroh'))
  })

  test('a URL category outside the canonical set is ignored', async () => {
    const h = publicHandlers()
    server.use(...h.list)
    render(<TestApp path="/dawah?category=whatever" />)
    await screen.findByText('2 recordings')
    expect(screen.getByLabelText('Category')).toHaveValue('')
    expect(h.calls.find((c) => c.path === '/dawah/archive/').query.category).toBeUndefined()
  })

  test('a URL category token preselects the filter', async () => {
    serve()
    render(<TestApp path="/dawah?category=jumuah" />)
    await screen.findByText('2 recordings')
    expect(screen.getByLabelText('Category')).toHaveValue('jumuah')
  })
})
