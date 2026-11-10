import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { describe, expect, test, vi } from 'vitest'
import RequestHarness from '../fixtures/RequestHarness.jsx'
import { server } from '../mocks/server.js'

const endpoint = 'http://127.0.0.1:4179/__harness__/message'

test('renders and loads an intercepted response after interaction', async () => {
  const requests = []
  server.use(http.get(endpoint, ({ request }) => {
    requests.push(request.url)
    return HttpResponse.json({ success: true, data: { message: 'Isolated response' } })
  }))
  render(<RequestHarness />)
  expect(screen.getByRole('heading', { name: 'Frontend harness sample' })).toBeVisible()
  expect(screen.getByRole('status')).toHaveTextContent('No request yet')
  await userEvent.setup().click(screen.getByRole('button', { name: 'Load message' }))
  expect(await screen.findByText('Isolated response')).toBeVisible()
  expect(requests).toEqual([endpoint])
})

test('renders a request failure without a real backend', async () => {
  server.use(http.get(endpoint, () => new HttpResponse(null, { status: 503 })))
  render(<RequestHarness />)
  await userEvent.setup().click(screen.getByRole('button', { name: 'Load message' }))
  expect(await screen.findByText('Request unavailable')).toBeVisible()
  expect(screen.getByRole('button')).toBeEnabled()
})

describe.sequential('between-test cleanup contract', () => {
  test('creates state that must be removed by shared teardown', () => {
    render(<RequestHarness />)
    localStorage.setItem('harness', 'local state')
    sessionStorage.setItem('harness', 'session state')
    vi.stubGlobal('harnessLeak', true)
    vi.spyOn(console, 'info').mockImplementation(() => {})
    server.use(http.get(endpoint, () => HttpResponse.json({ leaked: true })))
    expect(server.listHandlers()).toHaveLength(1)
  })

  test('starts with clean DOM, storage, handlers, globals and mocks', () => {
    expect(document.body).toBeEmptyDOMElement()
    expect(localStorage.length).toBe(0)
    expect(sessionStorage.length).toBe(0)
    expect(server.listHandlers()).toHaveLength(0)
    expect('harnessLeak' in globalThis).toBe(false)
    expect(vi.isMockFunction(console.info)).toBe(false)
  })
})
