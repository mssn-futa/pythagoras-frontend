import { act, render, renderHook, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { POLL_INTERVAL_MS, POLL_MAX_POLLS } from '../../src/features/communication/model.js'
import { usePolling } from '../../src/features/communication/usePolling.js'
import { admin, fail, recorder, resetSession, sessionHandlers, storeRefreshToken, url, useApiOrigin } from '../fixtures/auth.js'
import { counts, createBackend, wireBroadcast, wireDelivery } from '../fixtures/communication.js'
import { TestApp } from '../fixtures/TestApp.jsx'
import { http } from 'msw'
import { server } from '../mocks/server.js'

beforeEach(useApiOrigin)
afterEach(resetSession)

function open(backend, path) {
  server.use(...sessionHandlers(recorder(), admin), ...backend.handlers)
  storeRefreshToken()
  return render(<TestApp path={path} />)
}

const queuedBroadcast = (over = {}) =>
  wireBroadcast({ id: 7, state: 'queued', queued_at: '2026-11-10T10:00:00Z', recipient_count: 4, counts: counts({ queued: 4 }), ...over })

describe('usePolling (fake timers)', () => {
  beforeEach(() => vi.useFakeTimers())

  test('does not run while inactive, runs on the interval while active, stops when inactive', async () => {
    const task = vi.fn().mockResolvedValue(undefined)
    const { rerender } = renderHook(({ active }) => usePolling(task, { active, intervalMs: 1000 }), { initialProps: { active: false } })
    await act(() => vi.advanceTimersByTimeAsync(5000))
    expect(task).not.toHaveBeenCalled()

    rerender({ active: true })
    await act(() => vi.advanceTimersByTimeAsync(3000))
    expect(task).toHaveBeenCalledTimes(3)

    rerender({ active: false })
    await act(() => vi.advanceTimersByTimeAsync(10_000))
    expect(task).toHaveBeenCalledTimes(3)
  })

  test('stops on unmount', async () => {
    const task = vi.fn().mockResolvedValue(undefined)
    const { unmount } = renderHook(() => usePolling(task, { active: true, intervalMs: 1000 }))
    await act(() => vi.advanceTimersByTimeAsync(2000))
    unmount()
    await act(() => vi.advanceTimersByTimeAsync(10_000))
    expect(task).toHaveBeenCalledTimes(2)
  })

  test('is bounded by maxPolls and reports paused; restart begins a new cycle', async () => {
    const task = vi.fn().mockResolvedValue(undefined)
    const { result } = renderHook(() => usePolling(task, { active: true, intervalMs: 1000, maxPolls: 3 }))
    await act(() => vi.advanceTimersByTimeAsync(20_000))
    expect(task).toHaveBeenCalledTimes(3)
    expect(result.current.paused).toBe(true)
    act(() => result.current.restart())
    expect(result.current.paused).toBe(false)
    await act(() => vi.advanceTimersByTimeAsync(20_000))
    expect(task).toHaveBeenCalledTimes(6)
  })

  test('gives up after consecutive failures but a success resets the streak', async () => {
    const task = vi.fn().mockRejectedValueOnce(new Error('x')).mockRejectedValueOnce(new Error('x')).mockResolvedValueOnce(undefined).mockRejectedValue(new Error('x'))
    const { result } = renderHook(() => usePolling(task, { active: true, intervalMs: 1000, maxFailures: 3 }))
    await act(() => vi.advanceTimersByTimeAsync(20_000))
    expect(task).toHaveBeenCalledTimes(6) // 2 fails, success, then 3 fails
    expect(result.current.paused).toBe(true)
  })
})

describe('detail polling against the API', () => {
  // Fake timers auto-advance with real time so MSW and the app start normally; tests jump by the poll interval.
  beforeEach(() => vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'], shouldAdvanceTime: true }))

  const detailCalls = (backend) => backend.only('GET', '/dawah/broadcasts/7/').length

  test('polls while queued, then stops at the terminal state', async () => {
    const backend = createBackend({ broadcasts: [queuedBroadcast()], deliveries: { 7: [wireDelivery()] } })
    open(backend, '/admin/communication/history/7')
    expect(await screen.findByText('Delivery outcomes')).toBeVisible()
    expect(detailCalls(backend)).toBe(1)

    await act(() => vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS))
    await waitFor(() => expect(detailCalls(backend)).toBe(2))

    Object.assign(backend.store.get(7), { state: 'completed', counts: counts({ sent: 4 }) })
    await act(() => vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS))
    await waitFor(() => expect(screen.getAllByText('Completed').length).toBeGreaterThan(0))
    const settled = detailCalls(backend)
    await act(() => vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS * 10))
    expect(detailCalls(backend)).toBe(settled)
  })

  test('already-terminal broadcasts are never polled', async () => {
    const backend = createBackend({ broadcasts: [queuedBroadcast({ state: 'completed_with_errors', counts: counts({ sent: 3, failed: 1 }) })], deliveries: { 7: [] } })
    open(backend, '/admin/communication/history/7')
    expect(await screen.findByText('Delivery outcomes')).toBeVisible()
    await act(() => vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS * 10))
    expect(detailCalls(backend)).toBe(1)
  })

  test('stops at unmount', async () => {
    const backend = createBackend({ broadcasts: [queuedBroadcast()], deliveries: { 7: [] } })
    const { unmount } = open(backend, '/admin/communication/history/7')
    expect(await screen.findByText('Delivery outcomes')).toBeVisible()
    await act(() => vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS))
    await waitFor(() => expect(detailCalls(backend)).toBe(2))
    unmount()
    await act(() => vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS * 10))
    expect(detailCalls(backend)).toBe(2)
  })

  test('after the bound, shows paused with a manual refresh', async () => {
    const backend = createBackend({ broadcasts: [queuedBroadcast()], deliveries: { 7: [] } })
    open(backend, '/admin/communication/history/7')
    expect(await screen.findByText('Delivery outcomes')).toBeVisible()
    for (let i = 0; i < POLL_MAX_POLLS; i += 1) {
      await act(() => vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS))
    }
    expect(await screen.findByText('Automatic updates paused.')).toBeVisible()
    const calls = detailCalls(backend)
    await act(() => vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS * 5))
    expect(detailCalls(backend)).toBe(calls)
  })

  test('history list polls while any row is outstanding and stops when none is', async () => {
    const backend = createBackend({ broadcasts: [queuedBroadcast({ subject: 'Mail' })] })
    open(backend, '/admin/communication/history')
    expect(await screen.findByRole('link', { name: 'Mail' })).toBeVisible()
    const listCalls = () => backend.only('GET', '/dawah/broadcasts/').length
    expect(listCalls()).toBe(1)
    Object.assign(backend.store.get(7), { state: 'completed' })
    await act(() => vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS))
    await waitFor(() => expect(listCalls()).toBe(2))
    await act(() => vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS * 10))
    expect(listCalls()).toBe(2)
  })
})

