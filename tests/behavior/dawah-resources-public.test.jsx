import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { ok, resetSession, useApiOrigin } from '../fixtures/auth.js'
import { audio, event, page, publicHandlers } from '../fixtures/dawah.js'
import { TestApp } from '../fixtures/TestApp.jsx'
import { server } from '../mocks/server.js'
import { ResourceRenderer as Exported, mapResource as exportedMap } from '../../src/features/dawah/public/index.js'
import { listArchive, mapEvent, mapResource } from '../../src/features/dawah/public/api/dawahPublicService.js'
import ResourceRenderer from '../../src/features/dawah/public/components/ResourceRenderer.jsx'
import { safePublicUrl } from '../../src/features/dawah/public/lib/safeUrl.js'

const ID = 'abcdefghijk'
const DOC_URL = 'https://media.example.test/docs/slides-1.pdf'
const doc = (id, overrides = {}) =>
  audio(id, {
    type: 'doc',
    title: `Slides ${id}`,
    media_url: DOC_URL,
    duration: null,
    file_name: 'khutbah-slides.pdf',
    content_type: 'application/pdf',
    size_bytes: 1_572_864,
    ...overrides,
  })
const video = (id, overrides = {}) =>
  audio(id, {
    type: 'vid',
    title: `Lecture ${id}`,
    storage_status: 'not_applicable',
    media_url: null,
    playback: { provider: 'youtube', video_id: ID, watch_url: `https://www.youtube.com/watch?v=${ID}`, embed_url: `https://www.youtube-nocookie.com/embed/${ID}` },
    ...overrides,
  })

const renderIt = (resource, props) => render(<MemoryRouter><ResourceRenderer resource={mapResource(resource)} {...props} /></MemoryRouter>)

beforeEach(() => {
  useApiOrigin()
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
})
afterEach(resetSession)

describe('safePublicUrl', () => {
  test('accepts plain https only', () => {
    expect(safePublicUrl(DOC_URL)).toBe(DOC_URL)
    const bad = [
      'http://media.example.test/a.pdf',
      'javascript:alert(1)',
      'data:application/pdf;base64,AAAA',
      'blob:https://x.test/1',
      'ftp://media.example.test/a.pdf',
      '//media.example.test/a.pdf',
      '/relative/a.pdf',
      'https://user:pw@media.example.test/a.pdf',
      'https://media.example.test/a.pdf?X-Amz-Signature=abc&X-Amz-Expires=900',
      'https://media.example.test/a.pdf?token=abc',
      'https://account123.r2.cloudflarestorage.com/bucket/a.pdf',
      'https://r2.cloudflarestorage.com/a.pdf',
      ' https://media.example.test/a.pdf',
      '',
      null,
      undefined,
      42,
    ]
    for (const value of bad) expect(safePublicUrl(value), String(value)).toBeNull()
  })
})

