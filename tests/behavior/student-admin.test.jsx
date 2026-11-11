import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http } from 'msw'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { server } from '../mocks/server.js'
import { admin, fail, ok, recorder, resetSession, sessionHandlers, storeRefreshToken, student, url, useApiOrigin } from '../fixtures/auth.js'
import { TestApp } from '../fixtures/TestApp.jsx'

beforeEach(() => {
  useApiOrigin()
  storeRefreshToken()
})
afterEach(resetSession)

const location = () => screen.getByTestId('location').textContent

const row = (id, extra = {}) => ({
  ...student, id, email: `s${id}@example.test`, first_name: `First${id}`, last_name: `Last${id}`,
  matric_number: `CSC/21/${String(id).padStart(3, '0')}`, date_joined: '2026-03-01T23:30:00Z', ...extra,
})

/** Serves the list from `all`, honouring page/page_size/search/level/is_active; records query strings. */
function serveStudents(all, queries = []) {
  const rec = recorder()
  server.use(
    ...sessionHandlers(rec, admin),
    http.get(url('/accounts/students/'), ({ request }) => {
      const q = new URL(request.url).searchParams
      queries.push(Object.fromEntries(q))
      const size = Number(q.get('page_size') ?? 20)
      const page = Number(q.get('page') ?? 1)
      let rows = all
      if (q.get('search')) rows = rows.filter((r) => `${r.first_name} ${r.matric_number}`.toLowerCase().includes(q.get('search').toLowerCase()))
      if (q.get('department')) rows = rows.filter((r) => (r.department ?? '').toLowerCase() === q.get('department').trim().toLowerCase())
      if (q.get('level')) rows = rows.filter((r) => r.level === q.get('level'))
      if (q.get('is_active')) rows = rows.filter((r) => String(r.is_active) === q.get('is_active'))
      return ok({ count: rows.length, next: null, previous: null, results: rows.slice((page - 1) * size, page * size) })
    }),
  )
  return rec
}

describe('student list', () => {
  test('renders real rows with no sample data, and Lagos-local join date in detail', async () => {
    serveStudents([row(1), row(2, { is_active: false, level: '', department: '', matric_number: null })])
    render(<TestApp path="/admin/students" />)
    const table = await screen.findByRole('table')
    expect(within(table).getByText('First1 Last1')).toBeVisible()
    expect(within(table).getByText('s2@example.test')).toBeVisible()
    expect(within(table).getByText('Inactive')).toBeVisible()
    expect(screen.queryByText('John Doe')).not.toBeInTheDocument()
    expect(screen.queryByText('2,847')).not.toBeInTheDocument()
    expect(screen.getByText('2 students · Page 1 of 1')).toBeVisible()
  })

  test('filters and pagination are mapped to the API and synced to the URL', async () => {
    const all = Array.from({ length: 45 }, (_, i) => row(i + 1, { level: i % 2 ? '200' : '300' }))
    const queries = []
    serveStudents(all, queries)
    const user = userEvent.setup()
    render(<TestApp path="/admin/students" />)
    expect(await screen.findByText('45 students · Page 1 of 3')).toBeVisible()
    expect(queries.at(-1)).toEqual({ page_size: '20' })

    await user.click(screen.getByRole('button', { name: 'Next' }))
    expect(await screen.findByText('45 students · Page 2 of 3')).toBeVisible()
    expect(location()).toBe('/admin/students?page=2')
    expect(queries.at(-1)).toEqual({ page: '2', page_size: '20' })

    await user.selectOptions(screen.getByLabelText('Level'), '300')
    await screen.findByText('23 students · Page 1 of 2')
    expect(location()).toBe('/admin/students?level=300')

    await user.selectOptions(screen.getByLabelText('Status'), 'true')
    await user.type(screen.getByLabelText('Department (exact match)'), 'Law')
    await waitFor(() => expect(location()).toBe('/admin/students?department=Law&level=300&is_active=true'))
    expect(queries.at(-1)).toMatchObject({ department: 'Law', level: '300', is_active: 'true', page_size: '20' })

    await user.type(screen.getByLabelText('Search students'), 'first7')
    await waitFor(() => expect(location()).toContain('search=first7'))
    expect(queries.at(-1).search).toBe('first7')
  })

  test('filters are restored from the URL on load', async () => {
    const queries = []
    serveStudents([row(1)], queries)
    render(<TestApp path="/admin/students?search=ami&level=400&is_active=false&page=2" />)
    await screen.findByRole('status')
    await waitFor(() => expect(queries.length).toBeGreaterThan(0))
    expect(queries[0]).toEqual({ search: 'ami', level: '400', is_active: 'false', page: '2', page_size: '20' })
    expect(screen.getByLabelText('Search students')).toHaveValue('ami')
    expect(screen.getByLabelText('Level')).toHaveValue('400')
    expect(screen.getByLabelText('Status')).toHaveValue('false')
  })

  test('shows empty states without fabricating rows', async () => {
    serveStudents([])
    const { unmount } = render(<TestApp path="/admin/students" />)
    expect(await screen.findByText('No students have registered yet.')).toBeVisible()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    unmount()

    serveStudents([row(1)])
    render(<TestApp path="/admin/students?search=zzz" />)
    expect(await screen.findByText('No students match these filters.')).toBeVisible()
  })

  test('shows the API error with a retry that reloads', async () => {
    const rec = recorder()
    let calls = 0
    server.use(
      ...sessionHandlers(rec, admin),
      http.get(url('/accounts/students/'), () => {
        calls += 1
        return calls === 1 ? fail(500, 'SERVER_ERROR', 'Something went wrong.') : ok({ count: 1, next: null, previous: null, results: [row(1)] })
      }),
    )
    const user = userEvent.setup()
    render(<TestApp path="/admin/students" />)
    expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong.')
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByText('First1 Last1')).toBeVisible()
  })

  test('a non-admin never reaches the list request', async () => {
    const rec = recorder()
    server.use(...sessionHandlers(rec, student))
    render(<TestApp path="/admin/students" />)
    await waitFor(() => expect(rec.count('/accounts/me/')).toBe(1))
    expect(screen.queryByText('Student Management')).not.toBeInTheDocument()
  })
})