describe('history page', () => {
  test('lists non-draft broadcasts with honest counts and state wording', async () => {
    const backend = createBackend({
      broadcasts: [
        wireBroadcast({ id: 1, subject: 'A draft' }),
        queuedBroadcast({ id: 2, subject: 'Waiting', state: 'queued' }),
        queuedBroadcast({ id: 3, subject: 'Done', state: 'completed_with_errors', recipient_count: 10, counts: counts({ sent: 8, failed: 1, uncertain: 1 }) }),
      ],
    })
    open(backend, '/admin/communication/history')
    expect(await screen.findByRole('link', { name: 'Done' })).toHaveAttribute('href', '/admin/communication/history/3')
    expect(screen.queryByText('A draft')).toBeNull()
    expect(screen.getByText('10 recipients: 0 queued, 8 Resend accepted, 1 failed, 1 uncertain, 0 skipped')).toBeVisible()
    expect(screen.getByText('Completed with failures', { selector: 'span' })).toBeVisible()
    expect(screen.getByText(/does not confirm that the message reached an inbox/)).toBeVisible()
    expect(screen.queryByText(/delivered/i)).toBeNull()
    expect(backend.calls[0].query.state).toBe('queued,processing,completed,completed_with_errors,uncertain')
  })

  test('state filter sends exactly the chosen state', async () => {
    const backend = createBackend({ broadcasts: [queuedBroadcast({ id: 2, subject: 'Waiting' })] })
    open(backend, '/admin/communication/history')
    const actor = userEvent.setup()
    await screen.findByRole('link', { name: 'Waiting' })
    await actor.selectOptions(screen.getByLabelText('State'), 'uncertain')
    await waitFor(() => expect(backend.calls.at(-1).query.state).toBe('uncertain'))
    expect(await screen.findByText(/No broadcasts match/)).toBeVisible()
  })

  test('error then retry', async () => {
    const backend = createBackend({ broadcasts: [queuedBroadcast({ subject: 'Mail', state: 'completed' })] })
    open(backend, '/admin/communication/history')
    server.use(http.get(url('/dawah/broadcasts/'), () => fail(500, 'SERVER_ERROR', 'Something went wrong.'), { once: true }))
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Something went wrong.')
    await userEvent.click(within(alert).getByRole('button', { name: 'Try again' }))
    expect(await screen.findByRole('link', { name: 'Mail' })).toBeVisible()
  })
})

