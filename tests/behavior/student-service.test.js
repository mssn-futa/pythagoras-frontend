import { http } from 'msw'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { server } from '../mocks/server.js'
import { ok, recorder, resetSession, url, useApiOrigin } from '../fixtures/auth.js'
import { setSessionTokens } from '../../src/services/api/session.js'
import {
  buildListParams, buildStudentPatch, getStudent, listStudents, setStudentActive, updateStudent,
} from '../../src/services/api/studentService.js'

beforeEach(() => {
  useApiOrigin()
  setSessionTokens({ access: 'access-1', refresh: 'refresh-1' })
})
afterEach(resetSession)

describe('buildListParams', () => {
  test('omits blank filters and maps names to the D1 query contract', () => {
    expect(buildListParams({})).toEqual({})
    expect(buildListParams({ search: ' amina ', department: 'Computer Science', level: '300', isActive: 'false', page: 3, pageSize: 20 }))
      .toEqual({ search: 'amina', department: 'Computer Science', level: '300', is_active: false, page: 3, page_size: 20 })
    expect(buildListParams({ search: '  ', department: '', level: '', isActive: '', page: 1 })).toEqual({})
    expect(buildListParams({ isActive: true })).toEqual({ is_active: true })
  })
})

describe('buildStudentPatch', () => {
  test('keeps only admin-editable fields, trims text, and unsets a cleared matric number', () => {
    expect(buildStudentPatch({
      first_name: ' Amina ', email: ' a@example.test ', matric_number: ' ', level: '', is_active: 0,
      role: 'admin', is_staff: true, password: 'x', id: 9,
    })).toEqual({ first_name: 'Amina', email: 'a@example.test', matric_number: null, level: '', is_active: false })
  })
})

describe('student API calls', () => {
  test('list sends bearer + query params and returns the unwrapped page', async () => {
    const rec = recorder()
    let search = ''
    server.use(http.get(url('/accounts/students/'), async ({ request }) => {
      await rec.record(request)
      search = new URL(request.url).search
      return ok({ count: 1, next: null, previous: null, results: [{ id: 5, email: 'a@example.test' }] })
    }))
    const page = await listStudents({ search: 'ami', level: '300', isActive: 'true', page: 2, pageSize: 10 })
    expect(page).toEqual({ count: 1, next: null, previous: null, results: [{ id: 5, email: 'a@example.test' }] })
    expect(Object.fromEntries(new URLSearchParams(search))).toEqual({ search: 'ami', level: '300', is_active: 'true', page: '2', page_size: '10' })
    expect(rec.calls[0].auth).toBe('Bearer access-1')
  })

  test('detail, patch and status use /accounts/students/{id}/', async () => {
    const rec = recorder()
    server.use(
      http.get(url('/accounts/students/7/'), async ({ request }) => { await rec.record(request); return ok({ id: 7 }) }),
      http.patch(url('/accounts/students/7/'), async ({ request }) => { const e = await rec.record(request); return ok({ id: 7, ...e.body }) }),
    )
    expect(await getStudent(7)).toEqual({ id: 7 })
    await updateStudent(7, { department: ' Law ', role: 'admin' })
    await setStudentActive(7, false)
    expect(rec.calls.map((c) => [c.method, c.path, c.body])).toEqual([
      ['GET', '/accounts/students/7/', null],
      ['PATCH', '/accounts/students/7/', { department: 'Law' }],
      ['PATCH', '/accounts/students/7/', { is_active: false }],
    ])
  })
})
