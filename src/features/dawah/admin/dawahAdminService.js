import { api, ApiError } from "../../../services/api";
import { AUDIO_CONTENT_TYPE, LIST_PAGE_SIZE_MAX, PAGE_SIZE } from "./constants.js";
import { documentContentType, imageContentType } from "./uploadFiles.js";
import { guessVideoId } from "./youtubeLink.js";
import { lagosLocalToUtcIso, utcIsoToLagosLocal } from "./time.js";

/*
 * Admin Da'wah service. Endpoints, envelopes and state codes follow D2
 * "Backend Design" / "API Contracts". Everything goes through the shared
 * client (bearer + refresh). The direct R2 PUT is NOT here: see
 * uploadTransport.js.
 */

const eventsUrl = "/dawah/events/";
const eventUrl = (id) => `/dawah/events/${id}/`;
const resourcesUrl = (eventId) => `/dawah/events/${eventId}/resources/`;
const resourceUrl = (eventId, id) => `/dawah/events/${eventId}/resources/${id}/`;

// ---- mapping -------------------------------------------------------------

export function mapEvent(raw = {}) {
  return {
    id: raw.id,
    title: raw.title ?? "",
    category: raw.category ?? "",
    tags: raw.tags ?? "",
    speakers: raw.speakers ?? "",
    location: raw.location ?? "",
    startTime: raw.start_time ?? null,
    endTime: raw.end_time ?? null,
    summary: raw.summary ?? "",
    description: raw.description ?? "",
    status: raw.status ?? "draft",
    publishedAt: raw.published_at ?? null,
    createdAt: raw.created_at ?? null,
    updatedAt: raw.updated_at ?? null,
    featuredImageUrl: raw.featured_image_url ?? null,
    // ASSUMPTIONS (not literal in D2, which only names featured_image_url and an admin preview_url):
    // the admin event payload may carry a short-lived `preview_url` and image status/time fields.
    previewUrl: raw.preview_url ?? raw.featured_image_preview_url ?? null,
    featuredImageStatus: raw.featured_image_storage_status ?? raw.featured_image_status ?? null,
    featuredImageUploadedAt: raw.featured_image_uploaded_at ?? null,
  };
}

export function mapResource(raw = {}) {
  return {
    id: raw.id,
    eventId: raw.event_id ?? raw.event?.id ?? null,
    title: raw.title ?? "",
    type: raw.type ?? "aud",
    status: raw.status ?? "draft",
    storageStatus: raw.storage_status ?? "none",
    mediaUrl: raw.media_url ?? null,
    previewUrl: raw.preview_url ?? null,
    duration: typeof raw.duration === "number" ? raw.duration : null,
    fileName: raw.file_name ?? null, // ASSUMPTION: D2 says documents expose a "validated MIME/file name"
    contentType: raw.content_type ?? null,
    sizeBytes: typeof raw.size_bytes === "number" ? raw.size_bytes : null,
    uploadedAt: raw.uploaded_at ?? null,
    playback: raw.playback ?? null,
    createdAt: raw.created_at ?? null,
    updatedAt: raw.updated_at ?? null,
  };
}

/** D0 paginated `data`; tolerates a bare array in case a list is unpaginated. */
export function mapPage(data, mapItem) {
  if (Array.isArray(data)) return { count: data.length, next: null, previous: null, results: data.map(mapItem) };
  return {
    count: data?.count ?? 0,
    next: data?.next ?? null,
    previous: data?.previous ?? null,
    results: (data?.results ?? []).map(mapItem),
  };
}

export function mapUploadIntent(raw = {}) {
  return {
    uploadId: raw.upload_id,
    resourceId: raw.resource_id,
    method: raw.method ?? "PUT",
    uploadUrl: raw.upload_url,
    headers: raw.headers ?? {},
    expiresAt: raw.expires_at ?? null,
    maxSizeBytes: typeof raw.max_size_bytes === "number" ? raw.max_size_bytes : null,
  };
}

/** Form values (Lagos wall-clock inputs) → request body with UTC instants. */
export function toEventPayload(values) {
  return {
    title: values.title.trim(),
    category: values.category.trim(),
    tags: values.tags.trim(),
    speakers: values.speakers.trim(),
    location: values.location.trim(),
    start_time: lagosLocalToUtcIso(values.startLocal),
    end_time: lagosLocalToUtcIso(values.endLocal),
    summary: values.summary.trim(),
    description: values.description.trim(),
  };
}