describe('detail: outcomes and retry', () => {
  const deliveries = [
    wireDelivery({ id: 11, snapshot_email: 'sent@example.test', state: 'sent', attempt_count: 1, provider_email_id: 're_abc123', sent_at: '2026-11-10T10:05:00Z' }),
    wireDelivery({ id: 12, snapshot_email: 'failed1@example.test', state: 'failed', attempt_count: 3, error_code: 'invalid_recipient' }),
    wireDelivery({ id: 13, snapshot_email: 'failed2@example.test', state: 'failed', attempt_count: 3, error_code: 'rate_limited' }),
    wireDelivery({ id: 14, snapshot_email: 'unsure@example.test', state: 'uncertain', attempt_count: 2 }),
    wireDelivery({ id: 15, snapshot_email: 'queued@example.test', state: 'queued' }),
    wireDelivery({ id: 16, snapshot_email: 'skip@example.test', state: 'skipped' }),
  ]
  const setup = () => {
    const backend = createBackend({
      broadcasts: [queuedBroadcast({ state: 'completed_with_errors', recipient_count: 6, counts: counts({ queued: 1, sent: 1, failed: 2, uncertain: 1, skipped: 1 }) })],
      deliveries: { 7: deliveries },
    })
    open(backend, '/admin/communication/history/7')
    return backend
  }

  test('shows snapshot summary and distinct outcome wording, provider id only when accepted', async () => {
    setup()
    expect(await screen.findByText('sent@example.test')).toBeVisible()
    const row = (email) => screen.getByText(email).closest('tr')
    expect(within(row('sent@example.test')).getByText('Resend accepted')).toBeVisible()
    expect(within(row('sent@example.test')).getByText(/Resend ID: re_abc123/)).toBeVisible()
    expect(within(row('failed1@example.test')).getByText('Failed (not accepted)')).toBeVisible()
    expect(within(row('failed1@example.test')).getByText(/Error code: invalid_recipient/)).toBeVisible()
    expect(within(row('unsure@example.test')).getByText('Uncertain')).toBeVisible()
    expect(within(row('queued@example.test')).getByText('Queued')).toBeVisible()
    expect(screen.getByText('6 recipients: 1 queued, 1 Resend accepted, 2 failed, 1 uncertain, 1 skipped')).toBeVisible()
    expect(screen.getByText('Audience')).toBeVisible()
    expect(screen.getByText('All active students')).toBeVisible()
    expect(screen.getByTestId('detail-body')).toHaveTextContent('Summary and recording link')
    expect(screen.queryByText(/delivered/i)).toBeNull()
  })

  test('retry checkboxes exist only for failed rows; sent/uncertain/queued/skipped have none', async () => {
    setup()
    await screen.findByText('sent@example.test')
    const boxes = screen.getAllByRole('checkbox').map((box) => box.getAttribute('aria-label'))
    expect(boxes).toEqual(['Select failed1@example.test for retry', 'Select failed2@example.test for retry'])
  })

  test('retry posts exactly the selected ids, reports queued-again, and refreshes', async () => {
    const backend = setup()
    const actor = userEvent.setup()
    await screen.findByText('sent@example.test')
    const retry = screen.getByRole('button', { name: 'Retry selected (0)' })
    expect(retry).toBeDisabled()
    await actor.click(screen.getByRole('checkbox', { name: 'Select failed2@example.test for retry' }))
    await actor.click(screen.getByRole('button', { name: 'Retry selected (1)' }))
    expect(await screen.findByText(/Retry requested\./)).toBeVisible()
    expect(backend.only('POST', '/retry/')[0].body).toEqual({ delivery_ids: [13] })
    expect(screen.getByRole('button', { name: 'Retry selected (0)' })).toBeDisabled()
    expect(backend.only('GET', '/deliveries/').length).toBeGreaterThan(1)
  })

  test('both failed rows can be selected together', async () => {
    const backend = setup()
    const actor = userEvent.setup()
    await screen.findByText('sent@example.test')
    for (const box of screen.getAllByRole('checkbox')) await actor.click(box)
    await actor.click(screen.getByRole('button', { name: 'Retry selected (2)' }))
    await waitFor(() => expect(backend.only('POST', '/retry/')).toHaveLength(1))
    expect(backend.only('POST', '/retry/')[0].body).toEqual({ delivery_ids: [12, 13] })
  })

  test('server rejection (atomic) is shown and the selection is kept', async () => {
    setup()
    server.use(http.post(url('/dawah/broadcasts/7/retry/'), () => fail(409, 'DELIVERY_NOT_RETRYABLE', 'One or more deliveries cannot be retried.')))
    const actor = userEvent.setup()
    await screen.findByText('sent@example.test')
    await actor.click(screen.getByRole('checkbox', { name: 'Select failed1@example.test for retry' }))
    await actor.click(screen.getByRole('button', { name: 'Retry selected (1)' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('One or more deliveries cannot be retried.')
    expect(screen.getByRole('button', { name: 'Retry selected (1)' })).toBeEnabled()
  })

  test('a server eligible_actions hint without retry hides the checkbox', async () => {
    const backend = createBackend({
      broadcasts: [queuedBroadcast({ state: 'completed_with_errors' })],
      deliveries: { 7: [wireDelivery({ id: 12, state: 'failed', eligible_actions: [] })] },
    })
    open(backend, '/admin/communication/history/7')
    await screen.findByText('one@example.test')
    expect(screen.queryByRole('checkbox')).toBeNull()
    expect(screen.queryByRole('button', { name: /Retry selected/ })).toBeNull()
  })

  test('delivery state filter requests that state', async () => {
    const backend = setup()
    const actor = userEvent.setup()
    await screen.findByText('sent@example.test')
    await actor.selectOptions(screen.getByLabelText('Outcome'), 'failed')
    await waitFor(() => expect(backend.only('GET', '/deliveries/').at(-1).query.state).toBe('failed'))
    await waitFor(() => expect(screen.queryByText('sent@example.test')).toBeNull())
  })
})
