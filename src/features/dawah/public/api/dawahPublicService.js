import { api } from '../../../../services/api'
import { safePublicUrl } from '../lib/safeUrl.js'
import { safePlayback } from '../lib/youtube.js'

/**
 * Public (anonymous) Da'wah reads, D2 "Backend Design" / "API Contracts".
 * Every call sets `public: true`: no Authorization header, never refreshes.
 * Only published content is requested; no draft/status expansion is ever sent.
 */

export const PAGE_SIZE = 12

const publicGet = (url, params) => api.get(url, { params: clean(params), public: true })

/** Drops empty filters so they are not sent as `search=` etc. */
function clean(params = {}) {
  return Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== undefined && value !== null && String(value).trim() !== ''),
  )
}

const text = (value) => (typeof value === 'string' ? value : '')

/** Display-only file name: no path parts or control characters, bounded length. */
function cleanFileName(value) {
  if (typeof value !== 'string') return ''
  // eslint-disable-next-line no-control-regex
  const base = value.replace(/[\u0000-\u001f\u007f]/g, '').split(/[\\/]/).pop().trim()
  return base.slice(0, 200)
}

export function mapEvent(raw = {}) {
  return {
    id: raw.id,
    title: text(raw.title),
    category: text(raw.category),
    tags: text(raw.tags),
    speakers: text(raw.speakers),
    location: text(raw.location),
    summary: text(raw.summary),
    description: text(raw.description),
    startTime: raw.start_time ?? null,
    endTime: raw.end_time ?? null,
    status: raw.status ?? null,
    // Public https media URL only (null otherwise). ASSUMPTION: optional `featured_image_alt`; D2 has no alt field.
    featuredImageUrl: safePublicUrl(raw.featured_image_url),
    featuredImageAlt: text(raw.featured_image_alt).trim(),
  }
}

export function mapResource(raw = {}) {
  return {
    id: raw.id,
    eventId: raw.event_id ?? raw.event?.id ?? null,
    title: text(raw.title),
    type: raw.type ?? null,
    status: raw.status ?? null,
    storageStatus: raw.storage_status ?? null,
    mediaUrl: text(raw.media_url),
    // ASSUMPTION: documents expose `file_name`, `content_type` and `size_bytes` (D2: "validated MIME/file name").
    fileName: cleanFileName(raw.file_name),
    contentType: text(raw.content_type),
    sizeBytes: Number.isFinite(raw.size_bytes) ? raw.size_bytes : null,
    duration: Number.isFinite(raw.duration) ? raw.duration : null,
    // Raw server playback metadata; VideoEmbed validates it before use (never trusted here).
    playback: raw.playback && typeof raw.playback === 'object' ? raw.playback : null,
    event: raw.event ? mapEvent(raw.event) : null,
  }
}

/**
 * The only thing the player may load. Drafts, unpublished, not-ready and
 * non-HTTPS resources are never playable, whatever the server sent.
 */
export function isPlayableAudio(resource) {
  return (
    resource?.type === 'aud' &&
    resource.status === 'published' &&
    resource.storageStatus === 'ready' &&
    safePublicUrl(resource.mediaUrl) !== null
  )
}

function mapPage(data, mapItem) {
  return {
    count: Number.isFinite(data?.count) ? data.count : 0,
    next: data?.next ?? null,
    previous: data?.previous ?? null,
    results: Array.isArray(data?.results) ? data.results.map(mapItem) : [],
  }
}

/** Defensive: a visible-only endpoint should never send drafts; drop them if it does. */
const isPublished = (item) => item.status === null || item.status === 'published'

/** A document is offered only when published, ready and carrying a safe public https URL (never a signed one). */
export function isAvailableDocument(resource) {
  return (
    resource?.type === 'doc' &&
    resource.status === 'published' &&
    resource.storageStatus === 'ready' &&
    safePublicUrl(resource.mediaUrl) !== null
  )
}

/** A video is shown only when published and it carries a valid YouTube ID (embed/watch URLs are re-validated at render). */
export function isPlayableVideo(resource) {
  return resource?.type === 'vid' && resource.status === 'published' && safePlayback(resource.playback) !== null
}

/**
 * Archive filters (D2): search, speaker, date_from/date_to (ISO dates, Lagos
 * calendar boundaries applied by the server), category, type=aud|vid|doc,
 * D0 page/page_size. `type` defaults to audio; `vid`, `doc` select those types and `all` omits the
 * filter (the archive then lists every visible type: D2 "Backend Design" archive route).
 */
export async function listArchive({ search, speaker, dateFrom, dateTo, category, type = 'aud', page = 1, pageSize = PAGE_SIZE } = {}) {
  const data = await publicGet('/dawah/archive/', {
    search,
    speaker,
    date_from: dateFrom,
    date_to: dateTo,
    category,
    type: type === 'all' ? undefined : type,
    page: page > 1 ? page : undefined,
    page_size: pageSize,
  })
  const result = mapPage(data, mapResource)
  return { ...result, results: result.results.filter(isPublished) }
}

export async function listUpcomingEvents({ page = 1, pageSize = 5 } = {}) {
  const data = await publicGet('/dawah/events/', { upcoming: 'true', page: page > 1 ? page : undefined, page_size: pageSize })
  const result = mapPage(data, mapEvent)
  return { ...result, results: result.results.filter(isPublished) }
}

/**
 * Event detail already embeds reader-visible `resources[]` (DAWAH-01 contract),
 * so one request serves the page; the separate resources list is not needed.
 */
export async function getEvent(id) {
  const raw = await publicGet(`/dawah/events/${encodeURIComponent(id)}/`)
  const event = mapEvent(raw)
  if (!isPublished(event)) throw notFound()
  const resources = (Array.isArray(raw?.resources) ? raw.resources : []).map(mapResource).filter(isPublished)
  return { ...event, resources }
}

export async function getResource(id) {
  const resource = mapResource(await publicGet(`/dawah/resources/${encodeURIComponent(id)}/`))
  if (!isPublished(resource)) throw notFound()
  return resource
}

function notFound() {
  return Object.assign(new Error('Not found.'), { status: 404, code: 'NOT_FOUND' })
}
