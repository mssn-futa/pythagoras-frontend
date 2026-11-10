import { Dialog, DialogPanel, DialogTitle } from "@headlessui/react";
import { useRef } from "react";
import { FormAlert } from "../../auth/components/FormControls.jsx";
import { audienceLabel } from "../model.js";
import { primaryButton, secondaryButton } from "./common.jsx";

/**
 * Confirmation before queueing: shows the audience and that queued content is frozen.
 * Headless UI's Dialog traps focus, makes the page behind inert, closes on Escape
 * and restores focus to the control that opened it.
 */
export default function QueueConfirmDialog({ draft, audienceCount, busy, error, onConfirm, onCancel }) {
  const cancelRef = useRef(null);
  return (
    <Dialog open onClose={() => !busy && onCancel()} initialFocus={cancelRef} className="relative z-50">
      <div className="fixed inset-0 bg-black/50" aria-hidden="true" />
      <div className="fixed inset-0 flex items-end justify-center sm:items-center sm:p-4">
        <DialogPanel className="max-h-full w-full overflow-y-auto rounded-t-xl bg-white p-5 shadow-xl sm:max-w-lg sm:rounded-xl dark:bg-gray-800">
          <DialogTitle as="h2" className="text-lg font-semibold text-[#1F2937] dark:text-white">
            Queue this broadcast?
          </DialogTitle>
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
        </DialogPanel>
      </div>
    </Dialog>
  );
}
