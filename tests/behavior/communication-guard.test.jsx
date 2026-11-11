import { render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { admin, recorder, resetSession, sessionHandlers, storeRefreshToken, student, useApiOrigin } from '../fixtures/auth.js'
import { createBackend } from '../fixtures/communication.js'
import { TestApp } from '../fixtures/TestApp.jsx'
import { server } from '../mocks/server.js'

beforeEach(useApiOrigin)
afterEach(resetSession)

describe('/admin/communication guard', () => {
  test('anonymous visitors go to sign-in and no broadcast request is made', async () => {
    const backend = createBackend()
    server.use(...backend.handlers)
    render(<TestApp path="/admin/communication/history" />)
    expect(await screen.findByLabelText('Email or matric number')).toBeVisible()
    expect(screen.getByTestId('location').textContent).toBe('/sign-in?next=%2Fadmin%2Fcommunication%2Fhistory')
    expect(backend.calls).toEqual([])
  })

  test('students are denied and never reach the page or the API', async () => {
    const backend = createBackend()
    server.use(...sessionHandlers(recorder(), student), ...backend.handlers)
    storeRefreshToken()
    render(<TestApp path="/admin/communication" />)
    expect(await screen.findByRole('heading', { name: 'Access denied' })).toBeVisible()
    expect(screen.queryByRole('heading', { name: 'Communication' })).toBeNull()
    expect(backend.calls).toEqual([])
  })

  test('admins see Compose, Drafts and History tabs', async () => {
    server.use(...sessionHandlers(recorder(), admin), ...createBackend().handlers)
    storeRefreshToken()
    render(<TestApp path="/admin/communication" />)
    expect(await screen.findByRole('heading', { name: 'Communication' })).toBeVisible()
    for (const name of ['Compose', 'Drafts', 'History']) expect(screen.getByRole('link', { name })).toBeVisible()
  })
})