/** Event view model → form values. */
export function toEventFormValues(event) {
  return {
    title: event?.title ?? "",
    category: event?.category ?? "",
    tags: event?.tags ?? "",
    speakers: event?.speakers ?? "",
    location: event?.location ?? "",
    startLocal: utcIsoToLagosLocal(event?.startTime),
    endLocal: utcIsoToLagosLocal(event?.endTime),
    summary: event?.summary ?? "",
    description: event?.description ?? "",
  };
}

// ---- events --------------------------------------------------------------

/** `status`: draft|published|unpublished|all (assumed draft-inclusive value). */
export async function listEvents({ status = "all", upcoming = false, page = 1, pageSize = PAGE_SIZE, search } = {}) {
  const params = { status, page, page_size: pageSize };
  if (upcoming) params.upcoming = true;
  if (search) params.search = search;
  return mapPage(await api.get(eventsUrl, { params }), mapEvent);
}

const MAX_PAGES = 50;

/** Follows `next` until the list is exhausted (bounded), so no hard cap hides records. */
async function fetchAllPages(fetchPage) {
  const first = await fetchPage(1);
  const results = [...first.results];
  let last = first;
  for (let page = 2; last.next && page <= MAX_PAGES; page += 1) {
    last = await fetchPage(page);
    results.push(...last.results);
  }
  return { ...first, next: null, results };
}

export const listAllEventsForPicker = () =>
  fetchAllPages((page) => listEvents({ status: "all", page, pageSize: LIST_PAGE_SIZE_MAX }));

export const listAllResources = (eventId) => fetchAllPages((page) => listResources(eventId, { page }));

const isTransportFailure = (error) => error instanceof ApiError && error.status === 0;

/** Raised when a create's outcome could not be confirmed after a lost response. */
function unconfirmed(what) {
  return new ApiError({
    status: 0,
    code: "SAVE_UNCONFIRMED",
    message: `We could not confirm whether the ${what} was saved. Check the list for it before saving again, to avoid a duplicate draft.`,
  });
}

/**
 * Create an event. A lost response (status 0) may still have created the draft,
 * so look for it before letting the admin resubmit.
 */
export async function createEventSafely(values) {
  try {
    return await createEvent(values);
  } catch (error) {
    if (!isTransportFailure(error)) throw error;
    const payload = toEventPayload(values);
    let found;
    try {
      const page = await listEvents({ status: "all", search: payload.title, pageSize: LIST_PAGE_SIZE_MAX });
      found = page.results.find((event) => event.title === payload.title && event.startTime === payload.start_time && event.status === "draft") ?? null;
    } catch {
      throw unconfirmed("event");
    }
    if (found) return found;
    throw error; // verified absent: safe to submit again
  }
}

/** Same protection for the audio draft: a recovered draft is returned instead of a duplicate. */
export async function createAudioResourceSafely(eventId, { title }) {
  try {
    return await createAudioResource(eventId, { title });
  } catch (error) {
    if (!isTransportFailure(error)) throw error;
    let found;
    try {
      const all = await listAllResources(eventId);
      found = all.results.find((item) => item.type === "aud" && item.status === "draft" && item.title === title.trim()) ?? null;
    } catch {
      throw unconfirmed("draft");
    }
    if (found) return found;
    throw error;
  }
}

export async function getEvent(id) {
  return mapEvent(await api.get(eventUrl(id)));
}

export async function createEvent(values) {
  return mapEvent(await api.post(eventsUrl, toEventPayload(values)));
}

export async function updateEvent(id, values) {
  return mapEvent(await api.patch(eventUrl(id), toEventPayload(values)));
}

export const deleteEvent = (id) => api.delete(eventUrl(id));
export const publishEvent = (id) => api.post(`${eventUrl(id)}publish/`);
export const unpublishEvent = (id) => api.post(`${eventUrl(id)}unpublish/`);

// ---- resources -----------------------------------------------------------

/** Server-side filters: `type` (aud|vid|doc) and, for admins, `status`. Omitted when "all". */
export async function listResources(eventId, { page = 1, pageSize = LIST_PAGE_SIZE_MAX, type, status } = {}) {
  const params = { page, page_size: pageSize };
  if (type && type !== "all") params.type = type;
  if (status && status !== "all") params.status = status;
  return mapPage(await api.get(resourcesUrl(eventId), { params }), mapResource);
}

export async function getResource(eventId, id) {
  return mapResource(await api.get(resourceUrl(eventId, id)));
}

/** DAWAH-03 creates audio drafts only (video/document are DAWAH-06/08). */
export async function createAudioResource(eventId, { title }) {
  return mapResource(await api.post(resourcesUrl(eventId), { title: title.trim(), type: "aud" }));
}

/** D2 `{"title","type":"doc"}`: a draft metadata record; bytes arrive through the document upload flow. */
export async function createDocumentResource(eventId, { title }) {
  return mapResource(await api.post(resourcesUrl(eventId), { title: title.trim(), type: "doc" }));
}

