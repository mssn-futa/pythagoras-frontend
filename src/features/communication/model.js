import { LEVEL_OPTIONS } from "../../services/api/authService.js";
import { plainToHtml } from "./editor/richContent.js";

export const POLL_INTERVAL_MS = 5000;
export const POLL_MAX_POLLS = 60; // 5 minutes of automatic refresh, then a manual refresh is offered.
export const POLL_MAX_FAILURES = 3;
export const SUBJECT_MAX_LENGTH = 200;
export const LEVELS = LEVEL_OPTIONS;

export const BROADCAST_STATES = ["queued", "processing", "completed", "completed_with_errors", "uncertain", "cancelled"];
export const DELIVERY_STATES = ["queued", "claimed", "sending", "sent", "failed", "uncertain", "skipped", "cancelled"];

export const ACCEPTANCE_DISCLAIMER =
  "Accepted by Resend means the email provider took the message. It does not confirm that the message reached an inbox.";

/** Wording never says "delivered" or implies an inbox receipt. */
const BROADCAST_STATE_TEXT = {
  draft: { label: "Draft", tone: "gray", help: "Not queued. Nothing has been sent." },
  queued: { label: "Queued", tone: "blue", help: "Saved for sending. Delivery is pending." },
  processing: { label: "Sending in progress", tone: "blue", help: "Messages are being handed to Resend." },
  completed: { label: "Completed", tone: "green", help: "Finished with no failed or uncertain messages; see counts." },
  completed_with_errors: { label: "Completed with failures", tone: "amber", help: "Some messages were not accepted by Resend." },
  uncertain: { label: "Uncertain outcome", tone: "red", help: "Acceptance of some messages could not be determined. Investigate before sending again." },
  cancelled: { label: "Cancelled", tone: "gray", help: "Every message was cancelled before it was handed to Resend. Nothing was sent." },
};

const DELIVERY_STATE_TEXT = {
  queued: { label: "Queued", tone: "blue" },
  claimed: { label: "Preparing", tone: "blue" },
  sending: { label: "Handing to Resend", tone: "blue" },
  sent: { label: "Resend accepted", tone: "green" },
  failed: { label: "Failed (not accepted)", tone: "red" },
  uncertain: { label: "Uncertain", tone: "red" },
  skipped: { label: "Skipped (recipient inactive)", tone: "gray" },
  cancelled: { label: "Cancelled", tone: "gray" },
};

/** Plain-language meaning of the safe error codes the server stores on a delivery (never raw provider text). */
const ERROR_CODE_TEXT = {
  INVALID_RECIPIENT: "The email provider rejected this recipient address. Check the student's email address.",
  INVALID_MESSAGE: "The message could not be built for this recipient, so it was not sent.",
  TIMEOUT: "The email provider did not answer in time, so it is not known whether the message was accepted.",
  DEADLINE_EXCEEDED: "The email provider did not answer in time, so it is not known whether the message was accepted.",
  CONNECTION_ERROR: "The connection to the email provider failed, so it is not known whether the message was accepted.",
  TRANSPORT_ERROR: "The connection to the email provider failed, so it is not known whether the message was accepted.",
  TRANSPORT_EXCEPTION: "The connection to the email provider failed, so it is not known whether the message was accepted.",
  TRANSPORT_NOT_CONFIGURED: "Email sending is not configured on the server.",
  RATE_LIMITED: "The email provider is limiting how fast messages are accepted.",
  RATE_LIMIT_EXCEEDED: "The email provider is limiting how fast messages are accepted.",
  DAILY_QUOTA_EXCEEDED: "The email provider's sending quota was reached.",
  MONTHLY_QUOTA_EXCEEDED: "The email provider's sending quota was reached.",
  PROVIDER_ERROR: "The email provider reported a problem.",
  APPLICATION_ERROR: "The email provider reported a problem.",
  INTERNAL_SERVER_ERROR: "The email provider reported a problem.",
  CONCURRENT_IDEMPOTENT_REQUESTS: "The provider was still processing an earlier attempt for this message.",
  INTERRUPTED: "Sending was interrupted, so it is not known whether the message was accepted.",
  MALFORMED_SUCCESS: "The provider's answer could not be understood, so it is not known whether the message was accepted.",
  UNEXPECTED_REDIRECT: "The provider's answer could not be understood, so it is not known whether the message was accepted.",
  IDEMPOTENCY_WINDOW_EXPIRED: "The provider can no longer confirm the earlier attempt, so the outcome stays uncertain to avoid sending a duplicate.",
  IDEMPOTENCY_PAYLOAD_CONFLICT: "The provider saw different content under the same send key, so it was not sent again.",
  REQUEST_SNAPSHOT_MISMATCH: "The stored message no longer matches what was queued, so it was not sent.",
  RECIPIENT_INACTIVE: "The student is no longer active, so nothing was sent.",
};

/** Sentence for a delivery's safe error code, or "" when there is no code. State adds the follow-up. */
export function deliveryErrorExplanation(delivery) {
  const code = delivery?.errorCode;
  if (!code) return "";
  const base = ERROR_CODE_TEXT[code] ?? "The email provider could not complete this message.";
  if (delivery.state === "queued") return `${base} It will be retried automatically with the same send key, so the student cannot receive a duplicate email.`;
  if (delivery.state === "failed") return `${base} The provider did not accept it; you can select it and retry.`;
  if (delivery.state === "uncertain") return `${base} It is not retried from here, to avoid a duplicate.`;
  return base;
}

