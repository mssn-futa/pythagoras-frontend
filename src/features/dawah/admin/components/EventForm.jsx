import { useState } from "react";
import { CATEGORY_SUGGESTIONS } from "../constants.js";
import { describeAdminError, validateEventValues } from "../errors.js";
import { toEventFormValues } from "../dawahAdminService.js";
import { lagosLocalToUtcIso } from "../time.js";
import { Alert, Field, primaryButton } from "./ui.jsx";

const FORM_FIELDS = ["title", "category", "tags", "speakers", "location", "start_time", "end_time", "summary", "description"];

/**
 * Create/edit event form. `onSubmit(values)` returns a promise; ApiError
 * rejections map onto fields (400) or the alert (409/503/...).
 */
export default function EventForm({ event, submitLabel, onSubmit, onSaved }) {
  const [values, setValues] = useState(() => toEventFormValues(event));
  const [clientErrors, setClientErrors] = useState({});
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const { message, fields: serverFields } = describeAdminError(error, FORM_FIELDS);
  const fields = { ...serverFields, ...clientErrors };

  const bind = (name) => ({
    value: values[name],
    onChange: (changeEvent) => {
      setSaved(false);
      setValues((current) => ({ ...current, [name]: changeEvent.target.value }));
    },
  });

  const handleSubmit = async (submitEvent) => {
    submitEvent.preventDefault();
    setSaved(false);
    setError(null);
    const problems = validateEventValues(values, lagosLocalToUtcIso);
    setClientErrors(problems);
    if (Object.keys(problems).length) return;
    setSaving(true);
    try {
      const result = await onSubmit(values);
      setSaved(true);
      onSaved?.(result);
    } catch (caught) {
      setError(caught);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4" aria-label="Event details">
      <Alert>{message}</Alert>
      {saved && <Alert tone="success">Event saved.</Alert>}
      <Field label="Title" name="title" maxLength={200} required {...bind("title")} errors={fields.title} />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Field label="Category" name="category" list="dawah-category-options" {...bind("category")} errors={fields.category} />
          <datalist id="dawah-category-options">
            {CATEGORY_SUGGESTIONS.map((category) => <option key={category} value={category} />)}
          </datalist>
        </div>
        <Field label="Tags" hint="(comma separated)" name="tags" {...bind("tags")} errors={fields.tags} />
        <Field label="Speakers" name="speakers" {...bind("speakers")} errors={fields.speakers} />
        <Field label="Location" name="location" {...bind("location")} errors={fields.location} />
        <Field label="Starts" hint="(Lagos time)" type="datetime-local" name="start_time" required {...bind("startLocal")} errors={fields.start_time} />
        <Field label="Ends" hint="(Lagos time)" type="datetime-local" name="end_time" required {...bind("endLocal")} errors={fields.end_time} />
      </div>
      <Field label="Summary" as="textarea" rows={2} name="summary" {...bind("summary")} errors={fields.summary} />
      <Field label="Description" as="textarea" rows={5} name="description" {...bind("description")} errors={fields.description} />
      <button type="submit" disabled={saving} className={primaryButton}>
        {saving ? "Saving…" : submitLabel}
      </button>
    </form>
  );
}
