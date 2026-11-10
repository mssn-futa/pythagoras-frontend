import { test as base, expect } from '@playwright/test'

export const test = base.extend({
  // Auto fixture: fail even if application code swallows an aborted request.
  networkIsolation: [async ({ context, baseURL }, use) => {
    const unexpected = []
    await context.route('**/*', async (route) => {
      const request = route.request()
      const url = new URL(request.url())
      if (url.origin === baseURL && request.method() === 'GET' && !url.pathname.startsWith('/__harness__/')) {
        await route.continue()
      } else {
        unexpected.push(`${request.method()} ${request.url()}`)
        await route.abort('blockedbyclient')
      }
    })
    await use()
    expect(unexpected, 'Register explicit routes for API and external requests').toEqual([])
  }, { auto: true }],
})

export { expect }
