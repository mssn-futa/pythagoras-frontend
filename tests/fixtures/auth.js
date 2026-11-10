import { http, HttpResponse } from 'msw'
import { vi } from 'vitest'
import { clearSession, REFRESH_STORAGE_KEY } from '../../src/services/api/session.js'

// Synthetic, test-only identities shaped like the frozen D1 examples.
export const API = 'https://api.pythagoras.test'
export const url = (path) => `${API}${path}`

export const student = Object.freeze({
  id: 1,
  email: 'student@example.test',
  first_name: 'Amina',
  last_name: 'Yusuf',
  matric_number: 'CSC/21/001',
  department: 'Computer Science',
  level: '300',
  role: 'student',
  is_active: true,
})

export const admin = Object.freeze({
  ...student,
  id: 2,
  email: 'admin@example.test',
  first_name: 'Bilal',
  last_name: 'Okafor',
  matric_number: null,
  role: 'admin',
})

export const ok = (data, message = 'OK.', init) => HttpResponse.json({ success: true, data, message }, init)
export const fail = (status, code, message, fields) =>
  HttpResponse.json({ success: false, data: fields ? { code, fields } : { code }, message }, { status })

export function useApiOrigin() {
  vi.stubEnv('VITE_API_URL', `${API}/`)
}

/** Module-level token memory is not storage; reset it between tests. */
export function resetSession() {
  clearSession()
}

export function storeRefreshToken(token = 'refresh-1') {
  sessionStorage.setItem(REFRESH_STORAGE_KEY, token)
}

/** Records every request a handler saw: method, path, auth header and JSON body. */
export function recorder() {
  const calls = []
  const record = async (request) => {
    let body = null
    if (!['GET', 'HEAD'].includes(request.method)) {
      const text = await request.clone().text()
      body = text ? JSON.parse(text) : null
    }
    const entry = {
      method: request.method,
      path: new URL(request.url).pathname,
      auth: request.headers.get('authorization'),
      body,
    }
    calls.push(entry)
    return entry
  }
  return { calls, record, count: (path) => calls.filter((call) => call.path === path).length }
}

/** Standard restoration handlers: refresh → rotated pair, me → user. */
export function sessionHandlers(rec, user = student) {
  return [
    http.post(url('/accounts/refresh/'), async ({ request }) => {
      await rec.record(request)
      return ok({ access: 'access-2', refresh: 'refresh-2' }, 'Refreshed.')
    }),
    http.get(url('/accounts/me/'), async ({ request }) => {
      const entry = await rec.record(request)
      if (entry.auth !== 'Bearer access-2') return fail(401, 'NOT_AUTHENTICATED', 'Authentication required.')
      return ok(user)
    }),
  ]
}
