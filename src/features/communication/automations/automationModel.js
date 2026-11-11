import { LEVELS, formatLagos } from "../model.js";

/*
 * Automation rule/run presentation model (D4 "Automated summaries and event reminders").
 * Wording rule: a saved or enabled rule is never presented as proof that mail was sent;
 * only run history (real worker output) says what happened.
 */

export const TIMEZONE = "Africa/Lagos";
export const TIMEZONE_LABEL = "Africa/Lagos (West Africa Time, UTC+1, no daylight saving)";
export const KINDS = ["weekly_digest", "event_reminder"];
export const KIND_LABELS = { weekly_digest: "Weekly summary", event_reminder: "Event reminder" };
export const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]; // index = wire weekday (0 = Monday)

// ASSUMPTION: only "jumuah" appears in D2/D4 examples; the other tokens follow the D4 event list.
export const CATEGORIES = [
  ["dawah_night", "Da’wah Night"],
  ["usroh", "Usroh"],
  ["special_lecture", "Special lecture"],
  ["jumuah", "Jumu’ah"],
];

/** Documented placeholders (ASSUMPTION: D4 says "documented placeholder substitution only" without listing them). */
export const PLACEHOLDERS = {
  weekly_digest: [
    ["week_start", "First day of the summary window (previous seven days), in Lagos time"],
    ["week_end", "Scheduled occurrence the window ends at, in Lagos time"],
    ["summary_count", "Number of events with authored summaries in the window"],
    ["summaries", "The collated event summaries and resource links"],
  ],
  event_reminder: [
    ["event_title", "Title of the event"],
    ["event_start", "Event start, in Lagos time"],
    ["event_location", "Event location"],
    ["event_summary", "Authored event summary"],
    ["event_url", "Link to the event"],
  ],
};

export const RULE_POLL_STATES = ["pending", "queued", "processing"];

const TONE_RULE = {
  disabled: { label: "Disabled", tone: "gray", help: "Not creating runs. Nothing is scheduled to send." },
  enabled: { label: "Enabled", tone: "green", help: "The worker may create runs on this schedule. Enabled is not proof that anything ran: check run history for what actually happened." },
  blocked: { label: "Blocked: owner inactive", tone: "amber", help: "The rule owner is no longer an active admin, so no new runs are created until the rule is reassigned." },
};

/** Rule status for display. A blocked owner outranks "enabled": the rule is not operational. */
export function ruleStatus(rule) {
  if (rule.blockedReason || rule.ownerActive === false) return { key: "blocked", ...TONE_RULE.blocked };
  return rule.enabled ? { key: "enabled", ...TONE_RULE.enabled } : { key: "disabled", ...TONE_RULE.disabled };
}

const RUN_STATE_TEXT = {
  pending: { label: "Being prepared", tone: "blue", help: "The occurrence was found due and is being materialized. No mail has been handed off yet." },
  queued: { label: "Queued", tone: "blue", help: "A broadcast was created for this occurrence. Delivery is pending; nothing is confirmed yet." },
  processing: { label: "Sending in progress", tone: "blue", help: "Messages are being handed to Resend." },
  completed: { label: "Completed", tone: "green", help: "Finished with no failed or uncertain messages; see counts." },
  completed_with_errors: { label: "Completed with failures", tone: "amber", help: "Some recipients were not accepted by Resend; see the broadcast for per-recipient outcomes." },
  failed: { label: "Failed", tone: "red", help: "This occurrence failed. See the reason code and, when a broadcast exists, its per-recipient outcomes." },
  uncertain: { label: "Uncertain delivery", tone: "red", help: "Whether the provider accepted some mail could not be determined. Investigate before any resend; do not assume it was or was not sent." },
  skipped: { label: "Skipped (nothing sent)", tone: "gray", help: "The run was recorded but no email was created." },
  missed: { label: "Missed (not sent)", tone: "amber", help: "The occurrence was not processed inside its catch-up window and was not replayed." },
  cancelled: { label: "Cancelled", tone: "gray", help: "Unsent mail for this occurrence was cancelled. Mail already handed to the provider is not recalled." },
  blocked: { label: "Blocked: owner", tone: "amber", help: "The rule owner was not an active admin, so this occurrence was not created." },
};

const PROVIDER_REASONS = ["provider_failure"];
const PROVIDER_FAILED_HELP = "The email provider did not accept this occurrence's mail. Open the broadcast for the safe error codes.";

/** Provider wording is used for a failed run only when its reason code says the provider was the cause. */
export const runStateText = (state, reasonCode = null) =>
  state === "failed" && PROVIDER_REASONS.includes(reasonCode)
    ? { ...RUN_STATE_TEXT.failed, help: PROVIDER_FAILED_HELP }
    : RUN_STATE_TEXT[state] ?? { label: `Unrecognised state: ${state}`, tone: "gray", help: "This state is not known to this page. Nothing is assumed about whether mail was sent." };