describe('student detail', () => {
  function serveDetail(record, patch) {
    const all = [record]
    const rec = serveStudents(all)
    server.use(
      http.get(url(`/accounts/students/${record.id}/`), () => ok(record)),
      http.patch(url(`/accounts/students/${record.id}/`), async ({ request }) => {
        const body = await request.json()
        rec.calls.push({ patch: body })
        const response = patch(body, record)
        if (response.status === 200) all[0] = { ...record, ...body } // persisted: later list fetches see it
        return response
      }),
    )
    return rec
  }
  const open = async (user) => {
    await user.click(await screen.findByRole('button', { name: 'View profile of First1 Last1' }))
    return screen.findByRole('dialog')
  }

  test('opens by id in the URL, edits only changed fields and updates the row', async () => {
    const rec = serveDetail(row(1), (body, record) => ok({ ...record, ...body }))
    const user = userEvent.setup()
    render(<TestApp path="/admin/students" />)
    const dialog = await open(user)
    expect(location()).toBe('/admin/students?student=1')
    expect(await within(dialog).findByLabelText('Email')).toHaveValue('s1@example.test')
    expect(within(dialog).getByText('Joined 2 Mar 2026')).toBeVisible() // 23:30 UTC is next day in Lagos

    const save = within(dialog).getByRole('button', { name: 'Save changes' })
    expect(save).toBeDisabled()
    const dept = within(dialog).getByLabelText('Department')
    await user.clear(dept)
    await user.type(dept, ' Law ')
    await user.selectOptions(within(dialog).getByLabelText('Level'), '400')
    await user.click(save)

    expect(await within(dialog).findByText('Changes saved.')).toBeVisible()
    expect(rec.calls.find((c) => c.patch).patch).toEqual({ department: 'Law', level: '400' })
    expect(within(screen.getByRole('table')).getByText('Law')).toBeVisible()

    await user.click(within(dialog).getByRole('button', { name: 'Close' }))
    expect(location()).toBe('/admin/students')
  })

  test('loads from a reloaded detail URL', async () => {
    serveDetail(row(1), (body, record) => ok({ ...record, ...body }))
    render(<TestApp path="/admin/students?student=1" />)
    expect(await screen.findByRole('heading', { name: 'First1 Last1' })).toBeVisible()
  })

  test('shows API field errors on the inputs and does not claim success', async () => {
    serveDetail(row(1), () => fail(400, 'VALIDATION_ERROR', 'Invalid input.', { email: ['A student with this email already exists.'], level: ['Not a valid level.'] }))
    const user = userEvent.setup()
    render(<TestApp path="/admin/students" />)
    const dialog = await open(user)
    const email = await within(dialog).findByLabelText('Email')
    await user.clear(email)
    await user.type(email, 'taken@example.test')
    await user.click(within(dialog).getByRole('button', { name: 'Save changes' }))

    expect(await within(dialog).findByText('A student with this email already exists.')).toBeVisible()
    expect(within(dialog).getByText('Not a valid level.')).toBeVisible()
    expect(email).toHaveAttribute('aria-invalid', 'true')
    expect(within(dialog).queryByText('Changes saved.')).not.toBeInTheDocument()
    expect(within(screen.getByRole('table')).getByText('s1@example.test')).toBeVisible()
  })

  test('unknown student shows a not-found state', async () => {
    const rec = serveStudents([row(1)])
    server.use(http.get(url('/accounts/students/99/'), () => fail(404, 'NOT_FOUND', 'Not found.')))
    render(<TestApp path="/admin/students?student=99" />)
    expect(await screen.findByText('This student could not be found.')).toBeVisible()
    expect(rec).toBeTruthy()
  })
})

