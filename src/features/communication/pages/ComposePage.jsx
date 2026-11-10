import { useCallback, useEffect, useId, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { FormAlert, FormNotice, inputClass } from "../../auth/components/FormControls.jsx";
import { describeFormError } from "../../auth/formErrors.js";
import { createDraft, getBroadcast, previewBroadcast, queueBroadcast, updateDraft } from "../api/broadcastsApi.js";
import AudienceSelector from "../components/AudienceSelector.jsx";
import { cardClass, LoadingLine, PageError, primaryButton, secondaryButton } from "../components/common.jsx";
import QueueConfirmDialog from "../components/QueueConfirmDialog.jsx";
import { allows, audienceLabel, draftToForm, EMPTY_FORM, formKey, formToDraft, validateForm } from "../model.js";

const FORM_FIELDS = ["subject", "body", "audience", "department", "level"];
const VERSION_CONFLICT = "BROADCAST_VERSION_CONFLICT";
const ALREADY_QUEUED = "BROADCAST_ALREADY_QUEUED";

/** Server field errors for the audience selector may arrive as audience, department or level. */
function audienceErrors(fields) {
  const all = [...(fields.audience ?? []), ...(fields.department ?? []), ...(fields.level ?? [])];
  return all.length ? all : undefined;
}

function Field({ label, errors, children, htmlFor }) {
  const message = errors?.length ? errors.join(" ") : null;
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1 block text-sm font-medium text-[#4B5563] dark:text-gray-300">
        {label}
      </label>
      {children}
      {message && (
        <p id={`${htmlFor}-error`} className="mt-1 text-xs text-red-600 dark:text-red-400">
          {message}
        </p>
      )}
    </div>
  );
}

function Preview({ preview }) {
  return (
    <section aria-labelledby="preview-heading" className={cardClass}>
      <h2 id="preview-heading" className="text-lg font-semibold text-[#1F2937] dark:text-white">
        Preview
      </h2>
      <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
        {preview.audienceCount == null
          ? "Recipient estimate unavailable."
          : `About ${preview.audienceCount} ${preview.audienceCount === 1 ? "recipient" : "recipients"} would receive this today. This is an estimate; the final list is fixed only when you queue.`}
      </p>
      <p className="mt-4 text-xs font-medium uppercase tracking-wide text-gray-500">Subject</p>
      <p data-testid="preview-subject" className="break-words text-[#1F2937] dark:text-white">{preview.subject}</p>
      <p className="mt-4 text-xs font-medium uppercase tracking-wide text-gray-500">Message (plain text)</p>
      <pre data-testid="preview-body" className="mt-1 whitespace-pre-wrap break-words rounded-lg bg-gray-50 p-3 font-sans text-sm text-[#1F2937] dark:bg-gray-900 dark:text-gray-100">
        {preview.renderedText ?? preview.body}
      </pre>
    </section>
  );
}

function Editor({ id }) {
  const formId = useId();
  const navigate = useNavigate();
  const location = useLocation();
  const [status, setStatus] = useState(id ? "loading" : "ready");
  const [loadError, setLoadError] = useState(null);
  const [draft, setDraft] = useState(null); // persisted broadcast (id/version/state)
  const [form, setForm] = useState(EMPTY_FORM);
  const [baseline, setBaseline] = useState(formKey(EMPTY_FORM));
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState(null);
  const [conflict, setConflict] = useState(false);
  const [notice, setNotice] = useState(location.state?.saved ? "Draft saved." : null);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState(null); // { version, data }
  const [previewing, setPreviewing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [queueing, setQueueing] = useState(false);
  const [queueError, setQueueError] = useState(null);

  const adopt = useCallback((broadcast) => {
    const next = draftToForm(broadcast);
    setDraft(broadcast);
    setForm(next);
    setBaseline(formKey(next));
  }, []);

  const load = useCallback(async () => {
    setStatus("loading");
    setLoadError(null);
    try {
      adopt(await getBroadcast(id));
      setStatus("ready");
    } catch (caught) {
      setLoadError(caught);
      setStatus("error");
    }
  }, [id, adopt]);

  useEffect(() => {
    if (id) load();
  }, [id, load]);

  const dirty = formKey(form) !== baseline;
  const set = (patch) => {
    setForm((current) => ({ ...current, ...patch }));
    setNotice(null);
  };

  const failWith = (caught) => {
    const { message, fields } = describeFormError(caught, FORM_FIELDS);
    setFieldErrors(fields);
    setError(message);
  };

  const save = async (event) => {
    event.preventDefault();
    setNotice(null);
    setError(null);
    const errors = validateForm(form);
    setFieldErrors(errors);
    if (Object.keys(errors).length) return;
    setSaving(true);
    try {
      if (draft) {
        const saved = await updateDraft(draft.id, formToDraft(form), draft.version);
        adopt(saved);
        setNotice("Draft saved.");
      } else {
        const created = await createDraft(formToDraft(form));
        navigate(`/admin/communication/drafts/${created.id}`, { replace: true, state: { saved: true } });
      }
    } catch (caught) {
      if (caught?.code === VERSION_CONFLICT) setConflict(true);
      else failWith(caught);
    } finally {
      setSaving(false);
    }
  };

  const reload = async () => {
    setError(null);
    try {
      adopt(await getBroadcast(draft.id));
      setConflict(false);
      setPreview(null);
      setFieldErrors({});
      setNotice("Reloaded the latest saved version.");
    } catch (caught) {
      failWith(caught);
    }
  };

  const runPreview = async () => {
    setError(null);
    setPreviewing(true);
    try {
      setPreview({ version: draft.version, data: await previewBroadcast(draft.id, draft.version) });
    } catch (caught) {
      if (caught?.code === VERSION_CONFLICT) {
        setConflict(true);
        setPreview(null);
      } else failWith(caught);
    } finally {
      setPreviewing(false);
    }
  };

  const confirmQueue = async () => {
    setQueueError(null);
    setQueueing(true);
    try {
      const acknowledged = await queueBroadcast(draft.id, draft.version);
      navigate(`/admin/communication/history/${acknowledged.id}`, { state: { queued: true } });
    } catch (caught) {
      if (caught?.code === VERSION_CONFLICT) {
        setConfirming(false);
        setConflict(true);
      } else if (caught?.code === ALREADY_QUEUED) {
        navigate(`/admin/communication/history/${draft.id}`, { state: { alreadyQueued: true } });
      } else {
        setQueueError(describeFormError(caught, []).message);
      }
    } finally {
      setQueueing(false);
    }
  };

  if (status === "loading") return <LoadingLine>Loading draft…</LoadingLine>;
  if (status === "error") return <PageError error={loadError} onRetry={load} />;
  if (draft && draft.state === "draft" && draft.bodyFormat === "rich") {
    // Rich drafts are never opened in the plain editor: saving here would flatten them.
    return (
      <div className={`${cardClass} space-y-3`}>
        <h2 className="text-lg font-semibold text-[#1F2937] dark:text-white">Draft #{draft.id} is a rich-text draft</h2>
        <p role="status" className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          This draft uses rich formatting. Edit it in the rich editor; it cannot be edited or saved from this plain-text form.
        </p>
        <dl className="space-y-2 text-sm">
          <div><dt className="font-medium">Subject</dt><dd className="break-words">{draft.subject}</dd></div>
          <div><dt className="font-medium">Audience</dt><dd>{audienceLabel(draft.audience)}</dd></div>
        </dl>
        <pre data-testid="rich-readonly-body" className="whitespace-pre-wrap break-words rounded-lg bg-gray-50 p-3 font-sans text-sm text-[#1F2937]">
          {draft.body}
        </pre>
      </div>
    );
  }
  if (draft && draft.state !== "draft") {
    return (
      <div className={cardClass}>
        <p className="text-sm text-gray-700 dark:text-gray-200">
          This broadcast has been queued and can no longer be edited. Create a new draft to send different content.
        </p>
        <Link className="mt-3 inline-block font-medium text-[#2A742F] underline" to={`/admin/communication/history/${draft.id}`}>
          View delivery history
        </Link>
      </div>
    );
  }

  const activePreview = preview && draft && preview.version === draft.version && !dirty ? preview.data : null;
  const saved = Boolean(draft) && !dirty && !conflict;

  return (
    <div className="space-y-6">
      <form onSubmit={save} noValidate className={`${cardClass} space-y-4`} aria-labelledby={`${formId}-title`}>
        <h2 id={`${formId}-title`} className="text-lg font-semibold text-[#1F2937] dark:text-white">
          {draft ? `Edit draft #${draft.id}` : "New broadcast"}
        </h2>
        <FormNotice>{notice}</FormNotice>
        <FormAlert>{error}</FormAlert>
        {conflict && (
          <div role="alert" className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200">
            <p className="font-medium">This draft was changed somewhere else.</p>
            <p className="mt-1">Your edits were not saved and nothing was overwritten. Reload to load the latest saved version; your unsaved text stays on screen until you do.</p>
            <button type="button" onClick={reload} className={`${secondaryButton} mt-3`}>
              Reload latest version
            </button>
          </div>
        )}
        <Field label="Subject" errors={fieldErrors.subject} htmlFor={`${formId}-subject`}>
          <input
            id={`${formId}-subject`}
            className={inputClass}
            value={form.subject}
            onChange={(event) => set({ subject: event.target.value })}
            aria-invalid={fieldErrors.subject ? true : undefined}
            aria-describedby={fieldErrors.subject ? `${formId}-subject-error` : undefined}
            maxLength={250}
          />
        </Field>
        <Field label="Message (plain text)" errors={fieldErrors.body} htmlFor={`${formId}-body`}>
          <textarea
            id={`${formId}-body`}
            className={`${inputClass} min-h-48`}
            rows={8}
            value={form.body}
            onChange={(event) => set({ body: event.target.value })}
            aria-invalid={fieldErrors.body ? true : undefined}
            aria-describedby={fieldErrors.body ? `${formId}-body-error` : undefined}
          />
        </Field>
        <AudienceSelector value={form} errors={audienceErrors(fieldErrors) ?? (form.audienceType === "unknown" ? validateForm(form).audience : undefined)} onChange={(next) => set(next)} />
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <button type="submit" className={primaryButton} disabled={saving || conflict || (Boolean(draft) && !dirty)}>
            {saving ? "Saving…" : draft ? "Save changes" : "Save draft"}
          </button>
          <button type="button" className={secondaryButton} onClick={runPreview} disabled={!saved || previewing || !allows(draft, "preview")}>
            {previewing ? "Loading preview…" : "Preview"}
          </button>
          <button type="button" className={secondaryButton} onClick={() => setConfirming(true)} disabled={!saved || !allows(draft, "queue")}>
            Queue for sending…
          </button>
        </div>
        {!saved && !conflict && <p className="text-xs text-gray-500">Save the draft to preview or queue it. Preview and queue use the saved version.</p>}
      </form>

      {activePreview && <Preview preview={activePreview} />}

      {confirming && draft && (
        <QueueConfirmDialog
          draft={draft}
          audienceCount={activePreview?.audienceCount ?? null}
          busy={queueing}
          error={queueError}
          onConfirm={confirmQueue}
          onCancel={() => setConfirming(false)}
        />
      )}
    </div>
  );
}

/** Compose (new) and edit (drafts/:id). Keyed by id so state never leaks between drafts. */
export default function ComposePage() {
  const { id } = useParams();
  return <Editor key={id ?? "new"} id={id} />;
}
