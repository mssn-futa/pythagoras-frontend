import { api } from "../../../services/api";
import { normalizeAudience, normalizeCounts, toAudiencePayload } from "./broadcastsApi.js";
import { normalizeLocalTime } from "../automations/automationModel.js";

/*
 * Automation service (D4 route table). Paths are canonical. Wire shapes marked ASSUMPTION are not
 * literally in D4; see docs/communication-automations.md. The shared client unwraps the D0 envelope.
 */
export const AUTOMATION_PATH = "/dawah/automations/";
const rulePath = (id) => `${AUTOMATION_PATH}${encodeURIComponent(id)}/`;

const toCount = (value) => (Number.isInteger(value) && value >= 0 ? value : 0);
const text = (value) => (value == null ? "" : String(value));

/**
 * ASSUMPTION rule payload: id, kind, enabled, audience, categories[], timezone, weekday, local_time, offset_minutes,
 * template{subject, body_format, body, body_html}, owner_id, owner_active, blocked_reason (null | code), version,
 * created_at, updated_at. Missing/odd values never default to something that looks operational.
 */
export function normalizeRule(raw) {
  const template = raw.template ?? {};
  return {
    id: raw.id,
    kind: raw.kind === "event_reminder" ? "event_reminder" : raw.kind === "weekly_digest" ? "weekly_digest" : "unknown",
    enabled: raw.enabled === true,
    audience: normalizeAudience(raw.audience),
    categories: Array.isArray(raw.categories) ? raw.categories.map(String) : [],
    timezone: raw.timezone ?? null,
    weekday: Number.isInteger(raw.weekday) ? raw.weekday : null,
    localTime: normalizeLocalTime(raw.local_time),
    offsetMinutes: Number.isInteger(raw.offset_minutes) ? raw.offset_minutes : null,
    template: {
      subject: text(template.subject),
      bodyFormat: template.body_format === "rich" ? "rich" : "plain",
      body: text(template.body),
      bodyHtml: typeof template.body_html === "string" ? template.body_html : "",
    },
    ownerId: raw.owner_id ?? null,
    ownerActive: typeof raw.owner_active === "boolean" ? raw.owner_active : null,
    blockedReason: raw.blocked_reason ?? null,
    version: raw.version,
    createdAt: raw.created_at ?? null,
    updatedAt: raw.updated_at ?? null,
  };
}

const eventSummary = (raw) => ({
  id: raw?.id ?? raw?.event_id ?? null,
  title: text(raw?.title ?? raw?.event_title),
  category: raw?.category ?? null,
  startsAt: raw?.starts_at ?? raw?.start_time ?? null,
});

/**
 * ASSUMPTION run payload: id, occurrence_key, scheduled_at, state, reason_code, broadcast_id, counts{...},
 * recipient_count, source{window_start, window_end, event{id,title,start_time}, event_revision}.
 * D4 only fixes: run ID, occurrence_key, scheduled_at, state, reason_code, broadcast_id/counts when materialized.
 */
export function normalizeRun(raw) {
  const source = raw.source ?? null;
  return {
    id: raw.id,
    occurrenceKey: text(raw.occurrence_key),
    scheduledAt: raw.scheduled_at ?? null,
    state: text(raw.state) || "unknown",
    reasonCode: raw.reason_code ?? null,
    broadcastId: raw.broadcast_id ?? null,
    counts: raw.counts ? normalizeCounts(raw.counts) : null,
    recipientCount: Number.isInteger(raw.recipient_count) ? raw.recipient_count : null,
    source: source
      ? {
          windowStart: source.window_start ?? null,
          windowEnd: source.window_end ?? null,
          event: source.event ? eventSummary(source.event) : null,
          eventRevision: source.event_revision ?? null,
        }
      : null,
    updatedAt: raw.updated_at ?? null,
  };
}

/**
 * ASSUMPTION preview payload: subject, body, body_format, rendered_html, rendered_text, audience_count,
 * source{window_start, window_end, events[{id,title,category,start_time}]}, skip_reason_code (when the
 * occurrence would be recorded as skipped). Never sends mail or snapshots recipients.
 */
