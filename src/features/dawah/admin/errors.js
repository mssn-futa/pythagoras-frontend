import { describeFormError } from "../../auth/formErrors.js";

const FIELD_LABELS = {
  title: "title",
  category: "category",
  speakers: "speakers",
  location: "location",
  start_time: "start time",
  end_time: "end time",
  summary: "summary",
  description: "description",
};

function fieldSummary(fields = {}) {
  return Object.entries(fields)
    .filter(([, messages]) => Array.isArray(messages))
    .map(([name, messages]) => `${FIELD_LABELS[name] ?? name}: ${messages.join(" ")}`)
    .join(" ");
}

/**
 * DAWAH-01 sends `fields.references = {"quiz.quiz": [3]}`, but the shared client
 * flattens nested field values to ["3"], dropping the model name. Handle both
 * shapes so the copy stays useful if the client later keeps the structure.
 */
function referenceSummary(fields = {}) {
  const references = fields.references;
  if (Array.isArray(references)) return references.length ? `reference IDs: ${references.map((id) => `#${id}`).join(", ")}` : "";
  if (!references || typeof references !== "object") return "";
  return Object.entries(references)
    .map(([model, ids]) => `${model} ${[].concat(ids).map((id) => `#${id}`).join(", ")}`)
    .join("; ");
}

/** Friendly copy for the DAWAH-01 / D0 domain state codes; null falls back to the server message. */
const CODE_MESSAGES = {
  INVALID_STATE_TRANSITION: () => "That action is not available in the current state. The page has been refreshed; check the status and try again.",
  EVENT_NOT_PUBLISHABLE: (error) => {
    const details = fieldSummary(error.fields);
    return `This event cannot be published yet. Fix its details first.${details ? ` ${details}` : ""}`;
  },
  EVENT_NOT_PUBLISHED: () => "Publish the event first. A resource can only be published while its event is published.",
  MEDIA_NOT_READY: () => "The audio is not ready yet. Upload it and wait for server validation before publishing (the same applies to a document). For a video, save a valid YouTube link first.",
  UNPUBLISH_REQUIRED: () => "Unpublish this item (and any published resources under it) before deleting it.",
  RESOURCE_REFERENCED: (error) => {
    const refs = referenceSummary(error.fields);
    return `This item is referenced by a quiz, so it cannot be deleted${refs ? ` (${refs})` : ""}. Remove the quiz reference first.`;
  },
  MEDIA_UPLOAD_FAILED: () => "The storage provider is unavailable right now. Nothing was published; try again shortly.",
};

export function adminErrorMessage(error) {
  if (!error) return null;
  const build = CODE_MESSAGES[error.code];
  return build ? build(error) : error.message;
}

/** Alert text and per-field errors for a form; domain codes get friendly copy. */
export function describeAdminError(error, formFields = []) {
  if (!error) return { message: null, fields: {} };
  if (CODE_MESSAGES[error.code]) return { message: adminErrorMessage(error), fields: {} };
  return describeFormError(error, formFields);
}

/** Client-side checks that mirror D2 (end strictly after start). */
export function validateEventValues(values, toUtc) {
  const fields = {};
  if (!values.title.trim()) fields.title = ["Enter a title."];
  const start = toUtc(values.startLocal);
  const end = toUtc(values.endLocal);
  if (!values.startLocal) fields.start_time = ["Choose a start time."];
  else if (!start) fields.start_time = ["Enter a valid start time."];
  if (!values.endLocal) fields.end_time = ["Choose an end time."];
  else if (!end) fields.end_time = ["Enter a valid end time."];
  if (start && end && Date.parse(end) <= Date.parse(start)) fields.end_time = ["End time must be after the start time."];
  return fields;
}
