import { useEffect, useRef } from "react";
import { FormAlert } from "../../auth/components/FormControls.jsx";
import { audienceLabel } from "../model.js";
import { primaryButton, secondaryButton } from "./common.jsx";

/** Confirmation before queueing: shows the audience and that queued content is frozen. */
export default function QueueConfirmDialog({ draft, audienceCount, busy, error, onConfirm, onCancel }) {
  const cancelRef = useRef(null);
  useEffect(() => {
    cancelRef.current?.focus();
    const onKey = (event) => {
      if (event.key === "Escape" && !busy) onCancel();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [busy, onCancel]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4">
      <div role="dialog" aria-modal="true" aria-labelledby="queue-dialog-title" className="max-h-full w-full overflow-y-auto rounded-t-xl bg-white p-5 shadow-xl sm:max-w-lg sm:rounded-xl dark:bg-gray-800">
        <h2 id="queue-dialog-title" className="text-lg font-semibold text-[#1F2937] dark:text-white">
          Queue this broadcast?
        </h2>
        <dl className="mt-3 space-y-2 text-sm text-gray-700 dark:text-gray-200">
          <div>
            <dt className="font-medium">Subject</dt>
            <dd className="break-words">{draft.subject}</dd>
          </div>
          <div>
            <dt className="font-medium">Audience</dt>
            <dd>{audienceLabel(draft.audience)}</dd>
          </div>
          {audienceCount != null && (
            <div>
              <dt className="font-medium">Estimated recipients</dt>
              <dd>About {audienceCount} (advisory; the final list is fixed when you queue)</dd>
            </div>
          )}
        </dl>
        <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
          Once queued, the subject, content and audience cannot be changed. To send different content, create another draft.
          Queueing only saves the request; delivery happens afterwards and is not guaranteed.
        </p>
        <div className="mt-3">
          <FormAlert>{error}</FormAlert>
        </div>
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" ref={cancelRef} className={secondaryButton} onClick={onCancel} disabled={busy}>
            Cancel
          </button>
          <button type="button" className={primaryButton} onClick={onConfirm} disabled={busy}>
            {busy ? "Queueing…" : "Queue broadcast"}
          </button>
        </div>
      </div>
    </div>
  );
}
