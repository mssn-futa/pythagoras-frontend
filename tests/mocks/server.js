import { setupServer } from 'msw/node'

// Tests explicitly register their own handlers; no application/provider defaults.
export const server = setupServer()
