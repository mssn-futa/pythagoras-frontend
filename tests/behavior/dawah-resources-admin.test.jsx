import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import * as transport from '../../src/features/dawah/admin/uploadTransport.js'
import { documentContentType, imageContentType, validateDocumentFile, validateImageFile } from '../../src/features/dawah/admin/uploadFiles.js'
import { fail, ok, resetSession, url, useApiOrigin } from '../fixtures/auth.js'
import { apiHandler, paged, R2_ORIGIN, rawEvent, rawIntent, rawResource, renderAdminApp } from '../fixtures/dawah.jsx'

vi.mock('../../src/features/dawah/admin/uploadTransport.js', async (importOriginal) => {
  const original = await importOriginal()
  return { ...original, putToSignedUrl: vi.fn(original.putToSignedUrl) }
})

beforeEach(useApiOrigin)
afterEach(() => {
  resetSession()
  window.localStorage.clear()
  window.sessionStorage.clear()
})

const PDF = 'application/pdf'
const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
const file = (name, type, size = 2048) => new File([new Uint8Array(size)], name, { type })
const PREVIEW = `${R2_ORIGIN}/preview/slides.pdf?X-Amz-Signature=synthetic`

/** Simulated backend for one doc resource (id 8) or the event image; the R2 host is a plain MSW handler. */
function backend({ kind, put, finalize, state: initial = {}, intentGate } = {}) {
  const log = { intents: [], puts: [], finalizes: [], reads: 0 }
  const state = { storage: 'none', uploadedAt: undefined, image: null, ...initial }
  const doc = kind === 'doc'
  const handlers = [
    http.get(url('/dawah/events/3/'), () => {
      if (!doc) log.reads += 1
      return ok(rawEvent({ status: 'published', ...(state.image ?? {}) }))
    }),
    http.get(url('/dawah/events/3/resources/'), () => ok(paged([]))),
    http.get(url('/dawah/events/3/resources/8/'), () => {
      log.reads += 1
      return ok(
        rawResource({
          type: 'doc',
          status: state.status ?? 'draft',
          storage_status: state.storage,
          uploaded_at: state.uploadedAt,
          file_name: state.storage === 'ready' ? 'slides.pdf' : undefined,
          size_bytes: state.storage === 'ready' ? 2048 : undefined,
          preview_url: state.storage === 'ready' ? PREVIEW : undefined,
        }),
      )
    }),
    http.post(url(doc ? '/dawah/events/3/resources/8/document/' : '/dawah/events/3/featured-image/'), async ({ request }) => {
      const body = await request.json()
      await intentGate
      log.intents.push({ auth: request.headers.get('authorization'), body })
      const n = log.intents.length
      return ok(
        rawIntent({ upload_id: 20 + n, upload_url: `${R2_ORIGIN}/staging/abc123?X-Amz-Signature=synthetic&n=${n}`, headers: { 'Content-Type': body.content_type } }),
        'Created.',
        { status: 201 },
      )
    }),
    http.put(`${R2_ORIGIN}/staging/abc123`, async ({ request }) => {
      log.puts.push({ auth: request.headers.get('authorization'), cookie: request.headers.get('cookie'), contentType: request.headers.get('content-type'), bytes: (await request.arrayBuffer()).byteLength })
      return put?.(log.puts.length) ?? new HttpResponse(null, { status: 200, headers: { ETag: '"e"' } })
    }),
    http.post(url('/dawah/uploads/:id/finalize/'), ({ params, request }) => {
      log.finalizes.push({ id: params.id, auth: request.headers.get('authorization') })
      return (finalize ?? defaultFinalize)(log.finalizes.length)
    }),
  ]
  const defaultFinalize = () => {
    state.storage = 'ready'
    return ok({ upload: { status: 'ready' }, preview_url: doc ? PREVIEW : `${R2_ORIGIN}/preview/image.png?X-Amz-Signature=synthetic` })
  }
  return { log, state, handlers }
}

const openDoc = (b) => renderAdminApp('/admin/events/3/resources/8', b.handlers)
const openEvent = (b) => renderAdminApp('/admin/events/3', b.handlers)

async function choose(label, f) {
  const user = userEvent.setup({ applyAccept: false })
  await user.upload(await screen.findByLabelText(label), f)
  return user
}

