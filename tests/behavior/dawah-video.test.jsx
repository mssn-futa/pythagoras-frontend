import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { fail, ok, resetSession, url, useApiOrigin } from '../fixtures/auth.js'
import { audio, event, page, publicHandlers } from '../fixtures/dawah.js'
import { apiHandler, paged, rawEvent, rawResource, renderAdminApp } from '../fixtures/dawah.jsx'
import { TestApp } from '../fixtures/TestApp.jsx'
import { server } from '../mocks/server.js'
import { setSessionTokens } from '../../src/services/api/session.js'
import { listArchive } from '../../src/features/dawah/public/api/dawahPublicService.js'
import { safeEmbedUrl, safePlayback, safeWatchUrl } from '../../src/features/dawah/public/lib/youtube.js'
import PlayableResource from '../../src/features/dawah/public/components/PlayableResource.jsx'
import { mapResource } from '../../src/features/dawah/public/api/dawahPublicService.js'
import VideoEmbed from '../../src/features/dawah/public/components/VideoEmbed.jsx'

const ID = 'abcdefghijk'
const playback = (overrides = {}) => ({
  provider: 'youtube',
  video_id: ID,
  watch_url: `https://www.youtube.com/watch?v=${ID}`,
  embed_url: `https://www.youtube-nocookie.com/embed/${ID}`,
  ...overrides,
})
const video = (id, overrides = {}) =>
  audio(id, { type: 'vid', title: `Lecture ${id}`, storage_status: 'not_applicable', media_url: null, duration: null, playback: playback(), ...overrides })

beforeEach(() => {
  useApiOrigin()
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
})
afterEach(resetSession)

describe('youtube validation helpers', () => {
  test('accepts only the exact privacy-enhanced embed shape', () => {
    expect(safeEmbedUrl(`https://www.youtube-nocookie.com/embed/${ID}`, ID)).toBe(`https://www.youtube-nocookie.com/embed/${ID}`)
    const bad = [
      `https://www.youtube.com/embed/${ID}`,
      `https://youtube-nocookie.com/embed/${ID}`,
      `https://www.youtube-nocookie.com.evil.test/embed/${ID}`,
      `https://www.youtube-nocookie.com@evil.test/embed/${ID}`,
      `https://user:pw@www.youtube-nocookie.com/embed/${ID}`,
      `http://www.youtube-nocookie.com/embed/${ID}`,
      `javascript:alert(1)`,
      `data:text/html,<script>1</script>`,
      `https://www.youtube-nocookie.com/embed/${ID}?autoplay=1`,
      `https://www.youtube-nocookie.com/embed/${ID}#x`,
      `https://www.youtube-nocookie.com:444/embed/${ID}`,
      `https://www.youtube-nocookie.com/embed/${ID}/extra`,
      `https://www.youtube-nocookie.com/embed/zzzzzzzzzzz`,
      `https://www.youtube-nocookie.com/watch?v=${ID}`,
      `//www.youtube-nocookie.com/embed/${ID}`,
      '',
      null,
      42,
    ]
    for (const value of bad) expect(safeEmbedUrl(value, ID), String(value)).toBeNull()
    expect(safeEmbedUrl(`https://www.youtube-nocookie.com/embed/${ID}`, 'short')).toBeNull()
    // Canonical rebuild from the ID, not the parsed server text.
    expect(safeEmbedUrl(`HTTPS://WWW.YOUTUBE-NOCOOKIE.COM/embed/${ID}`, ID)).toBe(`https://www.youtube-nocookie.com/embed/${ID}`)
  })

  test('accepts only the canonical watch URL for the same ID', () => {
    expect(safeWatchUrl(`https://www.youtube.com/watch?v=${ID}`, ID)).toBe(`https://www.youtube.com/watch?v=${ID}`)
    for (const value of [
      `https://youtu.be/${ID}`,
      `https://m.youtube.com/watch?v=${ID}`,
      `https://www.youtube.com/watch?v=${ID}&list=x`,
      `https://www.youtube.com/watch?v=abcdefghijl`,
      `https://www.youtube.com.evil.test/watch?v=${ID}`,
      `https://www.youtube.com/redirect?q=evil.test`,
      `javascript:alert(1)`,
    ]) expect(safeWatchUrl(value, ID), value).toBeNull()
  })

  test('safePlayback needs provider youtube and a valid 11-character ID', () => {
    expect(safePlayback(playback())).toEqual({ videoId: ID, embedUrl: `https://www.youtube-nocookie.com/embed/${ID}`, watchUrl: `https://www.youtube.com/watch?v=${ID}` })
    expect(safePlayback(playback({ embed_url: 'https://evil.test/embed/x' }))).toMatchObject({ embedUrl: null, watchUrl: expect.any(String) })
    expect(safePlayback(playback({ video_id: 'bad' }))).toBeNull()
    expect(safePlayback(playback({ provider: 'vimeo' }))).toBeNull()
    expect(safePlayback(null)).toBeNull()
  })
})

