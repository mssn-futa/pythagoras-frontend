import { useEffect, useRef } from "react";
import { dangerButton, primaryButton, secondaryButton } from "./styles.js";

const STATUS_STYLES = {
  draft: "bg-amber-100 text-amber-800",
  published: "bg-emerald-100 text-emerald-800",
  closed: "bg-gray-200 text-gray-700",
};

export function StatusBadge({ status }) {
  return (
    <span className={`inline-block rounded-full px-3 py-1 text-xs font-semibold capitalize ${STATUS_STYLES[status] ?? STATUS_STYLES.closed}`}>
      {status}
    </span>
  );
}

export function Alert({ tone = "error", children, className = "" }) {
  const tones = {
    error: "border-red-200 bg-red-50 text-red-800",
    info: "border-blue-200 bg-blue-50 text-blue-800",
    warn: "border-amber-200 bg-amber-50 text-amber-900",
    success: "border-emerald-200 bg-emerald-50 text-emerald-800",
  };
  return (
    <div role={tone === "error" ? "alert" : "status"} className={`rounded-lg border px-4 py-3 text-sm ${tones[tone]} ${className}`}>
      {children}
    </div>
  );
}

export function FieldError({ id, children }) {
  if (!children) return null;
  return (
    <p id={id} className="mt-1 text-sm text-red-600">
      {children}
    </p>
  );
}


export function ConfirmDialog({ title, children, confirmLabel, tone = "primary", busy = false, onConfirm, onCancel }) {
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
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center">
      <div role="dialog" aria-modal="true" aria-labelledby="confirm-title" className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <h2 id="confirm-title" className="text-lg font-semibold text-gray-800">
          {title}
        </h2>
        <div className="mt-3 space-y-2 text-sm text-gray-600">{children}</div>
        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button ref={cancelRef} type="button" className={secondaryButton} onClick={onCancel} disabled={busy}>
            Cancel
          </button>
          <button type="button" className={tone === "danger" ? dangerButton : primaryButton} onClick={onConfirm} disabled={busy}>
            {busy ? "Working..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export function Pager({ page, count, pageSize, onPage }) {
  const pages = Math.max(1, Math.ceil(count / pageSize));
  if (count === 0) return null;
  return (
    <nav aria-label="Pagination" className="flex flex-col items-center justify-between gap-3 sm:flex-row">
      <p className="text-sm text-gray-600">
        Page {page} of {pages} · {count} total
      </p>
      <div className="flex w-full gap-3 sm:w-auto">
        <button type="button" className={`${secondaryButton} flex-1`} disabled={page <= 1} onClick={() => onPage(page - 1)}>
          Previous
        </button>
        <button type="button" className={`${secondaryButton} flex-1`} disabled={page >= pages} onClick={() => onPage(page + 1)}>
          Next
        </button>
      </div>
    </nav>
  );
}

export function LoadingBlock({ label = "Loading..." }) {
  return (
    <p role="status" className="py-10 text-center text-gray-500">
      {label}
    </p>
  );
}
