import { api } from "../../../services/api";
import { AUDIO_CONTENT_TYPE, LIST_PAGE_SIZE_MAX, PAGE_SIZE } from "./constants.js";
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
export async function listEvents({ status = "all", upcoming = false, page = 1, pageSize = PAGE_SIZE } = {}) {
  const params = { status, page, page_size: pageSize };
  if (upcoming) params.upcoming = true;
  return mapPage(await api.get(eventsUrl, { params }), mapEvent);
}

export const listAllEventsForPicker = () => listEvents({ status: "all", pageSize: LIST_PAGE_SIZE_MAX });

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

export async function updateResource(eventId, id, { title }) {
  return mapResource(await api.patch(resourceUrl(eventId, id), { title: title.trim() }));
}

export const deleteResource = (eventId, id) => api.delete(resourceUrl(eventId, id));
export const publishResource = (eventId, id) => api.post(`${resourceUrl(eventId, id)}publish/`);
export const unpublishResource = (eventId, id) => api.post(`${resourceUrl(eventId, id)}unpublish/`);

// ---- audio upload --------------------------------------------------------

/** Step 1: intent metadata only, never bytes. */
export async function requestAudioUpload(eventId, resourceId, file) {
  const body = { file_name: file.name, content_type: file.type || AUDIO_CONTENT_TYPE, size_bytes: file.size };
  return mapUploadIntent(await api.post(`${resourceUrl(eventId, resourceId)}audio/`, body));
}

/**
 * Step 3: ask the server to validate what it observed in storage. No storage
 * key is sent. The caller must re-read the resource to learn the real state.
 */
export async function finalizeUpload(uploadId) {
  const data = await api.post(`/dawah/uploads/${uploadId}/finalize/`);
  return {
    uploadStatus: data?.upload?.status ?? data?.upload_status ?? null,
    previewUrl: data?.preview_url ?? data?.resource?.preview_url ?? null,
    resource: data?.resource ? mapResource(data.resource) : null,
  };
}
