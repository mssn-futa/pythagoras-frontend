import { LEVEL_OPTIONS } from "../../services/api/authService.js";

export const POLL_INTERVAL_MS = 5000;
export const POLL_MAX_POLLS = 60; // 5 minutes of automatic refresh, then a manual refresh is offered.
export const POLL_MAX_FAILURES = 3;
export const SUBJECT_MAX_LENGTH = 200;
export const LEVELS = LEVEL_OPTIONS;

export const BROADCAST_STATES = ["queued", "processing", "completed", "completed_with_errors", "uncertain"];
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

const TERMINAL_BROADCAST_STATES = ["completed", "completed_with_errors", "uncertain"];

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

export const EMPTY_FORM = Object.freeze({ subject: "", body: "", audienceType: "all", department: "", level: "" });

export function draftToForm(draft) {
  return {
    subject: draft.subject,
    body: draft.body,
    audienceType: draft.audience.type,
    department: draft.audience.department,
    level: draft.audience.level,
  };
}

export function formToDraft(form) {
  return {
    subject: form.subject,
    body: form.body,
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
export const formKey = (form) => JSON.stringify([form.subject.trim(), form.body, form.audienceType, form.audienceType === "department" ? form.department.trim() : "", form.audienceType === "level" ? form.level : ""]);

const lagos = new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Lagos", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false });

/** ISO-8601 UTC → "10 Nov 2026, 14:05 (Lagos)". */
export function formatLagos(iso) {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return `${lagos.format(date)} (Lagos)`;
}