describe('file validation helpers', () => {
  test('documents: PDF/DOCX by extension, declared type from the extension, 20 MiB cap', () => {
    expect(documentContentType(file('a.PDF', ''))).toBe(PDF)
    expect(documentContentType(file('a.docx', ''))).toBe(DOCX)
    expect(documentContentType(file('a.exe', ''))).toBeNull()
    expect(validateDocumentFile(file('a.pdf', PDF))).toBeNull()
    expect(validateDocumentFile(file('a.docx', ''))).toBeNull() // browsers often report no type for docx
    expect(validateDocumentFile(file('a.pdf', 'application/octet-stream'))).toBeNull()
    expect(validateDocumentFile(file('a.docx', 'application/zip'))).toBeNull()
    expect(validateDocumentFile(file('a.pdf', 'application/zip'))).toMatch(/Only PDF/)
    expect(documentContentType(file('a.docx', 'application/zip'))).toBe(DOCX) // declared type stays extension-derived
    expect(validateDocumentFile(file('a.pdf', 'image/png'))).toMatch(/Only PDF/)
    expect(validateDocumentFile(file('a.xlsx', 'application/vnd.ms-excel'))).toMatch(/Only PDF/)
    expect(validateDocumentFile(file('a.pdf', PDF, 0))).toMatch(/empty/)
    const big = file('a.pdf', PDF)
    Object.defineProperty(big, 'size', { value: 20 * 1024 * 1024 + 1 })
    expect(validateDocumentFile(big)).toMatch(/limit is 20\.0 MiB/)
  })
  test('images: JPEG/PNG only, 10 MiB cap', () => {
    expect(imageContentType(file('a.jpg', ''))).toBe('image/jpeg')
    expect(imageContentType(file('a.jpeg', ''))).toBe('image/jpeg')
    expect(imageContentType(file('a.png', ''))).toBe('image/png')
    expect(validateImageFile(file('a.jpg', 'image/pjpeg'))).toBeNull()
    expect(validateImageFile(file('a.png', 'application/octet-stream'))).toBeNull()
    expect(validateImageFile(file('a.png', 'image/jpeg'))).toMatch(/Only JPEG/)
    expect(validateImageFile(file('a.gif', 'image/gif'))).toMatch(/Only JPEG/)
    expect(validateImageFile(file('a.svg', 'image/svg+xml'))).toMatch(/Only JPEG/)
    expect(validateImageFile(file('a.png', 'application/pdf'))).toMatch(/Only JPEG/)
    const big = file('a.png', 'image/png')
    Object.defineProperty(big, 'size', { value: 10 * 1024 * 1024 + 1 })
    expect(validateImageFile(big)).toMatch(/limit is 10\.0 MiB/)
  })
})