/** Same lost-response protection as the audio draft. */
export async function createDocumentResourceSafely(eventId, { title }) {
  try {
    return await createDocumentResource(eventId, { title });
  } catch (error) {
    if (!isTransportFailure(error)) throw error;
    let found;
    try {
      const all = await listAllResources(eventId);
      found = all.results.find((item) => item.type === "doc" && item.status === "draft" && item.title === title.trim()) ?? null;
    } catch {
      throw unconfirmed("draft");
    }
    if (found) return found;
    throw error;
  }
}

/** PATCH only the fields supplied. `youtubeUrl` is sent verbatim (trimmed); the server validates and normalizes it. */
export async function updateResource(eventId, id, { title, youtubeUrl }) {
  const body = {};
  if (title !== undefined) body.title = title.trim();
  if (youtubeUrl !== undefined) body.youtube_url = youtubeUrl.trim();
  return mapResource(await api.patch(resourceUrl(eventId, id), body));
}

/** D2: `{"title","type":"vid","youtube_url"}`. The response carries `playback` synchronously (no upload/job). */
export async function createVideoResource(eventId, { title, youtubeUrl }) {
  return mapResource(await api.post(resourcesUrl(eventId), { title: title.trim(), type: "vid", youtube_url: youtubeUrl.trim() }));
}

/** Same lost-response protection as the audio draft: a recovered draft video is returned instead of a duplicate. */
export async function createVideoResourceSafely(eventId, values) {
  try {
    return await createVideoResource(eventId, values);
  } catch (error) {
    if (!isTransportFailure(error)) throw error;
    let found;
    try {
      const all = await listAllResources(eventId);
      found = all.results.find((item) => item.type === "vid" && item.status === "draft" && item.title === values.title.trim()) ?? null;
    } catch {
      throw unconfirmed("draft");
    }
    if (found) {
      const expected = guessVideoId(values.youtubeUrl);
      if (expected && found.playback?.video_id === expected) return found;
      throw new ApiError({
        status: 0,
        code: "SAVE_UNCONFIRMED",
        message: "A draft with this title exists, but its YouTube link could not be matched to the one you entered. Open the draft in the resource list and verify or replace its link before saving again.",
      });
    }
    throw error;
  }
}

export const deleteResource = (eventId, id) => api.delete(resourceUrl(eventId, id));
export const publishResource = (eventId, id) => api.post(`${resourceUrl(eventId, id)}publish/`);
export const unpublishResource = (eventId, id) => api.post(`${resourceUrl(eventId, id)}unpublish/`);

// ---- audio upload --------------------------------------------------------

/** Step 1: intent metadata only, never bytes. */
export async function requestAudioUpload(eventId, resourceId, file, { signal } = {}) {
  // Only MP3 is accepted, so the declared type is always audio/mpeg even when the
  // browser reports a legacy alias (audio/mp3, audio/x-mpeg).
  const body = { file_name: file.name, content_type: AUDIO_CONTENT_TYPE, size_bytes: file.size };
  return mapUploadIntent(await api.post(`${resourceUrl(eventId, resourceId)}audio/`, body, { signal }));
}

/** Document intent (D2 route `.../resources/{id}/document/`). Declared type comes from the validated extension. */
export async function requestDocumentUpload(eventId, resourceId, file, { signal } = {}) {
  const body = { file_name: file.name, content_type: documentContentType(file), size_bytes: file.size };
  return mapUploadIntent(await api.post(`${resourceUrl(eventId, resourceId)}document/`, body, { signal }));
}

/** Featured-image intent (D2 route `/dawah/events/{id}/featured-image/`). */
export async function requestImageUpload(eventId, file, { signal } = {}) {
  const body = { file_name: file.name, content_type: imageContentType(file), size_bytes: file.size };
  return mapUploadIntent(await api.post(`${eventUrl(eventId)}featured-image/`, body, { signal }));
}

/**
 * Step 3: ask the server to validate what it observed in storage. No storage
 * key is sent. The caller must re-read the resource to learn the real state.
 */
export async function finalizeUpload(uploadId, { signal } = {}) {
  const data = await api.post(`/dawah/uploads/${uploadId}/finalize/`, undefined, { signal });
  return {
    uploadStatus: data?.upload?.status ?? data?.upload_status ?? null,
    uploadMessage: data?.upload?.message ?? null,
    uploadErrorCode: data?.upload?.error_code ?? null,
    previewUrl: data?.preview_url ?? data?.resource?.preview_url ?? null,
    resource: data?.resource ? mapResource(data.resource) : null,
  };
}
