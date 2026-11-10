import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { fail, ok, resetSession, storeRefreshToken, useApiOrigin } from '../fixtures/auth.js'
import { audio, event, page, publicHandlers } from '../fixtures/dawah.js'
import { TestApp } from '../fixtures/TestApp.jsx'
import { server } from '../mocks/server.js'
import { getEvent, getResource, isPlayableAudio, listArchive, mapResource } from '../../src/features/dawah/public/api/dawahPublicService.js'
import { setSessionTokens } from '../../src/services/api/session.js'
import { formatClock, formatDateTime } from '../../src/features/dawah/public/lib/format.js'
import { http, HttpResponse } from 'msw'
import { url } from '../fixtures/auth.js'

beforeEach(() => {
  useApiOrigin()
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
})
afterEach(resetSession)

function serve(handlers) {
  const h = publicHandlers(handlers)
  server.serve(...h.list)
  return h
}

describe('public service', () => {
  test('sends no Authorization header even with a stored session, and maps the query', async () => {
    setSessionTokens({ access: 'secret-access', refresh: 'secret-refresh' })
    const h = serve()
    const result = await listArchive({ search: ' sabr ', speaker: 'Guest', category: 'jumuah', dateFrom: '2026-10-01', dateTo: '2026-10-31', page: 2, pageSize: 5 })
    expect(h.calls).toHaveLength(1)
    expect(h.calls[0].auth).toBeNull()
    expect(h.calls[0].query).toEqual({ search: ' sabr ', speaker: 'Guest', category: 'jumuah', date_from: '2026-10-01', date_to: '2026-10-31', type: 'aud', page: '2', page_size: '5' })
    expect(result.count).toBe(2)
    expect(result.results[0]).toMatchObject({ id: 8, eventId: 3, mediaUrl: 'https://media.example.test/khutbah-8.mp3', storageStatus: 'ready', duration: 2100 })
    expect(result.results[0].event.startTime).toBe(event.start_time)
  })

  test('omits empty filters and never sends status/draft parameters', async () => {
    const h = serve()
    await listArchive({ search: '', speaker: '  ' })
    expect(Object.keys(h.calls[0].query).sort()).toEqual(['page_size', 'type'])
  })

  test('drops non-published items defensively', async () => {
    serve({ '/dawah/archive/': () => ok(page([audio(1), audio(2, { status: 'draft' }), audio(3, { status: 'unpublished' })])) })
    expect((await listArchive()).results.map((r) => r.id)).toEqual([1])
  })

  test('detail reads are anonymous and a draft payload is treated as not found', async () => {
    setSessionTokens({ access: 'secret-access', refresh: 'secret-refresh' })
    const h = serve({
      '/dawah/events/:id/': () => ok({ ...event, status: 'draft' }),
      '/dawah/resources/:id/': () => ok(audio(8)),
    })
    await expect(getEvent(3)).rejects.toMatchObject({ status: 404 })
    expect((await getResource(8)).id).toBe(8)
    expect(h.calls.every((c) => c.auth === null)).toBe(true)
  })

  test('only ready published HTTPS audio is playable', () => {
    expect(isPlayableAudio(mapResource(audio(1)))).toBe(true)
    expect(isPlayableAudio(mapResource(audio(1, { status: 'draft' })))).toBe(false)
    expect(isPlayableAudio(mapResource(audio(1, { storage_status: 'pending' })))).toBe(false)
    expect(isPlayableAudio(mapResource(audio(1, { media_url: 'http://x.test/a.mp3' })))).toBe(false)
    expect(isPlayableAudio(mapResource(audio(1, { type: 'vid' })))).toBe(false)
  })

  test('displays instants in Africa/Lagos', () => {
    expect(formatDateTime('2026-10-09T23:30:00Z')).toMatch(/10 Oct 2026/)
    expect(formatDateTime('09-10-2026')).toBe('') // never parse DD-MM-YYYY
    expect(formatClock(2100)).toBe('35:00')
    expect(formatClock(3725)).toBe('1:02:05')
    expect(formatClock(undefined)).toBe('--:--')
  })
})