describe('VideoEmbed', () => {
  test('renders a lazy, titled, privacy-enhanced iframe plus the Watch on YouTube link and help', () => {
    render(<VideoEmbed playback={playback()} title="Lecture 1" />)
    const frame = screen.getByTitle('Lecture 1 (YouTube video)')
    expect(frame).toHaveAttribute('src', `https://www.youtube-nocookie.com/embed/${ID}`)
    expect(frame).toHaveAttribute('loading', 'lazy')
    expect(frame).toHaveAttribute('referrerpolicy', 'strict-origin-when-cross-origin')
    expect(frame).not.toHaveAttribute('allowfullscreen')
    expect(frame.getAttribute('allow')).toContain('fullscreen')
    expect(frame.getAttribute('sandbox').split(' ').sort()).toEqual(['allow-popups', 'allow-popups-to-escape-sandbox', 'allow-presentation', 'allow-same-origin', 'allow-scripts'])
    expect(frame.getAttribute('allow')).toBe('fullscreen; picture-in-picture; encrypted-media')
    expect(frame.parentElement.className).toContain('aspect-video')
    const link = screen.getByRole('link', { name: 'Watch on YouTube' })
    expect(link).toHaveAttribute('href', `https://www.youtube.com/watch?v=${ID}`)
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
    expect(link).toHaveAttribute('target', '_blank')
    expect(screen.getByText(/private, removed, have embedding disabled/i)).toBeInTheDocument()
  })

  test.each([
    ['another host', { embed_url: `https://www.youtube.com/embed/${ID}` }],
    ['lookalike host', { embed_url: `https://www.youtube-nocookie.com.evil.test/embed/${ID}` }],
    ['javascript URL', { embed_url: 'javascript:alert(1)' }],
    ['mismatched ID', { embed_url: 'https://www.youtube-nocookie.com/embed/zzzzzzzzzzz' }],
    ['missing URL', { embed_url: undefined }],
  ])('renders no iframe for %s, keeps the safe watch link', (_name, overrides) => {
    const { container } = render(<VideoEmbed playback={playback(overrides)} title="Lecture 1" />)
    expect(container.querySelector('iframe')).toBeNull()
    expect(screen.getByText('This video is not available to play here right now.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Watch on YouTube' })).toHaveAttribute('href', `https://www.youtube.com/watch?v=${ID}`)
  })

  test('an unsafe watch URL is never linked', () => {
    const { container } = render(<VideoEmbed playback={playback({ watch_url: 'javascript:alert(1)' })} title="x" />)
    expect(container.querySelector('iframe')).not.toBeNull()
    expect(container.querySelector('a')).toBeNull()
  })

  test('no playback at all shows unavailable and no link', () => {
    const { container } = render(<VideoEmbed playback={null} title="x" />)
    expect(container.querySelector('iframe, a')).toBeNull()
    expect(screen.getByRole('status')).toHaveTextContent('not available')
  })
})

describe('non-published video', () => {
  test.each(['draft', 'unpublished'])('PlayableResource renders no iframe or link for a %s video', (status) => {
    const { container } = render(<PlayableResource resource={mapResource(video(19, { status }))} />)
    expect(container.querySelector('iframe, a')).toBeNull()
    expect(screen.getByText('This video is not available right now.')).toBeInTheDocument()
  })
})