describe('ResourceRenderer (typed)', () => {
  test('audio renders the existing player', () => {
    renderIt(audio(8))
    expect(screen.getByRole('group', { name: /Audio player/ })).toBeInTheDocument()
  })

  test.each([
    ['http', 'http://media.example.test/a.mp3'],
    ['presign host', 'https://acct.r2.cloudflarestorage.com/bucket/a.mp3'],
    ['signed', 'https://media.example.test/a.mp3?X-Amz-Signature=abc'],
    ['userinfo', 'https://u:p@media.example.test/a.mp3'],
    ['javascript', 'javascript:alert(1)'],
  ])('audio with an unsafe media URL (%s) renders no player', (_name, media_url) => {
    const { container } = renderIt(audio(8, { media_url }))
    expect(container.querySelector('audio, a')).toBeNull()
    expect(screen.getByRole('status')).toHaveTextContent('This audio is not available right now.')
  })

  test('video renders the privacy-enhanced embed and the watch link', () => {
    renderIt(video(19))
    expect(screen.getByTitle('Lecture 19 (YouTube video)')).toHaveAttribute('src', `https://www.youtube-nocookie.com/embed/${ID}`)
    expect(screen.getByRole('link', { name: 'Watch on YouTube' })).toBeVisible()
  })

  test('document renders filename, kind, size and a new-tab link with noopener noreferrer; nothing inline', () => {
    const { container } = renderIt(doc(30))
    const box = screen.getByTestId('document-resource')
    expect(within(box).getByText('khutbah-slides.pdf')).toBeInTheDocument()
    expect(within(box).getByText('PDF document · 1.5 MiB')).toBeInTheDocument()
    const link = within(box).getByRole('link', { name: /Open document/ })
    expect(link).toHaveAttribute('href', DOC_URL)
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
    expect(container.querySelector('iframe, embed, object, audio, video, img')).toBeNull()
  })

  test('DOCX label and a hostile file name stay plain text', () => {
    const { container } = renderIt(doc(31, { file_name: '<img src=x onerror=alert(1)>..\\..\\agenda.docx', content_type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }))
    expect(container.querySelector('img')).toBeNull()
    expect(screen.getByText(/Word document/)).toBeInTheDocument()
    expect(screen.getByText('agenda.docx')).toBeInTheDocument() // path parts stripped
  })

  test('falls back to the title when the server sends no file name', () => {
    renderIt(doc(32, { file_name: undefined, content_type: undefined, size_bytes: undefined }))
    expect(screen.getByText('Slides 32')).toBeInTheDocument()
    expect(screen.getByText('Document')).toBeInTheDocument()
  })

  test.each([
    ['http', 'http://media.example.test/a.pdf'],
    ['javascript', 'javascript:alert(1)'],
    ['data', 'data:application/pdf;base64,AAAA'],
    ['userinfo', 'https://user:pw@media.example.test/a.pdf'],
    ['signed', `${DOC_URL}?X-Amz-Signature=abc`],
    ['missing', null],
  ])('an unsafe document URL (%s) renders no link', (_name, media_url) => {
    const { container } = renderIt(doc(33, { media_url }))
    expect(container.querySelector('a, iframe, embed, object')).toBeNull()
    expect(screen.getByRole('status')).toHaveTextContent('This document is not available right now.')
  })

  test.each([
    ['draft', { status: 'draft' }],
    ['unpublished', { status: 'unpublished' }],
    ['not ready', { storage_status: 'pending' }],
    ['failed', { storage_status: 'failed' }],
  ])('a %s document is unavailable', (_name, overrides) => {
    const { container } = renderIt(doc(34, overrides))
    expect(container.querySelector('a')).toBeNull()
    expect(screen.getByRole('status')).toHaveTextContent('not available')
  })

  test('unknown types are not rendered', () => {
    const { container } = renderIt(audio(9, { type: 'zip' }))
    expect(container.querySelector('a, audio, iframe')).toBeNull()
    expect(screen.getByText(/not available to view here/)).toBeInTheDocument()
  })

  test('compact variant: Listen/Watch go to the detail page; documents link directly', () => {
    renderIt(audio(8), { variant: 'compact', detailPath: '/dawah/content/8' })
    expect(screen.getByRole('link', { name: 'Listen' })).toHaveAttribute('href', '/dawah/content/8')
    expect(document.querySelector('audio')).toBeNull()
  })

  test('is exported for other modules', () => {
    expect(Exported).toBe(ResourceRenderer)
    expect(exportedMap).toBe(mapResource)
  })
})

describe('featured image mapping and rendering', () => {
  test('mapEvent keeps only a safe https featured image URL', () => {
    expect(mapEvent({ featured_image_url: 'https://media.example.test/e.png' }).featuredImageUrl).toBe('https://media.example.test/e.png')
    for (const bad of ['http://media.example.test/e.png', 'javascript:alert(1)', 'data:image/png;base64,AA', 'https://media.example.test/e.png?X-Amz-Signature=1', null])
      expect(mapEvent({ featured_image_url: bad }).featuredImageUrl, String(bad)).toBeNull()
  })

  function serve(handlers) {
    const h = publicHandlers(handlers)
    server.use(...h.list)
    return h
  }
  const IMG = 'https://media.example.test/events/friday.png'

  test('event detail shows the image lazily with alt text, and the document in its own section', async () => {
    serve({ '/dawah/events/:id/': () => ok({ ...event, featured_image_url: IMG, resources: [audio(8), doc(30)] }) })
    render(<TestApp path="/dawah/events/3" />)
    const img = await screen.findByAltText('Featured image for Friday khutbah')
    expect(img).toHaveAttribute('src', IMG)
    expect(img).toHaveAttribute('loading', 'lazy')
    expect(await screen.findByRole('heading', { name: 'Documents' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Open document/ })).toHaveAttribute('href', DOC_URL)
    expect(screen.getAllByRole('group', { name: /Audio player/ })).toHaveLength(1)
  })

  test('server alt text wins; an unsafe URL renders no image at all', async () => {
    serve({ '/dawah/events/:id/': () => ok({ ...event, featured_image_url: IMG, featured_image_alt: 'Worshippers at FUTA mosque', resources: [] }) })
    const { unmount } = render(<TestApp path="/dawah/events/3" />)
    expect(await screen.findByAltText('Worshippers at FUTA mosque')).toBeInTheDocument()
    unmount()
    serve({ '/dawah/events/:id/': () => ok({ ...event, featured_image_url: 'http://media.example.test/x.png', resources: [] }) })
    render(<TestApp path="/dawah/events/3" />)
    await screen.findByRole('heading', { name: 'Friday khutbah' })
    expect(screen.queryByTestId('event-image')).toBeNull()
  })

  test('a broken image is removed instead of showing a broken icon', async () => {
    serve({ '/dawah/events/:id/': () => ok({ ...event, featured_image_url: IMG, resources: [] }) })
    render(<TestApp path="/dawah/events/3" />)
    const img = await screen.findByAltText('Featured image for Friday khutbah')
    img.dispatchEvent(new Event('error'))
    await vi.waitFor(() => expect(screen.queryByTestId('event-image')).toBeNull())
  })

  test('upcoming event cards on the archive show the image', async () => {
    serve({ '/dawah/events/': () => ok(page([{ ...event, id: 5, title: 'Seerah night', featured_image_url: IMG }])) })
    render(<TestApp path="/dawah" />)
    expect(await screen.findByAltText('Featured image for Seerah night')).toHaveAttribute('loading', 'lazy')
  })

  test('content detail shows the parent event image when the payload carries it', async () => {
    serve({ '/dawah/resources/:id/': () => ok(doc(30, { event: { ...audio(8).event, featured_image_url: IMG } })) })
    render(<TestApp path="/dawah/content/30" />)
    expect(await screen.findByAltText('Featured image for Friday khutbah')).toHaveAttribute('src', IMG)
    expect(screen.getByRole('link', { name: /Open document/ })).toBeVisible()
  })
})

