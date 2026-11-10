import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterAll, afterEach, beforeAll, expect, vi } from 'vitest'
import { server } from './mocks/server.js'

const unhandledRequests = []

beforeAll(() => {
  server.listen({
    onUnhandledRequest(request, print) {
      unhandledRequests.push(`${request.method} ${request.url}`)
      print.error()
    },
  })
})

afterEach(() => {
  cleanup()
  server.resetHandlers()
  localStorage.clear()
  sessionStorage.clear()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
  vi.useRealTimers()
  // Even a component that catches a rejected fetch cannot hide a network leak.
  const requests = unhandledRequests.splice(0)
  expect(requests, 'Unhandled requests must have explicit MSW handlers').toEqual([])
})

afterAll(() => server.close())
