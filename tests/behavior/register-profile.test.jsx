import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http } from 'msw'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { server } from '../mocks/server.js'
import { fail, ok, recorder, resetSession, sessionHandlers, storeRefreshToken, student, url, useApiOrigin } from '../fixtures/auth.js'
import { TestApp } from '../fixtures/TestApp.jsx'

beforeEach(useApiOrigin)
afterEach(resetSession)

const location = () => screen.getByTestId('location').textContent

// Optional fields carry an "(optional)" hint inside their label.
const labelled = (label) => new RegExp(`^${label}\\s*(\\(optional\\))?$`)

async function fill(user, values) {
  for (const [label, value] of Object.entries(values)) {
    const field = await screen.findByLabelText(labelled(label))
    if (field.tagName === 'SELECT') await user.selectOptions(field, value)
    else await user.type(field, value)
  }
}

const required = {
  'First name': ' Amina ',
  'Last name': 'Yusuf',
  Email: 'student@example.test ',
  Password: 'a-Strong-pass-1',
  'Confirm password': 'a-Strong-pass-1',
}

describe('direct registration', () => {
  test('creates the account with D1 fields in one form and continues to sign-in', async () => {
    const rec = recorder()
    server.use(http.post(url('/accounts/register/'), async ({ request }) => {
      await rec.record(request)
      return ok({ ...student }, 'User registered successfully.', { status: 201 })
    }))
    const user = userEvent.setup()
    render(<TestApp path="/sign-up" />)
    await fill(user, { ...required, 'Matric number': 'CSC/21/001', Department: 'Computer Science', Level: '300' })
    await user.click(screen.getByRole('button', { name: 'Create account' }))

    expect(await screen.findByText('Account created. Sign in to continue.')).toBeVisible()
    expect(location()).toBe('/sign-in')
    expect(screen.getByLabelText('Email or matric number')).toHaveValue('student@example.test')
    expect(rec.calls).toEqual([{
      method: 'POST', path: '/accounts/register/', auth: null,
      body: {
        email: 'student@example.test', password: 'a-Strong-pass-1', password_confirm: 'a-Strong-pass-1',
        first_name: 'Amina', last_name: 'Yusuf', matric_number: 'CSC/21/001', department: 'Computer Science', level: '300',
      },
    }])
    expect(sessionStorage.getItem('pythagoras.refreshToken')).toBeNull()
  })

  test('optional matric/department/level are omitted when blank, and no verification step appears', async () => {
    const rec = recorder()
    server.use(http.post(url('/accounts/register/'), async ({ request }) => {
      await rec.record(request)
      return ok({ ...student, matric_number: null, department: '', level: '' }, 'Created.', { status: 201 })
    }))
    const user = userEvent.setup()
    render(<TestApp path="/sign-up" />)
    expect(await screen.findByLabelText(labelled('Level'))).toHaveDisplayValue('Select level')
    expect(screen.queryByText(/verif|otp|receipt/i)).not.toBeInTheDocument()
    expect(screen.getAllByRole('option').slice(1).map((option) => option.value)).toEqual(['100', '200', '300', '400', '500'])
    await fill(user, required)
    await user.click(screen.getByRole('button', { name: 'Create account' }))
    await screen.findByText('Account created. Sign in to continue.')
    expect(Object.keys(rec.calls[0].body).sort()).toEqual(['email', 'first_name', 'last_name', 'password', 'password_confirm'])
  })

  test('shows API field errors from data.fields next to their inputs', async () => {
    server.use(http.post(url('/accounts/register/'), () => fail(400, 'VALIDATION_ERROR', 'Correct the highlighted fields.', {
      email: ['A user with this email already exists.'],
      matric_number: ['A user with this matric number already exists.'],
      password: ['This password is too common.'],
    })))
    const user = userEvent.setup()
    render(<TestApp path="/sign-up" />)
    await fill(user, { ...required, 'Matric number': 'CSC/21/001' })
    await user.click(screen.getByRole('button', { name: 'Create account' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Correct the highlighted fields.')
    expect(screen.getByLabelText('Email')).toHaveAccessibleDescription('A user with this email already exists.')
    expect(screen.getByLabelText(labelled('Matric number'))).toHaveAccessibleDescription('A user with this matric number already exists.')
    expect(screen.getByLabelText('Password')).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByText('This password is too common.')).toBeVisible()
    expect(location()).toBe('/sign-up')
  })

  test('mismatched passwords and missing names are caught before any request', async () => {
    const user = userEvent.setup()
    render(<TestApp path="/sign-up" />)
    await fill(user, { Email: 'x@example.test', Password: 'one-pass', 'Confirm password': 'two-pass' })
    await user.click(screen.getByRole('button', { name: 'Create account' }))
    expect(await screen.findByText('Passwords do not match.')).toBeVisible()
    expect(screen.getByText('Enter your first name.')).toBeVisible()
    expect(screen.getByText('Enter your last name.')).toBeVisible()
  })
})

describe('profile', () => {
  async function openProfile(user = student) {
    const rec = recorder()
    server.use(...sessionHandlers(rec, user))
    storeRefreshToken()
    render(<TestApp path="/profile" />)
    await screen.findByRole('heading', { name: `${user.first_name} ${user.last_name}` })
    return rec
  }

  test('shows the account with email and matric read-only', async () => {
    await openProfile()
    expect(screen.getByText('student@example.test')).toBeVisible()
    expect(screen.getByLabelText('Email')).toBeDisabled()
    expect(screen.getByLabelText('Matric number')).toBeDisabled()
    expect(screen.getByLabelText('First name')).toHaveValue('Amina')
    expect(screen.getByLabelText('Level')).toHaveValue('300')
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled()
  })

  test('PATCHes only names/department/level and shows the persisted result', async () => {
    const rec = await openProfile()
    server.use(http.patch(url('/accounts/me/'), async ({ request }) => {
      const entry = await rec.record(request)
      return ok({ ...student, ...entry.body }, 'Profile updated.')
    }))
    const user = userEvent.setup()
    await user.clear(screen.getByLabelText('Department'))
    await user.type(screen.getByLabelText('Department'), ' Mathematics ')
    await user.selectOptions(screen.getByLabelText('Level'), '400')
    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    expect(await screen.findByText('Profile saved.')).toBeVisible()
    const patch = rec.calls.find((call) => call.method === 'PATCH')
    expect(patch).toEqual({
      method: 'PATCH', path: '/accounts/me/', auth: 'Bearer access-2',
      body: { first_name: 'Amina', last_name: 'Yusuf', department: 'Mathematics', level: '400' },
    })
    expect(screen.getByText('400 level', { selector: 'dd' })).toBeVisible()
    expect(screen.getByText('Mathematics', { selector: 'dd' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled()
  })

  test('shows field and permission errors without claiming success', async () => {
    await openProfile()
    const user = userEvent.setup()
    server.use(http.patch(url('/accounts/me/'), () =>
      fail(400, 'VALIDATION_ERROR', 'Correct the highlighted fields.', { first_name: ['This field may not be blank.'] })))
    await user.clear(screen.getByLabelText('First name'))
    await user.click(screen.getByRole('button', { name: 'Save changes' }))
    expect(await screen.findByText('This field may not be blank.')).toBeVisible()
    expect(screen.queryByText('Profile saved.')).not.toBeInTheDocument()

    server.use(http.patch(url('/accounts/me/'), () => fail(403, 'PERMISSION_DENIED', 'This account is inactive.')))
    await user.type(screen.getByLabelText('First name'), 'A')
    await user.click(screen.getByRole('button', { name: 'Save changes' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('This account is inactive.')
    expect(screen.queryByText('Profile saved.')).not.toBeInTheDocument()
  })
})
