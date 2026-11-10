import { describeFormError } from "../../auth/formErrors.js";

/** Friendly copy for the D2/D0 domain state codes; falls back to the server message. */
const CODE_MESSAGES = {
  RESOURCE_REFERENCED: "This item is referenced by a quiz, so it cannot be deleted. Remove the quiz reference first.",
  MEDIA_NOT_READY: "The audio is not ready yet. Upload it and wait for server validation before publishing.",
  MEDIA_UPLOAD_FAILED: "The storage provider is unavailable right now. Nothing was published; try again shortly.",
};

export function adminErrorMessage(error) {
  if (!error) return null;
  return CODE_MESSAGES[error.code] ?? error.message;
}

/** Alert text and per-field errors for a form; domain codes get friendly copy. */
export function describeAdminError(error, formFields = []) {
  if (!error) return { message: null, fields: {} };
  const described = describeFormError(error, formFields);
  return CODE_MESSAGES[error.code] ? { ...described, message: CODE_MESSAGES[error.code] } : described;
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