export function normalizeRulePreview(raw) {
  const source = raw?.source ?? null;
  return {
    subject: text(raw?.subject),
    renderedText: raw?.rendered_text == null ? null : String(raw.rendered_text),
    renderedHtml: typeof raw?.rendered_html === "string" && raw.rendered_html.trim() ? raw.rendered_html : null,
    audienceCount: Number.isInteger(raw?.audience_count) ? raw.audience_count : null,
    skipReasonCode: raw?.skip_reason_code ?? null,
    source: source
      ? {
          windowStart: source.window_start ?? null,
          windowEnd: source.window_end ?? null,
          events: Array.isArray(source.events) ? source.events.map(eventSummary) : [],
        }
      : null,
  };
}

function normalizePage(data, map) {
  return { count: toCount(data?.count), next: data?.next ?? null, previous: data?.previous ?? null, results: (data?.results ?? []).map(map) };
}

function toTemplatePayload({ subject, bodyFormat, body, bodyHtml }) {
  // Rich templates send body_html only (the server derives the text fallback), like rich drafts.
  if (bodyFormat === "rich") return { subject: subject.trim(), body_format: "rich", body_html: bodyHtml };
  return { subject: subject.trim(), body_format: "plain", body };
}

/**
 * Weekly: {kind, audience, timezone:"Africa/Lagos", weekday (0=Monday), local_time "HH:MM", template[, categories]}.
 * Reminder: {kind, audience, offset_minutes, categories, template}. Create adds enabled:false (rules start disabled);
 * kind is immutable and never sent on PATCH, and neither create nor edit can enable a rule.
 */
export function toRulePayload(draft, { create = false } = {}) {
  const payload = { audience: toAudiencePayload(draft.audience), template: toTemplatePayload(draft.template) };
  if (draft.kind === "weekly_digest") {
    Object.assign(payload, { timezone: draft.timezone, weekday: draft.weekday, local_time: draft.localTime });
    // PATCH always states the filter so clearing every category is saved; create omits an empty one (D4 example).
    if (draft.categories.length || !create) payload.categories = [...draft.categories];
  } else {
    Object.assign(payload, { offset_minutes: draft.offsetMinutes, categories: [...draft.categories] });
  }
  if (create) return { kind: draft.kind, ...payload, enabled: false };
  return payload;
}

export async function listRules({ page = 1, pageSize = 20 } = {}, config = {}) {
  return normalizePage(await api.get(AUTOMATION_PATH, { ...config, params: { page, page_size: pageSize } }), normalizeRule);
}

export async function getRule(id, config = {}) {
  return normalizeRule(await api.get(rulePath(id), config));
}

export async function createRule(draft) {
  return normalizeRule(await api.post(AUTOMATION_PATH, toRulePayload(draft, { create: true })));
}

/** PATCH carries the rule version. */
export async function updateRule(id, draft, version) {
  return normalizeRule(await api.patch(rulePath(id), { ...toRulePayload(draft), version }));
}

/** ASSUMPTION: reassignment is PATCH {owner_id, version}. */
export async function reassignRule(id, ownerId, version) {
  return normalizeRule(await api.patch(rulePath(id), { owner_id: ownerId, version }));
}

/** ASSUMPTION: lifecycle POSTs carry {version} and answer with the rule. */
export async function enableRule(id, version) {
  return normalizeRule(await api.post(`${rulePath(id)}enable/`, { version }));
}

export async function disableRule(id, version) {
  return normalizeRule(await api.post(`${rulePath(id)}disable/`, { version }));
}

/** ASSUMPTION: body {version}; response never implies a send. */
export async function previewRule(id, version) {
  return normalizeRulePreview(await api.post(`${rulePath(id)}preview/`, { version }));
}

export async function listRuns(id, { page = 1, pageSize = 20 } = {}, config = {}) {
  return normalizePage(await api.get(`${rulePath(id)}runs/`, { ...config, params: { page, page_size: pageSize } }), normalizeRun);
}