describe('archive page', () => {
  test('anonymous reader sees the archive without any sign-in or refresh call', async () => {
    const h = serve()
    render(<TestApp path="/dawah" />)
    expect(await screen.findByRole('heading', { name: 'Da’wah archive' })).toBeInTheDocument()
    expect(await screen.findByRole('link', { name: 'Patience 8' })).toHaveAttribute('href', '/dawah/content/8')
    expect(screen.getByText('2 recordings')).toBeInTheDocument()
    expect(h.calls.every((c) => c.auth === null)).toBe(true)
    expect(screen.getByTestId('location')).toHaveTextContent('/dawah')
  })

  test('restores filters and page from the URL, and filtering resets to page 1', async () => {
    const h = serve({ '/dawah/archive/': () => ok(page([audio(8)], 30)) })
    const user = userEvent.setup()
    render(<TestApp path="/dawah?q=sabr&page=2&from=2026-10-01&to=bad" />)
    await screen.findByText('30 recordings')
    const archive = () => h.calls.filter((c) => c.path === '/dawah/archive/').at(-1).query
    expect(archive()).toMatchObject({ search: 'sabr', page: '2', date_from: '2026-10-01' })
    expect(archive().date_to).toBeUndefined() // malformed date ignored
    expect(screen.getByText('Page 2 of 3')).toBeInTheDocument()

    await user.clear(screen.getByLabelText('Speaker'))
    await user.type(screen.getByLabelText('Speaker'), 'Guest')
    await user.click(screen.getByRole('button', { name: 'Apply filters' }))
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/dawah?q=sabr&speaker=Guest&from=2026-10-01'))
    expect(screen.getByTestId('location').textContent).not.toContain('page=')
    await waitFor(() => expect(archive()).toMatchObject({ speaker: 'Guest', search: 'sabr' }))
    expect(archive().page).toBeUndefined()
  })

  test('pagination requests the next page', async () => {
    const h = serve({ '/dawah/archive/': () => ok(page([audio(8)], 30)) })
    const user = userEvent.setup()
    render(<TestApp path="/dawah" />)
    await screen.findByText('Page 1 of 3')
    expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Next' }))
    await screen.findByText('Page 2 of 3')
    expect(h.calls.filter((c) => c.path === '/dawah/archive/').at(-1).query.page).toBe('2')
  })

  test('rejects an inverted date range without requesting', async () => {
    const h = serve()
    const user = userEvent.setup()
    render(<TestApp path="/dawah" />)
    await screen.findByText('2 recordings')
    const before = h.calls.length
    fireEvent.change(screen.getByLabelText('From'), { target: { value: '2026-10-31' } })
    fireEvent.change(screen.getByLabelText('To'), { target: { value: '2026-10-01' } })
    await user.click(screen.getByRole('button', { name: 'Apply filters' }))
    expect(screen.getByRole('alert')).toHaveTextContent('must be on or before')
    expect(h.calls).toHaveLength(before)
  })

  test('empty archive and empty filtered result have distinct messages', async () => {
    serve({ '/dawah/archive/': () => ok(page([])) })
    const first = render(<TestApp path="/dawah" />)
    expect(await screen.findByText('No recordings published yet')).toBeInTheDocument()
    first.unmount()
    render(<TestApp path="/dawah?q=zzz" />)
    expect(await screen.findByText('No matching recordings')).toBeInTheDocument()
  })

  test('failure shows an error that can be retried', async () => {
    let attempts = 0
    serve({
      '/dawah/archive/': () => {
        attempts += 1
        return attempts === 1 ? fail(503, 'SERVICE_UNAVAILABLE', 'Service is down.') : ok(page([audio(8)]))
      },
    })
    const user = userEvent.setup()
    render(<TestApp path="/dawah" />)
    expect(await screen.findByRole('alert')).toHaveTextContent('Service is down.')
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByRole('link', { name: 'Patience 8' })).toBeInTheDocument()
  })

  test('network failure shows a connectivity message', async () => {
    serve({ '/dawah/archive/': () => HttpResponse.error() })
    render(<TestApp path="/dawah" />)
    expect(await screen.findByText(/could not reach the server/i)).toBeInTheDocument()
  })

  test('upcoming events are linked when present', async () => {
    const h = serve({ '/dawah/events/': () => ok(page([{ ...event, id: 5, title: 'Next Friday' }])) })
    render(<TestApp path="/dawah" />)
    expect(await screen.findByRole('link', { name: 'Next Friday' })).toHaveAttribute('href', '/dawah/events/5')
    expect(h.calls.find((c) => c.path === '/dawah/events/').query).toMatchObject({ upcoming: 'true' })
  })

  test('a signed-in student can use it as well, with the same public requests', async () => {
    storeRefreshToken()
    server.serve(
      http.post(url('/accounts/refresh/'), () => ok({ access: 'access-2', refresh: 'refresh-2' })),
      http.get(url('/accounts/me/'), () => ok({ id: 1, email: 's@example.test', first_name: 'A', last_name: 'B', role: 'student', is_active: true })),
    )
    const h = serve()
    render(<TestApp path="/dawah" />)
    await screen.findByRole('link', { name: 'Patience 8' })
    expect(h.calls.every((c) => c.auth === null)).toBe(true)
  })
})

