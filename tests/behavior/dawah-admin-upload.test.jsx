import { act, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import * as transport from '../../src/features/dawah/admin/uploadTransport.js'
import { API, fail, ok, resetSession, url, useApiOrigin } from '../fixtures/auth.js'
import { mp3, R2_PUT_URL, rawEvent, rawIntent, rawResource, renderAdminApp } from '../fixtures/dawah.jsx'

const { putToSignedUrl, UploadTransportError } = transport

// Real transport by default (MSW handles R2); one test drives progress by hand.
vi.mock('../../src/features/dawah/admin/uploadTransport.js', async (importOriginal) => {
  const original = await importOriginal()
  return { ...original, putToSignedUrl: vi.fn(original.putToSignedUrl) }
})

beforeEach(useApiOrigin)
afterEach(resetSession)

/**
 * Simulated Pythagoras + R2 backend for one draft audio resource.
 * `put` decides each R2 PUT response; `finalize` each finalize response.
 */
function backend({ put, finalize, storage = 'none', uploadedAt, intentExpiries = [], intentGate, intentUrl } = {}) {
  const log = { intents: [], puts: [], finalizes: [], resourceReads: 0 }
  const state = { storage, uploadedAt }
  const handlers = [
    http.get(url('/dawah/events/3/'), () => ok(rawEvent({ status: 'published' }))),
    http.get(url('/dawah/events/3/resources/8/'), () => {
      log.resourceReads += 1
      return ok(rawResource({ storage_status: state.storage, uploaded_at: state.uploadedAt, media_url: null, preview_url: state.storage === 'ready' ? 'https://r2.example.test/preview?sig=1' : undefined }))
    }),
    http.post(url('/dawah/events/3/resources/8/audio/'), async ({ request }) => {
      const body = await request.json()
      await intentGate
      log.intents.push({ auth: request.headers.get('authorization'), body })
      const n = log.intents.length
      return ok(rawIntent({ upload_id: 10 + n, upload_url: intentUrl ?? `${R2_PUT_URL}&n=${n}`, expires_at: intentExpiries[n - 1] ?? '2099-01-01T00:00:00Z' }), 'Created.', { status: 201 })
    }),
    http.put('https://r2.example.test/staging/abc123', async ({ request }) => {
      log.puts.push({ auth: request.headers.get('authorization'), contentType: request.headers.get('content-type'), query: new URL(request.url).search, bytes: (await request.arrayBuffer()).byteLength, cookie: request.headers.get('cookie') })
      return put?.(log.puts.length, state) ?? new HttpResponse(null, { status: 200, headers: { ETag: '"etag1"' } })
    }),
    http.post(url('/dawah/uploads/:id/finalize/'), ({ params, request }) => {
      log.finalizes.push({ id: params.id, auth: request.headers.get('authorization') })
      return (finalize ?? defaultFinalize)(log.finalizes.length, state)
    }),
  ]
  const defaultFinalize = (_n, current) => { current.storage = 'ready'; return ok({ upload: { status: 'ready' }, preview_url: 'https://r2.example.test/preview?sig=1' }) }
  return { log, state, handlers }
}

async function chooseFile(file = mp3('khutbah.mp3', 2048), options) {
  const user = userEvent.setup(options)
  const input = await screen.findByLabelText(/MP3 file/)
  await user.upload(input, file)
  return user
}

const open = (b) => renderAdminApp('/admin/events/3/resources/8', b.handlers)

describe('audio upload flow', () => {
  test('intent → direct PUT without credentials → finalize → ready only after the server says so', async () => {
    const b = backend()
    open(b)
    await chooseFile()
    expect(await screen.findByText(/server confirmed this audio is ready/i)).toBeInTheDocument()

    expect(b.log.intents).toHaveLength(1)
    expect(b.log.intents[0].auth).toMatch(/^Bearer /) // the intent call is authenticated
    expect(b.log.intents[0].body).toEqual({ file_name: 'khutbah.mp3', content_type: 'audio/mpeg', size_bytes: 2048 })
    expect(b.log.puts).toHaveLength(1)
    expect(b.log.puts[0]).toMatchObject({ auth: null, cookie: null, contentType: 'audio/mpeg', bytes: 2048 })
    expect(b.log.puts[0].query).toContain('X-Amz-Signature=synthetic')
    expect(b.log.finalizes).toEqual([{ id: '11', auth: expect.stringMatching(/^Bearer /) }])
    expect(b.log.resourceReads).toBeGreaterThanOrEqual(2) // initial load + re-read after finalize
    expect(screen.getByLabelText('Audio preview')).toBeInTheDocument()
    expect(document.querySelector('audio')).toHaveAttribute('src', 'https://r2.example.test/preview?sig=1')
  })

  test('a successful finalize call alone is not "ready": the resource state decides', async () => {
    const b = backend({ finalize: () => ok({ upload: { status: 'ready' } }) }) // storage stays "none"
    open(b)
    await chooseFile()
    expect(await screen.findByText('The server has not marked this audio ready yet.')).toBeInTheDocument()
    expect(screen.queryByText(/server confirmed this audio is ready/i)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Check again' })).toBeInTheDocument()
    b.state.storage = 'ready'
    await userEvent.setup().click(screen.getByRole('button', { name: 'Check again' }))
    expect(await screen.findByText(/server confirmed this audio is ready/i)).toBeInTheDocument()
  })

  test('PUT network/CORS failure keeps the draft and retries the SAME intent without a new draft', async () => {
    const b = backend({ put: (n) => (n === 1 ? HttpResponse.error() : null) })
    open(b)
    await chooseFile()
    expect(await screen.findByText(/Could not send the file to storage/)).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent(/CORS/)
    await userEvent.setup().click(screen.getByRole('button', { name: 'Retry upload' }))
    expect(await screen.findByText(/server confirmed this audio is ready/i)).toBeInTheDocument()
    expect(b.log.intents).toHaveLength(1)
    expect(b.log.puts).toHaveLength(2)
    expect(b.log.puts.every((put) => put.auth === null)).toBe(true)
    expect(b.log.puts[0].query).toBe(b.log.puts[1].query)
    expect(b.log.finalizes).toHaveLength(1)
  })

  test('an expired/refused signature (403) requests a NEW intent for the same resource', async () => {
    const b = backend({ put: (n) => (n === 1 ? new HttpResponse('<Error>Request has expired</Error>', { status: 403 }) : null) })
    open(b)
    await chooseFile()
    expect(await screen.findByText(/upload link expired or was refused/)).toBeInTheDocument()
    await userEvent.setup().click(screen.getByRole('button', { name: 'Retry upload' }))
    expect(await screen.findByText(/server confirmed this audio is ready/i)).toBeInTheDocument()
    expect(b.log.intents).toHaveLength(2)
    expect(b.log.puts[0].query).not.toBe(b.log.puts[1].query)
    expect(b.log.finalizes[0].id).toBe('12')
  })

  test('a locally expired intent is replaced before retrying the PUT', async () => {
    const b = backend({ put: (n) => (n === 1 ? HttpResponse.error() : null), intentExpiries: ['2000-01-01T00:00:00Z'] })
    open(b)
    await chooseFile()
    await screen.findByText(/Could not send the file to storage/)
    await userEvent.setup().click(screen.getByRole('button', { name: 'Retry upload' }))
    await screen.findByText(/server confirmed this audio is ready/i)
    expect(b.log.intents).toHaveLength(2)
  })

  test('finalize provider failure retries finalize only: bytes are not uploaded again', async () => {
    const b = backend({
      finalize: (n, state) => {
        if (n === 1) return fail(503, 'MEDIA_UPLOAD_FAILED', 'Storage provider unavailable.')
        state.storage = 'ready'
        return ok({ upload: { status: 'ready' } })
      },
    })
    open(b)
    await chooseFile()
    expect(await screen.findByText(/Storage provider unavailable/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Retry validation' })).toBeInTheDocument()
    await userEvent.setup().click(screen.getByRole('button', { name: 'Retry validation' }))
    expect(await screen.findByText(/server confirmed this audio is ready/i)).toBeInTheDocument()
    expect(b.log.puts).toHaveLength(1)
    expect(b.log.intents).toHaveLength(1)
    expect(b.log.finalizes).toHaveLength(2)
  })

  test('finalize rejection (invalid content) asks for another file and never shows ready', async () => {
    const b = backend({ finalize: () => fail(400, 'VALIDATION_ERROR', 'The file is not a valid MP3.') })
    open(b)
    await chooseFile()
    expect(await screen.findByText('The file is not a valid MP3.')).toBeInTheDocument()
    expect(screen.queryByText(/server confirmed/i)).not.toBeInTheDocument()
    expect(screen.getByText('Not accepted or not completed')).toBeInTheDocument()
    await userEvent.setup().click(screen.getByRole('button', { name: 'Choose another file' }))
    expect(await screen.findByLabelText(/MP3 file/)).toBeInTheDocument()
  })

  test('a server-reported failed storage status is shown as failed', async () => {
    const b = backend({ finalize: (_n, state) => { state.storage = 'failed'; return ok({}) } })
    open(b)
    await chooseFile()
    expect(await screen.findByText(/did not accept this audio file/)).toBeInTheDocument()
  })

  test('intent rejection (e.g. 400 size) is reported without any PUT', async () => {
    const b = backend()
    b.handlers.unshift(http.post(url('/dawah/events/3/resources/8/audio/'), () => fail(400, 'VALIDATION_ERROR', 'Correct the highlighted fields.', { size_bytes: ['File too large.'] })))
    open(b)
    await chooseFile()
    expect(await screen.findByText(/File too large\./)).toBeInTheDocument()
    expect(b.log.puts).toEqual([])
  })

  test('wrong type and oversize files are rejected before any request', async () => {
    const b = backend()
    open(b)
    const user = await chooseFile(new File(['x'], 'notes.pdf', { type: 'application/pdf' }), { applyAccept: false })
    expect(await screen.findByText('Only MP3 audio files (.mp3) are accepted.')).toBeInTheDocument()
    const big = mp3('big.mp3', 10)
    Object.defineProperty(big, 'size', { value: 101 * 1024 * 1024 })
    await user.upload(screen.getByLabelText(/MP3 file/), big)
    expect(await screen.findByText(/The limit is 100\.0 MiB/)).toBeInTheDocument()
    expect(b.log.intents).toEqual([])
  })

  test('published audio cannot be replaced (no upload control)', async () => {
    const b = backend()
    b.handlers.unshift(http.get(url('/dawah/events/3/resources/8/'), () => ok(rawResource({ status: 'published', storage_status: 'ready' }))))
    open(b)
    expect(await screen.findByText(/Published audio cannot be replaced/)).toBeInTheDocument()
    expect(screen.queryByLabelText(/MP3 file/)).not.toBeInTheDocument()
  })

  test('draft reload keeps server state: the ready draft is shown after a fresh visit', async () => {
    const b = backend({ storage: 'ready' })
    open(b)
    expect(await screen.findByText('Audio is ready. Upload again to replace it.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Publish resource' })).toBeEnabled()
  })

  test('the panel shows measured progress separately from server validation', async () => {
    const b = backend()
    let reportProgress
    let finishPut
    transport.putToSignedUrl.mockImplementationOnce(({ onProgress }) => {
      reportProgress = onProgress
      return new Promise((resolve) => { finishPut = () => resolve({ etag: '"e"' }) })
    })
    open(b)
    await chooseFile()
    await waitFor(() => expect(reportProgress).toBeTypeOf('function'))
    act(() => reportProgress(0.5))
    expect(await screen.findByText('Uploading… 50%')).toBeInTheDocument()
    expect(screen.getByRole('progressbar', { name: 'Upload progress' })).toHaveAttribute('aria-valuenow', '50')
    expect(screen.getByText('Not started')).toBeInTheDocument() // validation has not begun
    expect(b.log.finalizes).toEqual([])
    act(() => finishPut())
    expect(await screen.findByText(/server confirmed this audio is ready/i)).toBeInTheDocument()
  })
})

const deferred = () => {
  let resolve
  const promise = new Promise((done) => { resolve = done })
  return { promise, resolve }
}

/** Replaces the real PUT once with one that never completes until aborted/finished. */
function holdPut() {
  const held = { signal: null, finish: null }
  transport.putToSignedUrl.mockImplementationOnce(({ signal }) => {
    held.signal = signal
    return new Promise((resolve, reject) => {
      held.finish = () => resolve({ etag: '"e"' })
      signal.addEventListener('abort', () => reject(new UploadTransportError('aborted')), { once: true })
    })
  })
  return held
}

describe('cancel, unmount and concurrent actions', () => {
  test('Cancel during the byte upload aborts the PUT and never finalizes; retry is offered', async () => {
    const b = backend()
    const held = holdPut()
    open(b)
    const user = await chooseFile()
    await waitFor(() => expect(held.signal).not.toBeNull())
    await user.click(screen.getByRole('button', { name: 'Cancel upload' }))
    expect(await screen.findByText('Upload cancelled. Your draft is saved.')).toBeInTheDocument()
    expect(held.signal.aborted).toBe(true)
    expect(b.log.finalizes).toEqual([])
    expect(screen.getByRole('button', { name: 'Retry upload' })).toBeInTheDocument()
  })

  test('Cancel while the upload link is being requested: no PUT and no finalize afterwards', async () => {
    const gate = deferred()
    const b = backend({ intentGate: gate.promise })
    open(b)
    const user = await chooseFile()
    await user.click(await screen.findByRole('button', { name: 'Cancel upload' }))
    expect(await screen.findByText('Upload cancelled. Your draft is saved.')).toBeInTheDocument()
    gate.resolve()
    await new Promise((resolve) => setTimeout(resolve, 100))
    expect(transport.putToSignedUrl).not.toHaveBeenCalled()
    expect(b.log.puts).toEqual([])
    expect(b.log.finalizes).toEqual([])
  })

  test('leaving the page during the intent request never PUTs or finalizes', async () => {
    const gate = deferred()
    const b = backend({ intentGate: gate.promise })
    const view = open(b)
    await chooseFile()
    await screen.findByRole('button', { name: 'Cancel upload' })
    view.unmount()
    gate.resolve()
    await new Promise((resolve) => setTimeout(resolve, 100))
    expect(b.log.puts).toEqual([])
    expect(b.log.finalizes).toEqual([])
  })

  test('leaving the page during the PUT aborts it and skips finalize', async () => {
    const b = backend()
    const held = holdPut()
    const view = open(b)
    await chooseFile()
    await waitFor(() => expect(held.signal).not.toBeNull())
    view.unmount()
    expect(held.signal.aborted).toBe(true)
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(b.log.finalizes).toEqual([])
  })

  test('publish, unpublish and delete are blocked while an upload is running', async () => {
    const b = backend({ storage: 'ready' })
    const held = holdPut()
    open(b)
    const user = await chooseFile()
    await waitFor(() => expect(held.signal).not.toBeNull())
    expect(screen.getByRole('button', { name: 'Publish resource' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Delete resource' })).toBeDisabled()
    expect(screen.getByText(/An upload is in progress/)).toBeInTheDocument()
    expect(screen.getByText('Uploading… 0%')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Cancel upload' }))
    await screen.findByText('Upload cancelled. Your draft is saved.')
    expect(screen.getByRole('button', { name: 'Publish resource' })).toBeEnabled()
  })
})

describe('manual re-check after a non-terminal finalize', () => {
  test('finalize "validating": Check again succeeds once the re-read resource is ready', async () => {
    const b = backend({ finalize: () => ok({ upload: { status: 'validating' } }) })
    open(b)
    const user = await chooseFile()
    expect(await screen.findByText('The server has not marked this audio ready yet.')).toBeInTheDocument()
    b.state.storage = 'ready'
    await user.click(screen.getByRole('button', { name: 'Check again' }))
    expect(await screen.findByText(/server confirmed this audio is ready/i)).toBeInTheDocument()
  })
})

describe('replacing an already-ready draft', () => {
  test('a finalize that confirms nothing about this upload leaves the old asset un-confirmed', async () => {
    const b = backend({ storage: 'ready', uploadedAt: '2026-10-01T10:00:00Z', finalize: () => ok({}) })
    open(b)
    await chooseFile()
    expect(await screen.findByText(/still shows the previous audio/)).toBeInTheDocument()
    expect(screen.queryByText(/server confirmed this audio is ready/i)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Check again' })).toBeInTheDocument()
  })

  test('an explicit ready finalize outcome confirms the replacement', async () => {
    const b = backend({ storage: 'ready', uploadedAt: '2026-10-01T10:00:00Z', finalize: () => ok({ upload: { status: 'ready' } }) })
    open(b)
    await chooseFile()
    expect(await screen.findByText(/server confirmed this audio is ready/i)).toBeInTheDocument()
  })

  test('a changed uploaded_at on the re-read resource identifies the new asset (check again)', async () => {
    const b = backend({ storage: 'ready', uploadedAt: '2026-10-01T10:00:00Z', finalize: () => ok({}) })
    open(b)
    const user = await chooseFile()
    await screen.findByText(/still shows the previous audio/)
    b.state.uploadedAt = '2026-10-09T12:05:00Z'
    await user.click(screen.getByRole('button', { name: 'Check again' }))
    expect(await screen.findByText(/server confirmed this audio is ready/i)).toBeInTheDocument()
  })

  test('a rejected replacement asks for another file even though the old asset is ready', async () => {
    const b = backend({ storage: 'ready', finalize: () => ok({ upload: { status: 'rejected' } }) })
    open(b)
    await chooseFile()
    expect(await screen.findByText(/did not accept this audio file/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Choose another file' })).toBeInTheDocument()
    expect(screen.queryByText(/server confirmed/i)).not.toBeInTheDocument()
  })

  test('a still-validating replacement says to check again', async () => {
    const b = backend({ storage: 'ready', finalize: () => ok({ upload: { status: 'validating' } }) })
    open(b)
    await chooseFile()
    expect(await screen.findByText('The server has not marked this audio ready yet.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Check again' })).toBeInTheDocument()
  })
})

describe('file types, finalize conflicts and transport isolation', () => {
  test.each(['audio/mp3', 'audio/x-mpeg'])('accepts a browser-reported %s .mp3 and declares audio/mpeg', async (type) => {
    const b = backend()
    open(b)
    await chooseFile(new File([new Uint8Array(8)], 'khutbah.mp3', { type }))
    expect(await screen.findByText(/server confirmed this audio is ready/i)).toBeInTheDocument()
    expect(b.log.intents[0].body.content_type).toBe('audio/mpeg')
  })

  test('a finalize 409 (lease/state conflict) offers retry validation, not a new file', async () => {
    const b = backend({
      finalize: (n, state) => {
        if (n === 1) return fail(409, 'VALIDATION_IN_PROGRESS', 'Validation is already running.')
        state.storage = 'ready'
        return ok({ upload: { status: 'ready' } })
      },
    })
    open(b)
    const user = await chooseFile()
    expect(await screen.findByText(/Validation is already running/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Choose another file' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Retry validation' }))
    expect(await screen.findByText(/server confirmed this audio is ready/i)).toBeInTheDocument()
    expect(b.log.puts).toHaveLength(1)
  })

  test('a same-origin upload_url still gets no Authorization header (cookies are not asserted: jsdom/MSW cannot observe them)', async () => {
    const seen = []
    const b = backend({ intentUrl: `${API}/storage/staging/abc` })
    b.handlers.unshift(http.put(`${API}/storage/staging/abc`, ({ request }) => {
      seen.push({ auth: request.headers.get('authorization'), contentType: request.headers.get('content-type') })
      return new HttpResponse(null, { status: 200 })
    }))
    open(b)
    await chooseFile()
    expect(await screen.findByText(/server confirmed this audio is ready/i)).toBeInTheDocument()
    expect(seen).toEqual([{ auth: null, contentType: 'audio/mpeg' }])
    expect(b.log.intents[0].auth).toMatch(/^Bearer /) // the API call did carry it
  })
})

/** Minimal XHR double to drive measured upload progress deterministically. */
class FakeXhr {
  static instances = []
  constructor() {
    this.headers = {}
    this.upload = {}
    this.status = 0
    FakeXhr.instances.push(this)
  }
  open(method, target) { this.method = method; this.url = target }
  setRequestHeader(name, value) { this.headers[name] = value }
  getResponseHeader() { return '"etag"' }
  send(body) { this.body = body }
  abort() { this.onabort?.() }
}

describe('direct PUT transport', () => {
  beforeEach(() => { FakeXhr.instances = []; vi.stubGlobal('XMLHttpRequest', FakeXhr) })

  test('reports measured byte progress, forbids credentials and strips auth-like headers', async () => {
    const progress = []
    const file = mp3('k.mp3', 100)
    const promise = putToSignedUrl({ uploadUrl: R2_PUT_URL, headers: { 'Content-Type': 'audio/mpeg', Authorization: 'Bearer leaked' }, file, onProgress: (f) => progress.push(f) })
    const xhr = FakeXhr.instances[0]
    expect(xhr).toMatchObject({ method: 'PUT', url: R2_PUT_URL, withCredentials: false, headers: { 'Content-Type': 'audio/mpeg' } })
    expect(Object.keys(xhr.headers).map((name) => name.toLowerCase())).not.toContain('authorization')
    xhr.upload.onprogress({ lengthComputable: true, loaded: 25, total: 100 })
    xhr.upload.onprogress({ lengthComputable: false, loaded: 50, total: 0 }) // unmeasurable: ignored
    xhr.upload.onprogress({ lengthComputable: true, loaded: 100, total: 100 })
    xhr.status = 200
    xhr.onload()
    await expect(promise).resolves.toEqual({ etag: '"etag"' })
    expect(progress.slice(0, 2)).toEqual([0.25, 1])
    expect(xhr.body).toBe(file)
  })

  test('maps network errors, HTTP errors and aborts to typed errors', async () => {
    const a = putToSignedUrl({ uploadUrl: R2_PUT_URL, headers: {}, file: mp3() })
    FakeXhr.instances[0].onerror()
    await expect(a).rejects.toMatchObject({ kind: 'network' })

    const b = putToSignedUrl({ uploadUrl: R2_PUT_URL, headers: {}, file: mp3() })
    Object.assign(FakeXhr.instances[1], { status: 403 }).onload()
    await expect(b).rejects.toMatchObject({ kind: 'http', status: 403 })

    const controller = new AbortController()
    const c = putToSignedUrl({ uploadUrl: R2_PUT_URL, headers: {}, file: mp3(), signal: controller.signal })
    controller.abort()
    await expect(c).rejects.toBeInstanceOf(UploadTransportError)
    await expect(c).rejects.toMatchObject({ kind: 'aborted' })
  })
})
