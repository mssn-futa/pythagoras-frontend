import { api } from "../../../services/api";

/*
 * Broadcast service (D4 Backend Design routes). Paths are canonical (trailing
 * slash, no /api/v1 prefix). The shared client unwraps the D0 envelope once, so
 * every function resolves to the mapped `data` payload.
 */
export const BROADCAST_PATH = "/dawah/broadcasts/";
const detailPath = (id) => `${BROADCAST_PATH}${encodeURIComponent(id)}/`;

export const AUDIENCE_TYPES = ["all", "department", "level"];
export const COUNT_KEYS = ["queued", "sent", "failed", "uncertain", "skipped", "cancelled"];

const toCount = (value) => (Number.isInteger(value) && value >= 0 ? value : 0);

/** Wire audience ({type, department?, level?}) → form-friendly object. */
export function normalizeAudience(raw) {
  const type = AUDIENCE_TYPES.includes(raw?.type) ? raw.type : "all";
  return {
    type,
    department: type === "department" ? String(raw?.department ?? "") : "",
    level: type === "level" ? String(raw?.level ?? "") : "",
  };
}

/** Form audience → exact wire audience: only the selector fields of the chosen type. */
export function toAudiencePayload(audience) {
  if (audience?.type === "department") return { type: "department", department: String(audience.department ?? "").trim() };
  if (audience?.type === "level") return { type: "level", level: String(audience.level ?? "").trim() };
  return { type: "all" };
}

export function normalizeCounts(raw) {
  const counts = {};
  for (const key of COUNT_KEYS) counts[key] = toCount(raw?.[key]);
  return counts;
}

/** Broadcast (draft or queued) wire object → UI model with safe defaults. */
export function normalizeBroadcast(raw) {
  return {
    id: raw.id,
    subject: String(raw.subject ?? ""),
    body: String(raw.body ?? ""),
    bodyFormat: raw.body_format ?? "plain",
    audience: normalizeAudience(raw.audience),
    state: String(raw.state ?? "draft"),
    version: raw.version,
    creatorId: raw.creator_id ?? raw.creator ?? null,
    createdAt: raw.created_at ?? null,
    updatedAt: raw.updated_at ?? null,
    queuedAt: raw.queued_at ?? null,
    recipientCount: toCount(raw.recipient_count),
    counts: normalizeCounts(raw.counts),
    eligibleActions: Array.isArray(raw.eligible_actions) ? raw.eligible_actions : [],
  };
}

export function normalizeDelivery(raw) {
  return {
    id: raw.id,
    studentId: raw.student_id ?? null,
    recipient: raw.snapshot_email ?? null,
    state: String(raw.state ?? "queued"),
    attemptCount: toCount(raw.attempt_count),
    retryGeneration: toCount(raw.retry_generation),
    providerEmailId: raw.provider_email_id ?? null,
    errorCode: raw.error_code ?? null,
    sentAt: raw.sent_at ?? null,
    updatedAt: raw.updated_at ?? null,
    // Absent when the server sends no hint; eligibility then falls back to state.
    eligibleActions: Array.isArray(raw.eligible_actions) ? raw.eligible_actions : null,
  };
}

/**
 * Preview is text-only by design: HTML fields (`body_html`, rendered HTML) are
 * intentionally not mapped, so no caller can inject server or user HTML.
 */
export function normalizePreview(raw) {
  return {
    subject: String(raw?.subject ?? ""),
    body: String(raw?.body ?? ""),
    renderedText: raw?.rendered_text == null ? null : String(raw.rendered_text),
    audienceCount: Number.isInteger(raw?.audience_count) ? raw.audience_count : null,
  };
}

function normalizePage(data, map) {
  return {
    count: toCount(data?.count),
    next: data?.next ?? null,
    previous: data?.previous ?? null,
    results: (data?.results ?? []).map(map),
  };
}

export function toDraftPayload({ subject, body, audience }) {
  return { subject: subject.trim(), body, audience: toAudiencePayload(audience) };
}

export async function listBroadcasts({ page = 1, pageSize = 20, states } = {}, config = {}) {
  const params = { page, page_size: pageSize };
  if (states?.length) params.state = states.join(",");
  return normalizePage(await api.get(BROADCAST_PATH, { ...config, params }), normalizeBroadcast);
}

export async function getBroadcast(id, config = {}) {
  return normalizeBroadcast(await api.get(detailPath(id), config));
}

export async function createDraft(draft) {
  return normalizeBroadcast(await api.post(BROADCAST_PATH, toDraftPayload(draft)));
}

export async function updateDraft(id, draft, version) {
  return normalizeBroadcast(await api.patch(detailPath(id), { ...toDraftPayload(draft), version }));
}

export async function previewBroadcast(id) {
  return normalizePreview(await api.post(`${detailPath(id)}preview/`, {}));
}

/** 202 first time and on replay; resolves to the acknowledgement as a broadcast. */
export async function queueBroadcast(id, version) {
  return normalizeBroadcast(await api.post(`${detailPath(id)}queue/`, { version }));
}

export async function listDeliveries(id, { page = 1, pageSize = 20, state } = {}, config = {}) {
  const params = { page, page_size: pageSize };
  if (state) params.state = state;
  return normalizePage(await api.get(`${detailPath(id)}deliveries/`, { ...config, params }), normalizeDelivery);
}

export async function retryDeliveries(id, deliveryIds) {
  return api.post(`${detailPath(id)}retry/`, { delivery_ids: [...deliveryIds] });
}