// Reason codes emitted by the backend (docs/communication-automations.md); unknown codes are shown verbatim.
const REASON_TEXT = {
  no_eligible_summaries: "No published event in the window had an authored summary, so no email was created.",
  no_recipients: "The audience had no active recipients, so no email was created.",
  missed_catch_up_window: "A later occurrence took over; this one was outside the catch-up window and was not replayed.",
  reminder_grace_elapsed: "The reminder's catch-up grace passed, or the event had started; stale reminders are never sent.",
  source_unpublished: "The source event was unpublished or closed before the reminder was sent.",
  source_rescheduled: "The event's time changed, so this reminder became obsolete.",
  rule_disabled: "The rule was disabled before this occurrence was created.",
  owner_inactive: "The rule owner is inactive or not an admin. Reassign the rule to resume runs.",
  provider_failure: "The email provider failed to accept the mail.",
  delivery_uncertain: "Provider acceptance could not be determined, and a blind resend is not allowed.",
  superseded_after_handoff: "An earlier version of this reminder was already handed to the provider, so the change was not re-sent. Send a correction as a broadcast if needed.",
  content_invalid: "The composed message failed the email checks (for example it is too large), so no email was created.",
  window_overlap: "The schedule changed and this window overlaps one that was already sent, so it was skipped.",
  materialize_error: "Creating this occurrence failed repeatedly, so it was recorded as failed. Check the server logs.",
  no_upcoming_event: "No upcoming published event matches this rule yet.",
};

export const reasonText = (code) => (code ? REASON_TEXT[code] ?? null : null);

/** Run is waiting on the worker or on delivery; poll only while some run is in one of these states. */
export const isRunOutstanding = (run) => RULE_POLL_STATES.includes(run?.state);

export function scheduleSummary(rule) {
  if (rule.kind === "weekly_digest") {
    return `${WEEKDAYS[rule.weekday] ?? "Unknown day"} at ${rule.localTime || "—"} (${rule.timezone || TIMEZONE})`;
  }
  if (rule.kind !== "event_reminder") return "Unknown schedule";
  return `${offsetLabel(rule.offsetMinutes)} before the event starts`;
}

export function offsetLabel(minutes) {
  if (!Number.isInteger(minutes) || minutes <= 0) return "Unknown offset";
  const plural = (n, unit) => `${n} ${unit}${n === 1 ? "" : "s"}`;
  if (minutes % 1440 === 0) return plural(minutes / 1440, "day");
  if (minutes % 60 === 0) return plural(minutes / 60, "hour");
  return plural(minutes, "minute");
}

const UNIT_MINUTES = { minutes: 1, hours: 60, days: 1440 };
export const OFFSET_UNITS = ["minutes", "hours", "days"];

export function minutesToOffset(minutes) {
  if (!Number.isInteger(minutes) || minutes <= 0) return { value: "", unit: "hours" };
  if (minutes % 1440 === 0) return { value: String(minutes / 1440), unit: "days" };
  if (minutes % 60 === 0) return { value: String(minutes / 60), unit: "hours" };
  return { value: String(minutes), unit: "minutes" };
}

/** Whole-number offset → minutes, or null when it is not a positive whole number. */
export function offsetToMinutes(value, unit) {
  const text = String(value).trim();
  if (!/^\d+$/.test(text)) return null;
  const minutes = Number(text) * (UNIT_MINUTES[unit] ?? NaN);
  return Number.isSafeInteger(minutes) && minutes > 0 ? minutes : null;
}

export const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
/** "08:00:00" → "08:00"; anything else is returned unchanged for validation to reject. */
export const normalizeLocalTime = (value) => (/^\d\d:\d\d:\d\d$/.test(String(value ?? "")) ? String(value).slice(0, 5) : String(value ?? ""));

export const EMPTY_RULE_FORM = Object.freeze({
  kind: "weekly_digest",
  subject: "",
  bodyFormat: "plain",
  body: "",
  bodyHtml: "",
  audienceType: "all",
  department: "",
  level: "",
  categories: [],
  weekday: "0",
  localTime: "08:00", // D4 weekly default: Monday 08:00 Africa/Lagos
  offsetValue: "24",
  offsetUnit: "hours", // D4 reminder default: 24 hours before
  timezone: TIMEZONE,
});