describe('public pages', () => {
  function serve(handlers) {
    const h = publicHandlers(handlers)
    server.use(...h.list)
    return h
  }

  test('content detail embeds the video, anonymously', async () => {
    const h = serve({ '/dawah/resources/:id/': () => ok(video(19)) })
    const { container } = render(<TestApp path="/dawah/content/19" />)
    expect(await screen.findByTitle('Lecture 19 (YouTube video)')).toHaveAttribute('src', `https://www.youtube-nocookie.com/embed/${ID}`)
    expect(screen.getByRole('link', { name: 'Watch on YouTube' })).toBeVisible()
    expect(container.querySelector('audio')).toBeNull()
    expect(h.calls.length).toBeGreaterThan(0)
    expect(h.calls.every((call) => call.auth === null)).toBe(true)
  })

  test('an unsafe embed host never becomes a frame', async () => {
    serve({ '/dawah/resources/:id/': () => ok(video(19, { playback: playback({ embed_url: 'https://evil.test/embed/abcdefghijk' }) })) })
    const { container } = render(<TestApp path="/dawah/content/19" />)
    expect(await screen.findByText('This video is not available to play here right now.')).toBeInTheDocument()
    expect(container.querySelector('iframe')).toBeNull()
    expect(screen.getByRole('link', { name: 'Watch on YouTube' })).toBeInTheDocument()
  })

  test('event detail lists audio and video, each with its own viewer', async () => {
    serve({ '/dawah/events/:id/': () => ok({ ...event, resources: [audio(8), video(19), audio(10, { type: 'doc' })] }) })
    render(<TestApp path="/dawah/events/3" />)
    expect(await screen.findByTitle('Lecture 19 (YouTube video)')).toBeInTheDocument()
    expect(screen.getAllByRole('group', { name: /Audio player/ })).toHaveLength(1)
  })

  test('archive type filter sends type=vid, lives in the URL, and cards say Watch', async () => {
    const h = serve({ '/dawah/archive/': () => ok(page([video(19)])) })
    render(<TestApp path="/dawah?type=vid" />)
    await screen.findByRole('link', { name: 'Lecture 19' })
    expect(h.calls.find((call) => call.path === '/dawah/archive/').query.type).toBe('vid')
    expect(screen.getByRole('link', { name: 'Watch' })).toHaveAttribute('href', '/dawah/content/19')
  })

  test('choosing Video in the filter updates the URL and the request', async () => {
    const h = serve()
    render(<TestApp path="/dawah" />)
    await screen.findByRole('link', { name: 'Patience 8' })
    expect(h.calls.find((call) => call.path === '/dawah/archive/').query.type).toBeUndefined()
    await userEvent.setup().selectOptions(screen.getByLabelText('Type'), 'vid')
    await userEvent.setup().click(screen.getByRole('button', { name: 'Apply filters' }))
    await vi.waitFor(() => expect(h.calls.filter((call) => call.path === '/dawah/archive/').at(-1).query.type).toBe('vid'))
    expect(screen.getByTestId('location').textContent).toBe('/dawah?type=vid')
  })

  test('listArchive passes type=vid with no Authorization', async () => {
    setSessionTokens({ access: 'a', refresh: 'r' })
    const h = serve({ '/dawah/archive/': () => ok(page([video(19)])) })
    const result = await listArchive({ type: 'vid' })
    expect(h.calls[0].query.type).toBe('vid')
    expect(h.calls[0].auth).toBeNull()
    expect(result.results[0].playback.video_id).toBe(ID)
  })
})