describe('archive type filter', () => {
  function serve(handlers) {
    const h = publicHandlers(handlers)
    server.use(...h.list)
    return h
  }
  const archiveCalls = (h) => h.calls.filter((call) => call.path === '/dawah/archive/')

  test('listArchive omits type for "all" and passes doc', async () => {
    const h = serve({ '/dawah/archive/': () => ok(page([])) })
    await listArchive({ type: 'all' })
    await listArchive({ type: 'doc' })
    expect(archiveCalls(h)[0].query.type).toBeUndefined()
    expect(archiveCalls(h)[1].query.type).toBe('doc')
  })

  test('Type select offers All types, Audio, Video and Documents; choosing All sends no type and lives in the URL', async () => {
    const h = serve({ '/dawah/archive/': () => ok(page([audio(8), doc(30), video(19)])) })
    render(<TestApp path="/dawah?type=all" />)
    await screen.findByRole('link', { name: 'Slides 30' })
    expect(archiveCalls(h)[0].query.type).toBeUndefined()
    expect([...screen.getByLabelText('Type').options].map((o) => o.textContent)).toEqual(['All types', 'Audio', 'Video', 'Documents'])
    expect(screen.getByLabelText('Type')).toHaveValue('all')
    // each card type has its action: Listen / document link / Watch
    expect(screen.getByRole('link', { name: 'Listen' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Watch' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Open document/ })).toHaveAttribute('rel', 'noopener noreferrer')
  })

  test('choosing Documents requests type=doc and updates the URL', async () => {
    const h = serve({ '/dawah/archive/': ({ request }) => ok(page(new URL(request.url).searchParams.get('type') === 'doc' ? [doc(30)] : [audio(8)])) })
    render(<TestApp path="/dawah" />)
    await screen.findByRole('link', { name: 'Patience 8' })
    expect(archiveCalls(h)[0].query.type).toBe('aud')
    const user = userEvent.setup()
    await user.selectOptions(screen.getByLabelText('Type'), 'doc')
    await user.click(screen.getByRole('button', { name: 'Apply filters' }))
    await screen.findByRole('link', { name: 'Slides 30' })
    expect(archiveCalls(h).at(-1).query.type).toBe('doc')
    expect(screen.getByTestId('location').textContent).toBe('/dawah?type=doc')
    expect(archiveCalls(h).every((call) => call.auth === null)).toBe(true)
  })

  test('an unknown type in the URL falls back to audio', async () => {
    const h = serve()
    render(<TestApp path="/dawah?type=zip" />)
    await screen.findByRole('link', { name: 'Patience 8' })
    expect(archiveCalls(h)[0].query.type).toBe('aud')
  })

  test('a document with an unsafe URL in the archive shows as unavailable, never a link', async () => {
    serve({ '/dawah/archive/': () => ok(page([doc(30, { media_url: 'javascript:alert(1)' })])) })
    render(<TestApp path="/dawah?type=doc" />)
    await screen.findByRole('link', { name: 'Slides 30' })
    expect(screen.getByText('This document is not available right now.')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Open document/ })).toBeNull()
  })
})