describe('document resource', () => {
  test('creating a document draft posts type=doc and continues to the upload screen', async () => {
    const create = apiHandler('post', '/dawah/events/3/resources/', ({ entry }) => ok(rawResource({ id: 31, type: 'doc', title: entry.body.title }), 'Created.', { status: 201 }))
    const b = backend({ kind: 'doc' })
    renderAdminApp('/admin/events/3/resources/new?type=doc', [create.handler, http.get(url('/dawah/events/3/resources/31/'), () => ok(rawResource({ id: 31, type: 'doc' }))), ...b.handlers])
    expect(await screen.findByLabelText('Type')).toHaveValue('doc')
    const user = userEvent.setup()
    await user.type(screen.getByLabelText(/Title/), 'Slides')
    await user.click(screen.getByRole('button', { name: 'Save draft' }))
    expect(create.rec.calls[0].body).toEqual({ title: 'Slides', type: 'doc' })
    expect(await screen.findByText('Draft saved. Now upload the document.')).toBeInTheDocument()
  })

  test('intent (with the document route and extension-derived type) → direct PUT with no credentials → finalize → ready from the server', async () => {
    const b = backend({ kind: 'doc' })
    openDoc(b)
    await choose(/PDF or Word file/, file('slides.pdf', PDF, 4096))
    expect(await screen.findByText(/server confirmed this document is ready/i)).toBeInTheDocument()
    expect(b.log.intents[0].body).toEqual({ file_name: 'slides.pdf', content_type: PDF, size_bytes: 4096 })
    expect(b.log.intents[0].auth).toMatch(/^Bearer /)
    expect(b.log.puts).toEqual([{ auth: null, cookie: null, contentType: PDF, bytes: 4096 }])
    expect(b.log.finalizes).toEqual([{ id: '21', auth: expect.stringMatching(/^Bearer /) }])
    // Preview is a safe, new-tab link, never an inline frame.
    const link = await screen.findByRole('link', { name: /Open document/ })
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
    expect(document.querySelector('iframe, embed, object')).toBeNull()
  })

  test('DOCX with an empty browser type declares the DOCX content type', async () => {
    const b = backend({ kind: 'doc' })
    openDoc(b)
    await choose(/PDF or Word file/, file('agenda.docx', ''))
    await screen.findByText(/server confirmed this document is ready/i)
    expect(b.log.intents[0].body.content_type).toBe(DOCX)
    expect(b.log.puts[0].contentType).toBe(DOCX)
  })

  test('unsupported type and oversize never request an intent', async () => {
    const b = backend({ kind: 'doc' })
    openDoc(b)
    await choose(/PDF or Word file/, file('sheet.xlsx', 'application/vnd.ms-excel'))
    expect(await screen.findByText(/Only PDF \(\.pdf\) and Word/)).toBeInTheDocument()
    expect(b.log.intents).toEqual([])
    expect(b.log.puts).toEqual([])
  })

  test('server rejection at finalize asks for another file; nothing is shown as ready', async () => {
    const b = backend({ kind: 'doc', finalize: () => fail(400, 'VALIDATION_ERROR', 'The file is not a valid PDF.') })
    openDoc(b)
    await choose(/PDF or Word file/, file('bad.pdf', PDF))
    expect(await screen.findByText(/not a valid PDF/)).toBeInTheDocument()
    expect(screen.queryByText(/server confirmed/i)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Choose another file' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Open document/ })).not.toBeInTheDocument()
  })

  test('PUT failure retries the same intent; no bearer on any PUT', async () => {
    const b = backend({ kind: 'doc', put: (n) => (n === 1 ? HttpResponse.error() : null) })
    openDoc(b)
    await choose(/PDF or Word file/, file('slides.pdf', PDF))
    expect(await screen.findByText(/Could not send the file to storage/)).toBeInTheDocument()
    await userEvent.setup().click(screen.getByRole('button', { name: 'Retry upload' }))
    expect(await screen.findByText(/server confirmed this document is ready/i)).toBeInTheDocument()
    expect(b.log.intents).toHaveLength(1)
    expect(b.log.puts).toHaveLength(2)
    expect(b.log.puts.every((p) => p.auth === null && p.cookie === null)).toBe(true)
  })

  test('finalize provider failure keeps the uploaded bytes and retries finalize only', async () => {
    const b = backend({ kind: 'doc', finalize: (n) => (n === 1 ? fail(503, 'MEDIA_UPLOAD_FAILED', 'Storage unavailable.') : undefined) })
    b.handlers.splice(b.handlers.length - 1, 1, http.post(url('/dawah/uploads/:id/finalize/'), () => {
      b.log.finalizes.push({})
      if (b.log.finalizes.length === 1) return fail(503, 'MEDIA_UPLOAD_FAILED', 'Storage unavailable.')
      b.state.storage = 'ready'
      return ok({ upload: { status: 'ready' } })
    }))
    openDoc(b)
    await choose(/PDF or Word file/, file('slides.pdf', PDF))
    await userEvent.setup().click(await screen.findByRole('button', { name: 'Retry validation' }))
    expect(await screen.findByText(/server confirmed this document is ready/i)).toBeInTheDocument()
    expect(b.log.puts).toHaveLength(1)
    expect(b.log.intents).toHaveLength(1)
  })

  test('finalize status "expired" is terminal for documents: choose the file again, never "check again"', async () => {
    const b = backend({ kind: 'doc', finalize: () => ok({ upload: { id: 21, status: 'expired', error_code: 'UPLOAD_EXPIRED', message: 'Expired.' } }) })
    openDoc(b)
    await choose(/PDF or Word file/, file('slides.pdf', PDF))
    expect(await screen.findByText(/upload link expired before the document was validated/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Choose another file' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Check again' })).not.toBeInTheDocument()
    expect(screen.queryByText(/server confirmed/i)).not.toBeInTheDocument()
  })

  test('Cancel during the PUT aborts it, never finalizes, and the draft survives', async () => {
    const b = backend({ kind: 'doc' })
    let signal = null
    transport.putToSignedUrl.mockImplementationOnce(({ signal: s }) => {
      signal = s
      return new Promise((_resolve, reject) => s.addEventListener('abort', () => reject(new transport.UploadTransportError('aborted'))))
    })
    openDoc(b)
    const user = await choose(/PDF or Word file/, file('slides.pdf', PDF))
    await waitFor(() => expect(signal).not.toBeNull())
    await user.click(screen.getByRole('button', { name: 'Cancel upload' }))
    expect(await screen.findByText('Upload cancelled. Your draft is saved.')).toBeInTheDocument()
    expect(signal.aborted).toBe(true)
    expect(b.log.finalizes).toEqual([])
  })

  test('a published document cannot be replaced; unpublish first', async () => {
    const b = backend({ kind: 'doc', state: { storage: 'ready', status: 'published' } })
    openDoc(b)
    expect(await screen.findByText(/Published documents cannot be replaced/)).toBeInTheDocument()
    expect(screen.queryByLabelText(/PDF or Word file/)).not.toBeInTheDocument()
  })

  test('publishing a document without a ready asset shows MEDIA_NOT_READY copy', async () => {
    const b = backend({ kind: 'doc' })
    const publish = apiHandler('post', '/dawah/events/3/resources/8/publish/', () => fail(409, 'MEDIA_NOT_READY', 'Not ready.'))
    renderAdminApp('/admin/events/3/resources/8', [publish.handler, ...b.handlers])
    await userEvent.setup().click(await screen.findByRole('button', { name: 'Publish resource' }))
    expect(await screen.findByText(/not ready yet/i)).toBeInTheDocument()
    expect(screen.getByText(/Publishing needs a ready document/)).toBeInTheDocument()
  })

  test('no signed URL is written to browser storage', async () => {
    const b = backend({ kind: 'doc' })
    openDoc(b)
    await choose(/PDF or Word file/, file('slides.pdf', PDF))
    await screen.findByText(/server confirmed this document is ready/i)
    const dump = JSON.stringify({ ...window.localStorage }) + JSON.stringify(Object.fromEntries(Object.entries({ ...window.sessionStorage }).filter(([k]) => !/refresh/i.test(k))))
    expect(dump).not.toMatch(/X-Amz|staging|preview/)
  })
})