describe('event and content detail', () => {
  test('event detail deep link shows event info (Lagos time) and a player per audio resource', async () => {
    serve({ '/dawah/events/:id/resources/': () => ok(page([audio(8), audio(9), audio(10, { type: 'doc' })])) })
    render(<TestApp path="/dawah/events/3" />)
    expect(await screen.findByRole('heading', { name: 'Friday khutbah' })).toBeInTheDocument()
    expect(screen.getByText(/10 Oct 2026/)).toBeInTheDocument()
    expect(screen.getAllByRole('group', { name: /Audio player/ })).toHaveLength(2)
  })

  test('hidden or missing event/resource show not-found, not an error page', async () => {
    serve({ '/dawah/events/:id/': () => fail(404, 'NOT_FOUND', 'Not found.'), '/dawah/resources/:id/': () => fail(404, 'NOT_FOUND', 'Not found.') })
    const first = render(<TestApp path="/dawah/events/99" />)
    expect(await screen.findByText('Event not found')).toBeInTheDocument()
    first.unmount()
    render(<TestApp path="/dawah/content/99" />)
    expect(await screen.findByText('Recording not found')).toBeInTheDocument()
  })

  test('event with no recordings shows an empty state', async () => {
    serve({ '/dawah/events/:id/resources/': () => ok(page([])) })
    render(<TestApp path="/dawah/events/3" />)
    expect(await screen.findByText('No recordings for this event yet')).toBeInTheDocument()
  })

  test('content detail with a non-ready resource shows unavailable and no audio element', async () => {
    serve({ '/dawah/resources/:id/': () => ok(audio(8, { storage_status: 'pending' })) })
    const { container } = render(<TestApp path="/dawah/content/8" />)
    expect(await screen.findByText('This audio is not available right now.')).toBeInTheDocument()
    expect(container.querySelector('audio')).toBeNull()
  })

  test('content detail with a video resource is not rendered as audio', async () => {
    serve({ '/dawah/resources/:id/': () => ok(audio(8, { type: 'vid', media_url: '' })) })
    const { container } = render(<TestApp path="/dawah/content/8" />)
    expect(await screen.findByText(/not available to play here yet/)).toBeInTheDocument()
    expect(container.querySelector('audio')).toBeNull()
  })
})