describe('activate / deactivate', () => {
  function setup(patch) {
    const all = [row(1)]
    const rec = serveStudents(all)
    server.use(
      http.get(url('/accounts/students/1/'), () => ok(row(1))),
      http.patch(url('/accounts/students/1/'), async ({ request }) => {
        const body = await request.json()
        rec.calls.push({ patch: body })
        const response = patch(body)
        if (response.status === 200) all[0] = { ...all[0], ...body }
        return response
      }),
    )
    return rec
  }
  const patches = (rec) => rec.calls.filter((c) => c.patch).map((c) => c.patch)

  test('requires confirmation; cancel sends nothing', async () => {
    const rec = setup((body) => ok({ ...row(1), ...body }))
    const user = userEvent.setup()
    render(<TestApp path="/admin/students?student=1" />)
    await user.click(await screen.findByRole('button', { name: 'Deactivate account' }))
    expect(screen.getByRole('alertdialog')).toHaveTextContent('Deactivate First1 Last1?')
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(patches(rec)).toEqual([])
  })

  test('confirmed deactivation persists and the row and drawer show Inactive', async () => {
    const rec = setup((body) => ok({ ...row(1), ...body }))
    const user = userEvent.setup()
    render(<TestApp path="/admin/students?student=1" />)
    await user.click(await screen.findByRole('button', { name: 'Deactivate account' }))
    await user.click(screen.getByRole('button', { name: 'Confirm deactivate' }))
    expect(await screen.findByRole('button', { name: 'Activate account' })).toBeVisible()
    expect(patches(rec)).toEqual([{ is_active: false }])
    expect(within(screen.getByRole('table')).getByText('Inactive')).toBeVisible()
  })

  test.each([
    [409, 'CONFLICT', 'This change conflicts with the current account state.'],
    [403, 'PERMISSION_DENIED', 'You do not have permission to perform this action.'],
  ])('a %i failure is shown and the status is unchanged', async (status, code, message) => {
    setup(() => fail(status, code, message))
    const user = userEvent.setup()
    render(<TestApp path="/admin/students?student=1" />)
    await user.click(await screen.findByRole('button', { name: 'Deactivate account' }))
    await user.click(screen.getByRole('button', { name: 'Confirm deactivate' }))
    expect(await within(screen.getByRole('alertdialog')).findByRole('alert')).toHaveTextContent(message)
    expect(within(screen.getByRole('table')).getByText('Active')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Confirm deactivate' })).toBeEnabled()
  })
})

describe('drawer robustness', () => {
  test('a save that finishes after switching students does not corrupt the new drawer, and refreshes the list', async () => {
    const queries = []
    serveStudents([row(1), row(2)], queries)
    let release
    const gate = new Promise((resolve) => { release = resolve })
    server.use(
      http.get(url('/accounts/students/1/'), () => ok(row(1))),
      http.get(url('/accounts/students/2/'), () => ok(row(2))),
      http.patch(url('/accounts/students/1/'), async ({ request }) => {
        const body = await request.json()
        await gate
        return ok({ ...row(1), ...body })
      }),
    )
    const user = userEvent.setup()
    render(<TestApp path="/admin/students?student=1" />)
    const dept = await screen.findByLabelText('Department')
    await user.clear(dept)
    await user.type(dept, 'Law')
    await user.click(screen.getByRole('button', { name: 'Save changes' }))
    const listCalls = () => queries.length
    const before = listCalls()
    // Switch to student 2 while the PATCH is in flight.
    await user.click(await screen.findByRole('button', { name: 'Close' }))
    await user.click(screen.getByRole('button', { name: 'View profile of First2 Last2' }))
    expect(await screen.findByRole('heading', { name: 'First2 Last2' })).toBeVisible()
    await act(async () => { release() })
    await waitFor(() => expect(listCalls()).toBeGreaterThan(before))
    expect(screen.getByRole('heading', { name: 'First2 Last2' })).toBeVisible()
    expect(screen.getByLabelText('Email')).toHaveValue('s2@example.test')
    expect(screen.queryByText('Changes saved.')).not.toBeInTheDocument()
  })

  test('traps Tab inside the dialog, and restores focus to the opener on close', async () => {
    serveStudents([row(1)])
    server.use(http.get(url('/accounts/students/1/'), () => ok(row(1))))
    const user = userEvent.setup()
    render(<TestApp path="/admin/students" />)
    const opener = await screen.findByRole('button', { name: 'View profile of First1 Last1' })
    opener.focus()
    await user.click(opener)
    const dialog = await screen.findByRole('dialog')
    await within(dialog).findByLabelText('Email')
    await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true))
    for (let i = 0; i < 14; i += 1) {
      await user.tab()
      expect(dialog.contains(document.activeElement)).toBe(true)
    }
    for (let i = 0; i < 14; i += 1) {
      await user.tab({ shift: true })
      expect(dialog.contains(document.activeElement)).toBe(true)
    }
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(opener).toHaveFocus()
  })

  test('focus moves to Confirm, then back to the status button after cancel and after success', async () => {
    serveStudents([row(1)])
    server.use(
      http.get(url('/accounts/students/1/'), () => ok(row(1))),
      http.patch(url('/accounts/students/1/'), async ({ request }) => ok({ ...row(1), ...(await request.json()) })),
    )
    const user = userEvent.setup()
    render(<TestApp path="/admin/students?student=1" />)
    await user.click(await screen.findByRole('button', { name: 'Deactivate account' }))
    expect(screen.getByRole('button', { name: 'Confirm deactivate' })).toHaveFocus()
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.getByRole('button', { name: 'Deactivate account' })).toHaveFocus()
    await user.click(screen.getByRole('button', { name: 'Deactivate account' }))
    await user.click(screen.getByRole('button', { name: 'Confirm deactivate' }))
    expect(await screen.findByRole('button', { name: 'Activate account' })).toHaveFocus()
  })

  test('a saved change refetches the list so filtered results stay correct', async () => {
    const queries = []
    serveStudents([row(1), row(2, { level: '200' })], queries)
    server.use(
      http.get(url('/accounts/students/1/'), () => ok(row(1))),
      http.patch(url('/accounts/students/1/'), async ({ request }) => ok({ ...row(1), ...(await request.json()) })),
    )
    const user = userEvent.setup()
    render(<TestApp path="/admin/students?student=1" />)
    await screen.findByLabelText('Email')
    const before = queries.length
    await user.click(screen.getByRole('button', { name: 'Deactivate account' }))
    await user.click(screen.getByRole('button', { name: 'Confirm deactivate' }))
    await waitFor(() => expect(queries.length).toBeGreaterThan(before))
  })
})