export function ruleToForm(rule) {
  const offset = minutesToOffset(rule.offsetMinutes);
  const rich = rule.template.bodyFormat === "rich";
  return {
    kind: rule.kind,
    subject: rule.template.subject,
    bodyFormat: rich ? "rich" : "plain",
    body: rule.template.body,
    bodyHtml: rich ? rule.template.bodyHtml : "",
    audienceType: rule.audience.type,
    department: rule.audience.department,
    level: rule.audience.level,
    categories: [...rule.categories],
    // The stored zone is carried as-is so an unsupported one is shown and never silently replaced on save.
    timezone: rule.timezone || TIMEZONE,
    weekday: rule.weekday == null ? "0" : String(rule.weekday),
    localTime: rule.localTime || "08:00",
    offsetValue: offset.value || "24",
    offsetUnit: offset.value ? offset.unit : "hours",
  };
}

/** Form → rule draft (service input). Only fields of the chosen kind are carried. */
export function formToDraft(form) {
  const draft = {
    kind: form.kind,
    audience: { type: form.audienceType, department: form.department, level: form.level },
    categories: [...form.categories],
    template: { subject: form.subject, bodyFormat: form.bodyFormat === "rich" ? "rich" : "plain", body: form.body, bodyHtml: form.bodyHtml },
  };
  if (form.kind === "weekly_digest") Object.assign(draft, { timezone: form.timezone, weekday: Number(form.weekday), localTime: form.localTime });
  else draft.offsetMinutes = offsetToMinutes(form.offsetValue, form.offsetUnit);
  return draft;
}

export const ruleFormKey = (form) =>
  JSON.stringify([
    form.kind,
    form.subject.trim(),
    form.bodyFormat === "rich" ? ["rich", form.bodyHtml] : ["plain", form.body],
    form.audienceType,
    form.audienceType === "department" ? form.department.trim() : "",
    form.audienceType === "level" ? form.level : "",
    [...form.categories].sort(),
    form.kind === "weekly_digest" ? [form.weekday, form.localTime, form.timezone] : [form.offsetValue.trim(), form.offsetUnit],
  ]);

/** Names inside {{ ... }}; `invalid` lists anything that is template code rather than a plain placeholder. */
export function scanPlaceholders(text) {
  const names = [];
  const invalid = [];
  const source = String(text ?? "");
  for (const match of source.matchAll(/\{\{([\s\S]*?)\}\}/g)) {
    const name = match[1].trim();
    if (/^[a-z_][a-z0-9_]*$/.test(name)) names.push(name);
    else invalid.push(match[0]);
  }
  if (/\{%|%\}|\{#|#\}/.test(source)) invalid.push("{% … %}");
  return { names, invalid };
}

const hasControlCharacter = (text) => [...text].some((char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127);

/** Client checks mirroring D4; the server stays authoritative. Returns { field: [messages] }. */
export function validateRuleForm(form) {
  const errors = {};
  const subject = form.subject.trim();
  if (!subject) errors.subject = ["Enter a subject."];
  else if (subject.length > 200) errors.subject = ["Subject must be 200 characters or fewer."];
  else if (hasControlCharacter(subject)) errors.subject = ["Subject must be a single line."];

  const bodyText = form.bodyFormat === "rich" ? form.bodyHtml : form.body;
  if (!form.body.trim()) errors.body = ["Enter the message template."];

  const allowed = new Set((PLACEHOLDERS[form.kind] ?? []).map(([name]) => name));
  const problems = [];
  for (const text of [form.subject, bodyText]) {
    const { names, invalid } = scanPlaceholders(text);
    for (const name of names) if (!allowed.has(name)) problems.push(`{{${name}}} is not a documented placeholder for this rule type.`);
    for (const token of invalid) problems.push(`${token} is not allowed: templates support documented placeholders only, not template code.`);
  }
  if (problems.length) errors.template = [...new Set(problems)];

  if (form.audienceType === "unknown") errors.audience = ["This rule has an unrecognised audience. Choose who should receive it."];
  else if (form.audienceType === "department" && !form.department.trim()) errors.audience = ["Enter a department."];
  else if (form.audienceType === "level" && !LEVELS.includes(form.level)) errors.audience = ["Choose a level."];

  if (form.kind === "weekly_digest") {
    if (form.timezone !== TIMEZONE) errors.timezone = [`This rule is stored with time zone ${form.timezone}, which this page cannot confirm. Change it to ${TIMEZONE} explicitly before saving.`];
    if (!/^[0-6]$/.test(form.weekday)) errors.weekday = ["Choose a day of the week."];
    if (!TIME_PATTERN.test(form.localTime)) errors.local_time = ["Enter a time as HH:MM (24-hour), for example 08:00."];
  } else {
    if (offsetToMinutes(form.offsetValue, form.offsetUnit) == null) errors.offset_minutes = ["Enter a whole number greater than zero."];
    if (!form.categories.length) errors.categories = ["Choose at least one event category."];
  }
  return errors;
}

/** Window labels in Lagos time. */
export const formatWindow = (start, end) => `${formatLagos(start)} to ${formatLagos(end)}`;