const FIELD_ERROR_KEYS = {
  subject: ["subject", "template"],
  body: ["body", "body_html", "template"],
  bodyHtml: ["body", "body_html", "template"],
  bodyFormat: ["body", "body_html", "template"],
  audienceType: ["audience", "department", "level"],
  department: ["audience", "department", "level"],
  level: ["audience", "department", "level"],
  weekday: ["weekday"],
  localTime: ["local_time"],
  timezone: ["timezone"],
  offsetValue: ["offset_minutes"],
  offsetUnit: ["offset_minutes"],
  categories: ["categories"],
};

/** Field errors without those belonging to the fields in `patch` (an edited field's error is stale). */
export function withoutStaleErrors(errors, patch) {
  const drop = Object.keys(patch).flatMap((key) => FIELD_ERROR_KEYS[key] ?? []);
  if (!drop.some((key) => key in errors)) return errors;
  return Object.fromEntries(Object.entries(errors).filter(([key]) => !drop.includes(key)));
}

const fallbackText = (state) => ({ label: String(state), tone: "gray", help: "" });
export const broadcastStateText = (state) => BROADCAST_STATE_TEXT[state] ?? fallbackText(state);
export const deliveryStateText = (state) => DELIVERY_STATE_TEXT[state] ?? fallbackText(state);

/** Count labels, in display order. "sent" is the D4 state for Resend acceptance. */
export const COUNT_LABELS = [
  ["queued", "queued"],
  ["sent", "Resend accepted"],
  ["failed", "failed"],
  ["uncertain", "uncertain"],
  ["skipped", "skipped"],
  ["cancelled", "cancelled"],
];

const TERMINAL_BROADCAST_STATES = ["completed", "completed_with_errors", "uncertain", "cancelled"];

/** Work is outstanding while the broadcast is queued or processing (not draft or terminal). */
export function isOutstanding(broadcast) {
  if (!broadcast || broadcast.state === "draft") return false;
  if (TERMINAL_BROADCAST_STATES.includes(broadcast.state)) return false;
  return true;
}

/** Server action tokens are authoritative when sent; without them nothing is hidden. */
export const allows = (broadcast, token) => !Array.isArray(broadcast?.eligibleActions) || broadcast.eligibleActions.includes(token);

/** Retry only for known failed, unsent records; never sent/uncertain/skipped. */
export function canRetryDelivery(delivery) {
  if (delivery.state !== "failed") return false;
  if (Array.isArray(delivery.eligibleActions)) return delivery.eligibleActions.includes("retry");
  return true;
}

export function audienceLabel(audience) {
  if (audience?.type === "unknown") return "Unknown audience";
  if (audience?.type === "department") return `Department: ${audience.department || "(none chosen)"}`;
  if (audience?.type === "level") return `Level: ${audience.level ? `${audience.level} level` : "(none chosen)"}`;
  return "All active students";
}

export const EMPTY_FORM = Object.freeze({ subject: "", bodyFormat: "plain", body: "", bodyHtml: "", audienceType: "all", department: "", level: "" });

export function draftToForm(draft) {
  return {
    subject: draft.subject,
    bodyFormat: draft.bodyFormat === "rich" ? "rich" : "plain",
    // Rich: `body` is the server text fallback and `bodyHtml` the canonical HTML.
    body: draft.body,
    bodyHtml: draft.bodyFormat === "rich" ? draft.bodyHtml || plainToHtml(draft.body) : "",
    audienceType: draft.audience.type,
    department: draft.audience.department,
    level: draft.audience.level,
  };
}

/** `persistedFormat` is the saved draft's format; converting rich → plain must say so explicitly. */
export function formToDraft(form, persistedFormat = null) {
  const rich = form.bodyFormat === "rich";
  return {
    subject: form.subject,
    bodyFormat: rich ? "rich" : persistedFormat === "rich" ? "plain" : undefined,
    body: form.body,
    bodyHtml: form.bodyHtml,
    audience: { type: form.audienceType, department: form.department, level: form.level },
  };
}

const hasControlCharacter = (text) => [...text].some((char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127);

/** Client-side checks that mirror the server; the server stays authoritative. */
export function validateForm(form) {
  const errors = {};
  const subject = form.subject.trim();
  if (!subject) errors.subject = ["Enter a subject."];
  else if (subject.length > SUBJECT_MAX_LENGTH) errors.subject = [`Subject must be ${SUBJECT_MAX_LENGTH} characters or fewer.`];
  else if (hasControlCharacter(subject)) errors.subject = ["Subject must be a single line."];
  if (!form.body.trim()) errors.body = ["Enter the message text."];
  if (form.audienceType === "unknown") errors.audience = ["This draft has an unrecognised audience. Choose who should receive it."];
  else if (form.audienceType === "department" && !form.department.trim()) errors.audience = ["Enter a department."];
  else if (form.audienceType === "level" && !LEVELS.includes(form.level)) errors.audience = ["Choose a level."];
  return errors;
}

/** Stable comparison key of what would be saved. */
export const formKey = (form) => JSON.stringify([form.subject.trim(), form.bodyFormat === "rich" ? ["rich", form.bodyHtml] : ["plain", form.body], form.audienceType, form.audienceType === "department" ? form.department.trim() : "", form.audienceType === "level" ? form.level : ""]);

const lagos = new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Lagos", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false });

/** ISO-8601 UTC → "10 Nov 2026, 14:05 (Lagos)". */
export function formatLagos(iso) {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return `${lagos.format(date)} (Lagos)`;
}