describe('out-of-range page', () => {
  test('a 404 on a later page offers a way back to the first page', async () => {
    const rec = recorder()
    server.use(
      ...sessionHandlers(rec, admin),
      http.get(url('/accounts/students/'), ({ request }) => {
        const page = new URL(request.url).searchParams.get('page')
        return page === '9' ? fail(404, 'NOT_FOUND', 'Invalid page.') : ok({ count: 1, next: null, previous: null, results: [row(1)] })
      }),
    )
    const user = userEvent.setup()
    render(<TestApp path="/admin/students?page=9&level=300" />)
    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid page.')
    await user.click(screen.getByRole('button', { name: 'Go to first page' }))
    expect(await screen.findByText('First1 Last1')).toBeVisible()
    expect(location()).toBe('/admin/students?level=300')
  })
})

describe('student list on small screens', () => {
  afterEach(() => { delete window.matchMedia })

  test('renders stacked cards instead of the table', async () => {
    window.matchMedia = (query) => ({
      matches: true, media: query, addEventListener() {}, removeEventListener() {},
    })
    serveStudents([row(1, { department: 'Mechanical Engineering', level: '300' })])
    render(<TestApp path="/admin/students" />)
    const cards = await screen.findByTestId('student-cards')
    expect(screen.queryByRole('table')).toBeNull()
    expect(within(cards).getByText(/Mechanical Engineering/)).toBeInTheDocument()
    expect(within(cards).getByRole('button', { name: 'View profile of First1 Last1' })).toBeInTheDocument()
  })
})
