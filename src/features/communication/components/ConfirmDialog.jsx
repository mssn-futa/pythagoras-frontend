import { Dialog, DialogPanel, DialogTitle } from "@headlessui/react";
import { useRef } from "react";
import { FormAlert } from "../../auth/components/FormControls.jsx";
import { primaryButton, secondaryButton } from "./common.jsx";

/**
 * Generic confirmation (focus trap, inert page behind, Escape closes, focus restored: Headless UI Dialog).
 * Initial focus is the cancel button so Enter/Space never confirms by accident.
 */
export default function ConfirmDialog({ title, children, confirmLabel, busyLabel, busy, error, onConfirm, onCancel }) {
  const cancelRef = useRef(null);
  return (
    <Dialog open onClose={() => !busy && onCancel()} initialFocus={cancelRef} className="relative z-50">
      <div className="fixed inset-0 bg-black/50" aria-hidden="true" />
      <div className="fixed inset-0 flex items-end justify-center sm:items-center sm:p-4">
        <DialogPanel className="max-h-full w-full overflow-y-auto rounded-t-xl bg-white p-5 shadow-xl sm:max-w-lg sm:rounded-xl dark:bg-gray-800">
          <DialogTitle as="h2" className="text-lg font-semibold text-[#1F2937] dark:text-white">
            {title}
          </DialogTitle>
          <div className="mt-3 space-y-3 text-sm text-gray-700 dark:text-gray-200">{children}</div>
          <div className="mt-3">
            <FormAlert>{error}</FormAlert>
          </div>
          <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" ref={cancelRef} className={secondaryButton} onClick={onCancel} disabled={busy}>
              Cancel
            </button>
            <button type="button" className={primaryButton} onClick={onConfirm} disabled={busy}>
              {busy ? busyLabel : confirmLabel}
            </button>
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  );
}
