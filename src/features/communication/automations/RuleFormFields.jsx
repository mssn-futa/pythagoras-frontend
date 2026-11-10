import { useEffect, useId, useRef, useState } from "react";
import { inputClass } from "../../auth/components/FormControls.jsx";
import AudienceSelector from "../components/AudienceSelector.jsx";
import { secondaryButton } from "../components/common.jsx";
import EditorLoader from "../editor/EditorLoader.jsx";
import { hasRichFormatting, plainConversionCollapsesWhitespace, plainToHtml } from "../editor/richContent.js";
import { CATEGORIES, KIND_LABELS, KINDS, OFFSET_UNITS, PLACEHOLDERS, TIMEZONE, TIMEZONE_LABEL, WEEKDAYS } from "./automationModel.js";

const labelClass = "mb-1 block text-sm font-medium text-[#4B5563] dark:text-gray-300";
const amberBox = "rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200";

function Err({ id, errors }) {
  if (!errors?.length) return null;
  return (
    <p id={id} className="mt-1 text-xs text-red-600 dark:text-red-400">
      {errors.join(" ")}
    </p>
  );
}

/**
 * Rule fields: kind (create only), audience, categories, schedule (weekly day/time with the timezone stated,
 * or reminder offset), and the template (rich editor or plain text, documented placeholders only).
 * `onChange(patch)` merges into the form; `editorEpoch` remounts the rich editor to load canonical content.
 */