describe('admin link entry', () => {
  const location = () => screen.getByTestId('location').textContent
  const eventHandler = http.get(url('/dawah/events/3/'), () => ok(rawEvent()))

  test('Add video link opens the form, validates locally, and posts the exact payload', async () => {
    const create = apiHandler('post', '/dawah/events/3/resources/', () => ok(rawResource({ id: 19, type: 'vid', title: 'Recorded lecture', storage_status: 'not_applicable', playback: playback() }), 'Saved.', { status: 201 }))
    renderAdminApp('/admin/events/3/resources/new?type=vid', [
      eventHandler,
      create.handler,
      http.get(url('/dawah/events/3/resources/19/'), () => ok(rawResource({ id: 19, type: 'vid', title: 'Recorded lecture', storage_status: 'not_applicable', playback: playback() }))),
    ])
    const user = userEvent.setup()
    await user.type(await screen.findByLabelText('Title'), 'Recorded lecture')
    await user.click(screen.getByRole('button', { name: 'Save draft' }))
    expect(await screen.findByText('Paste a YouTube link.')).toBeInTheDocument()
    await user.type(screen.getByLabelText('YouTube link'), '<iframe src="x"></iframe>')
    await user.click(screen.getByRole('button', { name: 'Save draft' }))
    expect(await screen.findByText('Paste the video link, not embed code.')).toBeInTheDocument()
    expect(create.rec.calls).toHaveLength(0)

    await user.clear(screen.getByLabelText('YouTube link'))
    await user.type(screen.getByLabelText('YouTube link'), `  https://youtu.be/${ID}?t=5  `)
    await user.click(screen.getByRole('button', { name: 'Save draft' }))
    expect(await screen.findByText(/Draft saved with the YouTube link/)).toBeInTheDocument()
    expect(location()).toBe('/admin/events/3/resources/19')
    expect(create.rec.calls).toHaveLength(1)
    expect(create.rec.calls[0].body).toEqual({ title: 'Recorded lecture', type: 'vid', youtube_url: `https://youtu.be/${ID}?t=5` })
    // The returned normalized ID / watch URL are shown, with the safe preview and no upload panel.
    expect(screen.getByTestId('video-id')).toHaveTextContent(ID)
    expect(screen.getByRole('link', { name: `https://www.youtube.com/watch?v=${ID}` })).toBeInTheDocument()
    expect(screen.getByTitle('Recorded lecture (YouTube video)')).toBeInTheDocument()
    expect(screen.queryByText(/Upload audio|Choose an MP3/i)).not.toBeInTheDocument()
  })

  test('server field errors on youtube_url are shown next to the field and nothing navigates', async () => {
    renderAdminApp('/admin/events/3/resources/new?type=vid', [
      eventHandler,
      http.post(url('/dawah/events/3/resources/'), () => fail(400, 'VALIDATION_ERROR', 'Invalid input.', { youtube_url: ['Enter a supported YouTube video link.'] })),
    ])
    const user = userEvent.setup()
    await user.type(await screen.findByLabelText('Title'), 'Recorded lecture')
    await user.type(screen.getByLabelText('YouTube link'), 'https://evil.test/watch?v=abcdefghijk')
    await user.click(screen.getByRole('button', { name: 'Save draft' }))
    expect(await screen.findByText('Enter a supported YouTube video link.')).toBeInTheDocument()
    expect(screen.getByLabelText('YouTube link')).toHaveAttribute('aria-invalid', 'true')
    expect(location()).toBe('/admin/events/3/resources/new?type=vid')
  })

  test('the type selector switches the same form between audio and video', async () => {
    const create = apiHandler('post', '/dawah/events/3/resources/', () => ok(rawResource({ id: 21 }), 'Saved.', { status: 201 }))
    renderAdminApp('/admin/events/3/resources/new', [eventHandler, create.handler, http.get(url('/dawah/events/3/resources/21/'), () => ok(rawResource({ id: 21 })))])
    const user = userEvent.setup()
    expect(await screen.findByLabelText('Type')).toHaveValue('aud')
    expect(screen.queryByLabelText('YouTube link')).not.toBeInTheDocument()
    await user.selectOptions(screen.getByLabelText('Type'), 'vid')
    expect(screen.getByLabelText('YouTube link')).toBeInTheDocument()
  })

  test('an existing video resource shows its saved link, can be edited by PATCH, and persists after reload', async () => {
    const state = { playback: playback() }
    const patch = apiHandler('patch', '/dawah/events/3/resources/19/', ({ entry }) => {
      expect(entry.body).toEqual({ youtube_url: 'https://www.youtube.com/watch?v=zzzzzzzzzzz&utm=1' })
      state.playback = playback({ video_id: 'zzzzzzzzzzz', watch_url: 'https://www.youtube.com/watch?v=zzzzzzzzzzz', embed_url: 'https://www.youtube-nocookie.com/embed/zzzzzzzzzzz' })
      return ok(rawResource({ id: 19, type: 'vid', storage_status: 'not_applicable', playback: state.playback }))
    })
    renderAdminApp('/admin/events/3/resources/19', [
      eventHandler,
      patch.handler,
      http.get(url('/dawah/events/3/resources/19/'), () => ok(rawResource({ id: 19, type: 'vid', title: 'Recorded lecture', storage_status: 'not_applicable', playback: state.playback }))),
    ])
    const user = userEvent.setup()
    expect(await screen.findByTestId('video-id')).toHaveTextContent(ID)
    await user.type(screen.getByLabelText('Replace YouTube link'), 'https://www.youtube.com/watch?v=zzzzzzzzzzz&utm=1')
    await user.click(screen.getByRole('button', { name: 'Save link' }))
    expect(await screen.findByText('YouTube link saved.')).toBeInTheDocument()
    await vi.waitFor(() => expect(screen.getByTestId('video-id')).toHaveTextContent('zzzzzzzzzzz'))
    expect(patch.rec.calls).toHaveLength(1)
    expect(screen.getByText(/does not confirm that the video can be played/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /upload|connect|authorize/i })).not.toBeInTheDocument()
  })

  test('a PATCH validation error on the resource page shows the field error', async () => {
    renderAdminApp('/admin/events/3/resources/19', [
      eventHandler,
      http.get(url('/dawah/events/3/resources/19/'), () => ok(rawResource({ id: 19, type: 'vid', storage_status: 'not_applicable', playback: null }))),
      http.patch(url('/dawah/events/3/resources/19/'), () => fail(400, 'VALIDATION_ERROR', 'Invalid input.', { youtube_url: ['Use exactly one video ID.'] })),
    ])
    const user = userEvent.setup()
    expect(await screen.findByText('No valid YouTube link is saved yet.')).toBeInTheDocument()
    await user.type(screen.getByLabelText('YouTube link'), 'https://www.youtube.com/watch?v=a')
    await user.click(screen.getByRole('button', { name: 'Save link' }))
    expect(await screen.findByText('Use exactly one video ID.')).toBeInTheDocument()
  })

  test('the content and event pages offer Add video link', async () => {
    renderAdminApp('/admin/events/3', [
      eventHandler,
      http.get(url('/dawah/events/3/resources/'), () => ok(paged([]))),
    ])
    const link = await screen.findByRole('link', { name: 'Add video link' })
    expect(link).toHaveAttribute('href', '/admin/events/3/resources/new?type=vid')
    expect(within(document.body).queryByText(/Add video link/)).toBeTruthy()
  })

  test('a published video hides the replace form and says to unpublish', async () => {
    renderAdminApp('/admin/events/3/resources/19', [
      eventHandler,
      http.get(url('/dawah/events/3/resources/19/'), () => ok(rawResource({ id: 19, type: 'vid', status: 'published', storage_status: 'not_applicable', playback: playback() }))),
    ])
    expect(await screen.findByText('Unpublish to replace the link.')).toBeInTheDocument()
    expect(screen.queryByLabelText(/YouTube link/)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Save link' })).not.toBeInTheDocument()
    expect(screen.getByText(/replace its link or delete it/)).toBeInTheDocument()
    expect(screen.queryByText(/replace its audio/)).not.toBeInTheDocument()
  })

  async function lostCreate(recovered) {
    const posts = []
    renderAdminApp('/admin/events/3/resources/new?type=vid', [
      eventHandler,
      http.post(url('/dawah/events/3/resources/'), () => { posts.push(1); return HttpResponse.error() }),
      http.get(url('/dawah/events/3/resources/'), () => ok(paged([recovered]))),
      http.get(url('/dawah/events/3/resources/31/'), () => ok(recovered)),
    ])
    const user = userEvent.setup()
    await user.type(await screen.findByLabelText('Title'), 'Recorded lecture')
    await user.type(screen.getByLabelText('YouTube link'), `https://youtu.be/${ID}`)
    await user.click(screen.getByRole('button', { name: 'Save draft' }))
    return posts
  }
  const recoveredDraft = (pb) => rawResource({ id: 31, type: 'vid', title: 'Recorded lecture', storage_status: 'not_applicable', playback: pb })

  test('a draft recovered after a lost create is accepted when its video ID matches', async () => {
    const posts = await lostCreate(recoveredDraft(playback()))
    expect(await screen.findByText(/Draft saved with the YouTube link/)).toBeInTheDocument()
    expect(location()).toBe('/admin/events/3/resources/31')
    expect(posts).toHaveLength(1)
  })

  test.each([['a different video ID', playback({ video_id: 'zzzzzzzzzzz' })], ['no playback', null]])('a recovered draft with %s asks the admin to verify the link', async (_n, pb) => {
    await lostCreate(recoveredDraft(pb))
    expect(await screen.findByRole('alert')).toHaveTextContent(/could not be matched.*verify or replace its link/i)
    expect(location()).toBe('/admin/events/3/resources/new?type=vid')
  })
})