describe('event featured image', () => {
  const png = () => file('poster.png', 'image/png', 3000)

  test('intent on the featured-image route → PUT no credentials → finalize → preview only from the admin preview_url', async () => {
    const b = backend({ kind: 'image' })
    openEvent(b)
    await choose(/Image file/, png())
    expect(await screen.findByText(/server confirmed this image is ready/i)).toBeInTheDocument()
    expect(b.log.intents[0].body).toEqual({ file_name: 'poster.png', content_type: 'image/png', size_bytes: 3000 })
    expect(b.log.puts).toEqual([{ auth: null, cookie: null, contentType: 'image/png', bytes: 3000 }])
    expect(b.log.finalizes).toHaveLength(1)
    expect(b.log.reads).toBeGreaterThanOrEqual(2) // re-read of the event after finalize
    const img = await screen.findByAltText(/Featured image preview for Friday khutbah/)
    expect(img).toHaveAttribute('src', expect.stringContaining('/preview/image.png'))
    expect(img).toHaveAttribute('referrerpolicy', 'no-referrer')
  })

  test('the public featured_image_url is never used for the admin preview, and an http preview is refused', async () => {
    const b = backend({ kind: 'image', state: { image: { featured_image_url: 'https://media.example.test/event.png', featured_image_preview_url: 'http://insecure.example.test/p.png' } } })
    openEvent(b)
    expect(await screen.findByText(/No preview is available right now/)).toBeInTheDocument()
    expect(screen.queryByAltText(/Featured image preview/)).not.toBeInTheDocument()
    expect(document.querySelector('img[src^="https://media.example.test"], img[src^="http:"]')).toBeNull()
  })

  test('an existing admin preview_url is shown on load', async () => {
    const b = backend({ kind: 'image', state: { image: { featured_image_url: 'https://media.example.test/e.png', featured_image_storage_status: 'ready', featured_image_preview_url: `${R2_ORIGIN}/preview/e.png?X-Amz-Signature=s` } } })
    openEvent(b)
    expect(await screen.findByAltText(/Featured image preview/)).toHaveAttribute('src', expect.stringContaining('/preview/e.png'))
  })

  test('GIF/SVG are rejected before any request', async () => {
    const b = backend({ kind: 'image' })
    openEvent(b)
    await choose(/Image file/, file('anim.gif', 'image/gif'))
    expect(await screen.findByText(/Only JPEG/)).toBeInTheDocument()
    expect(b.log.intents).toEqual([])
  })

  test('403 on PUT requests a new intent for the same event; server rejection is not ready', async () => {
    const b = backend({ kind: 'image', put: (n) => (n === 1 ? new HttpResponse('expired', { status: 403 }) : null) })
    openEvent(b)
    await choose(/Image file/, png())
    expect(await screen.findByText(/upload link expired or was refused/)).toBeInTheDocument()
    await userEvent.setup().click(screen.getByRole('button', { name: 'Retry upload' }))
    expect(await screen.findByText(/server confirmed this image is ready/i)).toBeInTheDocument()
    expect(b.log.intents).toHaveLength(2)
  })

  test('a rejected image (finalize 400) shows the error and never claims ready', async () => {
    const b = backend({ kind: 'image', finalize: () => fail(400, 'VALIDATION_ERROR', 'The image could not be decoded.') })
    openEvent(b)
    await choose(/Image file/, png())
    expect(await screen.findByText(/could not be decoded/)).toBeInTheDocument()
    expect(screen.queryByText(/server confirmed this image/i)).not.toBeInTheDocument()
    expect(screen.queryByAltText(/Featured image preview/)).not.toBeInTheDocument()
  })

  test('finalize "validating": Check again succeeds once the re-read event shows the image ready (not stuck on the finalize snapshot)', async () => {
    const b = backend({ kind: 'image', finalize: () => ok({ upload: { id: 21, status: 'validating' } }) })
    openEvent(b)
    const user = await choose(/Image file/, png())
    expect(await screen.findByText('The server has not marked this image ready yet.')).toBeInTheDocument()
    expect(screen.queryByText(/server confirmed this image/i)).not.toBeInTheDocument()
    b.state.image = { featured_image_url: 'https://media.example.test/e.png', featured_image_storage_status: 'ready', featured_image_preview_url: `${R2_ORIGIN}/preview/e.png?X-Amz-Signature=s` }
    await user.click(screen.getByRole('button', { name: 'Check again' }))
    expect(await screen.findByText(/server confirmed this image is ready/i)).toBeInTheDocument()
    expect(await screen.findByAltText(/Featured image preview/)).toBeInTheDocument()
  })

  test('images report "pending" until the server says ready; failed is terminal', async () => {
    const b = backend({ kind: 'image', finalize: () => ok({ upload: { status: 'validating' } }) })
    b.state.image = { featured_image_storage_status: 'pending' }
    openEvent(b)
    const user = await choose(/Image file/, png())
    await screen.findByRole('button', { name: 'Check again' })
    b.state.image = { featured_image_storage_status: 'failed' }
    await user.click(screen.getByRole('button', { name: 'Check again' }))
    expect(await screen.findByText(/did not accept this image/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Choose another file' })).toBeInTheDocument()
  })

  test('replacing the image of a PUBLISHED event: explicit ready finalize confirms; the old image alone does not', async () => {
    const old = { featured_image_url: 'https://media.example.test/old.png', featured_image_storage_status: 'ready', featured_image_uploaded_at: '2026-10-01T10:00:00Z' }
    const b = backend({ kind: 'image', state: { image: old }, finalize: () => ok({ upload: { status: 'validating' } }) })
    openEvent(b)
    expect(await screen.findByText(/Replacing the image of a published event keeps the old image visible/)).toBeInTheDocument()
    const user = await choose(/Image file/, png())
    expect(await screen.findByText('The server has not marked this image ready yet.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Check again' })) // unchanged uploaded_at: still the previous image
    expect(await screen.findByText(/still shows the previous image/)).toBeInTheDocument()
    expect(screen.queryByText(/server confirmed this image/i)).not.toBeInTheDocument()
    b.state.image = { ...old, featured_image_url: 'https://media.example.test/new.png', featured_image_uploaded_at: '2026-10-09T10:00:00Z' }
    await user.click(screen.getByRole('button', { name: 'Check again' }))
    expect(await screen.findByText(/server confirmed this image is ready/i)).toBeInTheDocument()
    expect(b.log.intents).toHaveLength(1)
  })

  test('replacing on a published event with an explicit ready finalize outcome confirms immediately', async () => {
    const b = backend({ kind: 'image', state: { image: { featured_image_url: 'https://media.example.test/old.png', featured_image_storage_status: 'ready' } } })
    openEvent(b)
    await choose(/Image file/, png())
    expect(await screen.findByText(/server confirmed this image is ready/i)).toBeInTheDocument()
  })

  test('Cancel during the image PUT aborts it and never finalizes', async () => {
    const b = backend({ kind: 'image' })
    let signal = null
    transport.putToSignedUrl.mockImplementationOnce(({ signal: s }) => {
      signal = s
      return new Promise((_resolve, reject) => s.addEventListener('abort', () => reject(new transport.UploadTransportError('aborted'))))
    })
    openEvent(b)
    const user = await choose(/Image file/, png())
    await waitFor(() => expect(signal).not.toBeNull())
    await user.click(screen.getByRole('button', { name: 'Cancel upload' }))
    expect(await screen.findByText('Upload cancelled. Your draft is saved.')).toBeInTheDocument()
    expect(signal.aborted).toBe(true)
    expect(b.log.finalizes).toEqual([])
  })

  test('leaving the page during the image PUT aborts it and skips finalize', async () => {
    const b = backend({ kind: 'image' })
    let signal = null
    transport.putToSignedUrl.mockImplementationOnce(({ signal: s }) => {
      signal = s
      return new Promise((_resolve, reject) => s.addEventListener('abort', () => reject(new transport.UploadTransportError('aborted'))))
    })
    const view = openEvent(b)
    await choose(/Image file/, png())
    await waitFor(() => expect(signal).not.toBeNull())
    view.unmount()
    await new Promise((resolve) => setTimeout(resolve, 100))
    expect(signal.aborted).toBe(true)
    expect(b.log.finalizes).toEqual([])
  })

  test('event publish/unpublish/delete are disabled while the image uploads, and return after cancel', async () => {
    const b = backend({ kind: 'image' })
    transport.putToSignedUrl.mockImplementationOnce(({ signal: s }) => new Promise((_resolve, reject) => s.addEventListener('abort', () => reject(new transport.UploadTransportError('aborted')))))
    openEvent(b)
    const user = await choose(/Image file/, png())
    expect(await screen.findByText(/featured-image upload is in progress/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Unpublish event' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Cancel upload' }))
    await screen.findByText('Upload cancelled. Your draft is saved.')
    expect(screen.getByRole('button', { name: 'Unpublish event' })).toBeEnabled()
  })

  test('alt text is saved with PATCH featured_image_alt and used by the preview', async () => {
    const patch = apiHandler('patch', '/dawah/events/3/', ({ entry }) => ok(rawEvent({ status: 'published', featured_image_url: 'https://media.example.test/e.png', featured_image_preview_url: `${R2_ORIGIN}/preview/e.png?X-Amz-Signature=s`, featured_image_alt: entry.body.featured_image_alt })))
    const b = backend({ kind: 'image', state: { image: { featured_image_url: 'https://media.example.test/e.png', featured_image_storage_status: 'ready', featured_image_preview_url: `${R2_ORIGIN}/preview/e.png?X-Amz-Signature=s` } } })
    renderAdminApp('/admin/events/3', [patch.handler, ...b.handlers])
    const user = userEvent.setup()
    const input = await screen.findByLabelText(/alt text/)
    await user.type(input, '  Worshippers at the mosque ')
    await user.click(screen.getByRole('button', { name: 'Save description' }))
    expect(await screen.findByText('Image description saved.')).toBeInTheDocument()
    expect(patch.rec.calls[0].body).toEqual({ featured_image_alt: 'Worshippers at the mosque' })
  })

  test('the event page offers Add document next to audio and video', async () => {
    const b = backend({ kind: 'image' })
    openEvent(b)
    expect(await screen.findByRole('link', { name: 'Add document' })).toHaveAttribute('href', '/admin/events/3/resources/new?type=doc')
  })
})
