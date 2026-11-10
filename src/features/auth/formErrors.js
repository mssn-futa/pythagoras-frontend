/**
 * Splits a normalized ApiError into an alert message and per-field errors for
 * the fields a form actually renders. Errors for fields the form does not show
 * (e.g. non_field_errors) are appended to the alert so none are lost.
 */
export function describeFormError(error, formFields = []) {
  if (!error) return { message: null, fields: {} };
  const fields = {};
  const extra = [];
  for (const [name, messages] of Object.entries(error.fields ?? {})) {
    if (formFields.includes(name)) fields[name] = messages;
    else extra.push(...messages);
  }
  const base = extra.length && !Object.keys(fields).length ? null : error.message;
  const message = [base, ...extra].filter(Boolean).join(" ") || error.message;
  return { message, fields };
}