describe('audio player', () => {
  let play
  let pause
  let load
  beforeEach(() => {
    play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(function () {
      Object.defineProperty(this, 'paused', { configurable: true, value: false })
      fireEvent.playing(this)
      return Promise.resolve()
    })
    pause = vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(function () {
      Object.defineProperty(this, 'paused', { configurable: true, value: true })
      fireEvent.pause(this)
    })
    load = vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {})
  })

  async function open() {
    serve()
    const view = render(<TestApp path="/dawah/content/8" />)
    const player = await screen.findByRole('group', { name: /Audio player/ })
    const el = view.container.querySelector('audio')
    return { player, el, view }
  }

  const setDuration = (el, value) => {
    Object.defineProperty(el, 'duration', { configurable: true, value })
    fireEvent.loadedMetadata(el)
  }

  test('loads the public URL, shows loading then actual duration and the download link', async () => {
    const { player, el } = await open()
    expect(el).toHaveAttribute('src', 'https://media.example.test/khutbah-8.mp3')
    expect(el).toHaveAttribute('preload', 'metadata')
    expect(within(player).getByText('Loading audio…')).toBeInTheDocument()
    setDuration(el, 1800)
    expect(within(player).queryByText('Loading audio…')).toBeNull()
    expect(within(player).getByText('30:00')).toBeInTheDocument()
    expect(within(player).getByRole('link', { name: 'Download audio' })).toHaveAttribute('href', 'https://media.example.test/khutbah-8.mp3')
  })

  test('play/pause follow real media events', async () => {
    const user = userEvent.setup()
    const { player } = await open()
    await user.click(within(player).getByRole('button', { name: 'Play' }))
    expect(play).toHaveBeenCalled()
    await user.click(await within(player).findByRole('button', { name: 'Pause' }))
    expect(pause).toHaveBeenCalled()
    expect(await within(player).findByRole('button', { name: 'Play' })).toBeInTheDocument()
  })

  test('seek slider and skip buttons set currentTime; time display follows timeupdate and seeking events', async () => {
    const user = userEvent.setup()
    const { player, el } = await open()
    const seek = within(player).getByRole('slider', { name: 'Seek' })
    expect(seek).toBeDisabled() // no real duration yet
    setDuration(el, 1800)
    expect(seek).toBeEnabled()
    expect(seek).toHaveAttribute('max', '1800')

    fireEvent.change(seek, { target: { value: '600' } })
    expect(el.currentTime).toBe(600)
    fireEvent.seeking(el)
    expect(within(player).getByText('Seeking…')).toBeInTheDocument()
    fireEvent.seeked(el)
    expect(within(player).queryByText('Seeking…')).toBeNull()

    await user.click(within(player).getByRole('button', { name: 'Forward 15 seconds' }))
    expect(el.currentTime).toBe(615)
    await user.click(within(player).getByRole('button', { name: 'Back 15 seconds' }))
    expect(el.currentTime).toBe(600)

    el.currentTime = 90
    fireEvent.timeUpdate(el)
    expect(within(player).getByText('1:30')).toBeInTheDocument()
    expect(seek).toHaveAttribute('aria-valuetext', '1:30 of 30:00')

    // Keyboard: the play button toggles with Space.
    within(player).getByRole('button', { name: 'Play' }).focus()
    await user.keyboard(' ')
    expect(play).toHaveBeenCalled()
  })

  test('a load failure shows an error, disables controls and retry reloads', async () => {
    const user = userEvent.setup()
    const { player, el } = await open()
    Object.defineProperty(el, 'error', { configurable: true, value: { code: 4 } })
    fireEvent.error(el)
    expect(within(player).getByRole('alert')).toHaveTextContent('unavailable or its format is not supported')
    expect(within(player).getByRole('button', { name: 'Play' })).toBeDisabled()
    await user.click(within(player).getByRole('button', { name: 'Retry' }))
    expect(load).toHaveBeenCalled()
    expect(within(player).queryByRole('alert')).toBeNull()
  })

  test('a network media error is described and a rejected play() is not shown as playing', async () => {
    const user = userEvent.setup()
    const { player, el } = await open()
    play.mockImplementation(() => Promise.reject(Object.assign(new Error('blocked'), { name: 'NotAllowedError' })))
    await user.click(within(player).getByRole('button', { name: 'Play' }))
    expect(await within(player).findByRole('alert')).toHaveTextContent('blocked playback')
    expect(within(player).queryByRole('button', { name: 'Pause' })).toBeNull()
    expect(el.paused).toBe(true)
  })
})