export default function RuleFormFields({ form, onChange, errors, disabled, kindLocked, editorEpoch, onEditorReset }) {
  const id = useId();
  const [confirmingPlain, setConfirmingPlain] = useState(false);
  const [warning, setWarning] = useState(null);
  const confirmRef = useRef(null);
  const weekly = form.kind === "weekly_digest";
  const rich = form.bodyFormat === "rich";
  const bodyErrors = errors.body || errors.body_html ? [...(errors.body ?? []), ...(errors.body_html ?? [])] : undefined;
  const audienceErrors = [...(errors.audience ?? []), ...(errors.department ?? []), ...(errors.level ?? [])];

  useEffect(() => {
    if (confirmingPlain) confirmRef.current?.focus();
  }, [confirmingPlain]);

  const switchTo = (format) => {
    setConfirmingPlain(false);
    setWarning(null);
    if (format === form.bodyFormat) return;
    if (format === "rich") {
      onChange({ bodyFormat: "rich", bodyHtml: plainToHtml(form.body) });
      onEditorReset();
      if (plainConversionCollapsesWhitespace(form.body)) setWarning("Extra spaces and repeated blank lines in your plain text were collapsed in the editor. Review the text before saving.");
    } else if (hasRichFormatting(form.bodyHtml) && !confirmingPlain) {
      setConfirmingPlain(true);
    } else {
      onChange({ bodyFormat: "plain", bodyHtml: "" });
    }
  };

  const toggleCategory = (token) =>
    onChange({ categories: form.categories.includes(token) ? form.categories.filter((item) => item !== token) : [...form.categories, token] });

  return (
    <div className="space-y-5">
      <fieldset disabled={disabled || kindLocked} className="min-w-0">
        <legend className={labelClass}>Rule type</legend>
        <div className="flex flex-col gap-2 sm:flex-row sm:gap-6">
          {KINDS.map((kind) => (
            <label key={kind} className="flex items-center gap-2 text-sm text-[#1F2937] dark:text-gray-100">
              <input type="radio" name={`${id}-kind`} value={kind} checked={form.kind === kind} onChange={() => onChange({ kind })} className="h-4 w-4 accent-[#2A742F]" />
              {KIND_LABELS[kind]}
            </label>
          ))}
        </div>
        {kindLocked && <p className="mt-1 text-xs text-gray-500">The rule type cannot be changed after the rule is created.</p>}
      </fieldset>

      <AudienceSelector value={form} errors={audienceErrors.length ? audienceErrors : undefined} onChange={(next) => onChange(next)} disabled={disabled} />

      <fieldset disabled={disabled} className="min-w-0" aria-describedby={errors.categories ? `${id}-categories-error` : undefined}>
        <legend className={labelClass}>Event categories{weekly ? " (optional)" : ""}</legend>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:gap-4">
          {CATEGORIES.map(([token, label]) => (
            <label key={token} className="flex items-center gap-2 text-sm text-[#1F2937] dark:text-gray-100">
              <input type="checkbox" checked={form.categories.includes(token)} onChange={() => toggleCategory(token)} className="h-4 w-4 accent-[#2A742F]" />
              {label}
            </label>
          ))}
        </div>
        <p className="mt-1 text-xs text-gray-500">
          {weekly ? "Leave empty to let the server apply its default categories; the preview shows what would be included." : "Reminders are only created for published events in these categories."}
        </p>
        <Err id={`${id}-categories-error`} errors={errors.categories} />
      </fieldset>

      {weekly ? (
        <fieldset disabled={disabled} className="min-w-0">
          <legend className={labelClass}>Schedule</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor={`${id}-weekday`} className={labelClass}>Day of the week</label>
              <select id={`${id}-weekday`} className={inputClass} value={form.weekday} onChange={(event) => onChange({ weekday: event.target.value })} aria-invalid={errors.weekday ? true : undefined}>
                {WEEKDAYS.map((name, index) => (
                  <option key={name} value={String(index)}>{name}</option>
                ))}
              </select>
              <Err errors={errors.weekday} />
            </div>
            <div>
              <label htmlFor={`${id}-time`} className={labelClass}>Local time (24-hour)</label>
              <input id={`${id}-time`} type="time" step="60" className={inputClass} value={form.localTime} onChange={(event) => onChange({ localTime: event.target.value })} aria-invalid={errors.local_time ? true : undefined} aria-describedby={errors.local_time ? `${id}-time-error` : undefined} />
              <Err id={`${id}-time-error`} errors={errors.local_time} />
            </div>
          </div>
          <p className="mt-2 text-sm text-gray-700 dark:text-gray-200" data-testid="timezone-note">
            Time zone: <strong>{TIMEZONE_LABEL}</strong>. Every occurrence is scheduled in {TIMEZONE} time, whatever your device's clock says. The summary covers the seven days before the occurrence.
          </p>
          <Err errors={errors.timezone} />
        </fieldset>
      ) : (
        <fieldset disabled={disabled} className="min-w-0">
          <legend className={labelClass}>Reminder timing</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor={`${id}-offset`} className={labelClass}>Send before the event starts</label>
              <input id={`${id}-offset`} inputMode="numeric" className={inputClass} value={form.offsetValue} onChange={(event) => onChange({ offsetValue: event.target.value })} aria-invalid={errors.offset_minutes ? true : undefined} aria-describedby={errors.offset_minutes ? `${id}-offset-error` : undefined} />
              <Err id={`${id}-offset-error`} errors={errors.offset_minutes} />
            </div>
            <div>
              <label htmlFor={`${id}-unit`} className={labelClass}>Unit</label>
              <select id={`${id}-unit`} className={inputClass} value={form.offsetUnit} onChange={(event) => onChange({ offsetUnit: event.target.value })}>
                {OFFSET_UNITS.map((unit) => (
                  <option key={unit} value={unit}>{unit}</option>
                ))}
              </select>
            </div>
          </div>
          <p className="mt-2 text-xs text-gray-500">Reminders are never sent after the event starts. If the event time changes or it is unpublished, unsent reminders are cancelled and recalculated. Times are shown in {TIMEZONE}.</p>
        </fieldset>
      )}

      <div className="space-y-4 rounded-lg border border-gray-200 p-4 dark:border-gray-700">
        <h3 className="text-base font-semibold text-[#1F2937] dark:text-white">Email template</h3>
        <div>
          <label htmlFor={`${id}-subject`} className={labelClass}>Subject</label>
          <input id={`${id}-subject`} className={inputClass} value={form.subject} maxLength={250} disabled={disabled} onChange={(event) => onChange({ subject: event.target.value })} aria-invalid={errors.subject ? true : undefined} aria-describedby={errors.subject ? `${id}-subject-error` : undefined} />
          <Err id={`${id}-subject-error`} errors={errors.subject} />
        </div>
        <fieldset disabled={disabled} className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <legend className={labelClass}>Message format</legend>
          {[["plain", "Plain text"], ["rich", "Rich text"]].map(([value, label]) => (
            <label key={value} className="flex items-center gap-2 text-sm text-[#1F2937] dark:text-gray-100">
              <input type="radio" name={`${id}-format`} value={value} checked={form.bodyFormat === value} onChange={() => switchTo(value)} className="h-4 w-4 accent-[#2A742F]" />
              {label}
            </label>
          ))}
        </fieldset>
        {confirmingPlain && (
          <div ref={confirmRef} tabIndex={-1} role="alertdialog" aria-labelledby={`${id}-plain-title`} className={amberBox}>
            <p id={`${id}-plain-title`} className="font-medium">Switch to plain text?</p>
            <p className="mt-1">Bold, italics, headings, lists, quotes and links will be removed. Nothing changes on the server until you save.</p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <button type="button" className={secondaryButton} onClick={() => { setConfirmingPlain(false); onChange({ bodyFormat: "plain", bodyHtml: "" }); }}>Remove formatting</button>
              <button type="button" className={secondaryButton} onClick={() => setConfirmingPlain(false)}>Keep rich text</button>
            </div>
          </div>
        )}
        {warning && <p role="status" className={amberBox}>{warning}</p>}
        {rich ? (
          <div>
            <p id={`${id}-body-label`} className={labelClass}>Message template (rich text)</p>
            <EditorLoader
              key={editorEpoch}
              id={`${id}-body`}
              value={form.bodyHtml}
              onChange={({ html, text }) => onChange({ bodyHtml: html, body: text })}
              labelledBy={`${id}-body-label`}
              invalid={Boolean(bodyErrors)}
              describedBy={bodyErrors ? `${id}-body-error` : undefined}
              disabled={disabled}
            />
            <Err id={`${id}-body-error`} errors={bodyErrors} />
            <p className="mt-1 text-xs text-gray-500">Only paragraphs, bold, italics, headings, lists, quotes and http/https links are kept.</p>
          </div>
        ) : (
          <div>
            <label htmlFor={`${id}-body`} className={labelClass}>Message template (plain text)</label>
            <textarea id={`${id}-body`} className={`${inputClass} min-h-40`} rows={7} value={form.body} disabled={disabled} onChange={(event) => onChange({ body: event.target.value })} aria-invalid={bodyErrors ? true : undefined} aria-describedby={bodyErrors ? `${id}-body-error` : undefined} />
            <Err id={`${id}-body-error`} errors={bodyErrors} />
          </div>
        )}
        <Err errors={errors.template} />
        <details className="text-sm text-gray-700 dark:text-gray-200" open>
          <summary className="cursor-pointer font-medium">Documented placeholders</summary>
          <p className="mt-1 text-xs text-gray-500">Only these placeholders are substituted when a run is created. Templates are never executed as code; anything else is rejected.</p>
          <ul className="mt-2 space-y-1">
            {PLACEHOLDERS[form.kind].map(([name, help]) => (
              <li key={name}>
                <code className="rounded bg-gray-100 px-1.5 py-0.5 text-xs dark:bg-gray-700">{`{{${name}}}`}</code> <span className="text-xs text-gray-600 dark:text-gray-300">{help}</span>
              </li>
            ))}
          </ul>
        </details>
      </div>
    </div>
  );
}
