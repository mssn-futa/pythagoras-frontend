import { useEffect, useId, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { STATUS_LABELS } from "../constants.js";

export const inputClass =
  "w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2.5 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-[#2A742F] focus:border-[#2A742F] focus:outline-none disabled:bg-gray-100 disabled:text-gray-500";

export const primaryButton =
  "inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-white bg-[#2A742F] hover:bg-[#1f5a24] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#2A742F] disabled:opacity-60 disabled:cursor-not-allowed transition";
export const secondaryButton =
  "inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-[#2A742F] disabled:opacity-60 disabled:cursor-not-allowed transition";
export const dangerButton =
  "inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-600 disabled:opacity-60 disabled:cursor-not-allowed transition";

export function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-2xl lg:text-3xl font-semibold text-gray-800 break-words">{title}</h1>
        {subtitle && <p className="text-sm text-gray-600 mt-1">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Breadcrumbs({ items }) {
  return (
    <nav aria-label="Breadcrumb" className="text-sm text-gray-600">
      <ol className="flex flex-wrap gap-1">
        {items.map((item, index) => (
          <li key={item.label} className="flex gap-1">
            {item.to ? <Link className="text-[#2A742F] hover:underline" to={item.to}>{item.label}</Link> : <span aria-current="page">{item.label}</span>}
            {index < items.length - 1 && <span aria-hidden="true">/</span>}
          </li>
        ))}
      </ol>
    </nav>
  );
}

const BADGE_TONES = {
  draft: "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200",
  published: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  unpublished: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  ready: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  failed: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200",
};

export function Badge({ tone, children }) {
  return <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${BADGE_TONES[tone] ?? "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200"}`}>{children}</span>;
}

export const StatusBadge = ({ status }) => <Badge tone={status}>{STATUS_LABELS[status] ?? status}</Badge>;

export function Card({ children, className = "", ...props }) {
  return (
    <section className={`bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl p-4 md:p-6 shadow-sm ${className}`} {...props}>
      {children}
    </section>
  );
}

export function Loading({ label = "Loading…" }) {
  return (
    <div role="status" className="py-10 text-center text-gray-600 dark:text-gray-400">
      {label}
    </div>
  );
}

export function ErrorState({ error, onRetry, title = "Could not load this page" }) {
  return (
    <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
      <p className="font-medium">{title}</p>
      <p className="mt-1">{error?.message ?? "Something went wrong."}</p>
      {onRetry && (
        <button type="button" onClick={onRetry} className={`${secondaryButton} mt-3`}>
          Try again
        </button>
      )}
    </div>
  );
}

export function EmptyState({ title, children }) {
  return (
    <div className="py-10 text-center text-gray-600 dark:text-gray-400">
      <p className="font-medium text-gray-800 dark:text-white">{title}</p>
      {children && <p className="text-sm mt-1">{children}</p>}
    </div>
  );
}

export function Alert({ tone = "error", children }) {
  if (!children) return null;
  const styles =
    tone === "error"
      ? "border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300"
      : tone === "success"
        ? "border-green-200 bg-green-50 text-[#2A742F] dark:border-green-800 dark:bg-green-950 dark:text-green-300"
        : "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200";
  return (
    <div role={tone === "error" ? "alert" : "status"} className={`rounded-lg border px-4 py-3 text-sm ${styles}`}>
      {children}
    </div>
  );
}

function useFieldIds(errors) {
  const id = useId();
  return { id, errorId: `${id}-error`, message: errors?.length ? errors.join(" ") : null };
}

function Label({ id, children, hint }) {
  return (
    <label htmlFor={id} className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
      {children}
      {hint && <span className="ml-1 font-normal text-xs text-gray-500 dark:text-gray-400">{hint}</span>}
    </label>
  );
}

function FieldError({ id, message }) {
  return message ? (
    <p id={id} className="mt-1 text-xs text-red-600 dark:text-red-400">
      {message}
    </p>
  ) : null;
}

export function Field({ label, hint, errors, className = "", as = "input", ...props }) {
  const { id, errorId, message } = useFieldIds(errors);
  const Control = as;
  return (
    <div className={className}>
      <Label id={id} hint={hint}>{label}</Label>
      <Control
        id={id}
        className={inputClass}
        aria-invalid={message ? true : undefined}
        aria-describedby={message ? errorId : undefined}
        {...props}
      />
      <FieldError id={errorId} message={message} />
    </div>
  );
}

export function SelectInput({ label, options, errors, className = "", ...props }) {
  const { id, errorId, message } = useFieldIds(errors);
  return (
    <div className={className}>
      <Label id={id}>{label}</Label>
      <select id={id} className={inputClass} aria-invalid={message ? true : undefined} aria-describedby={message ? errorId : undefined} {...props}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
      <FieldError id={errorId} message={message} />
    </div>
  );
}

/** Previous/next paging from the D0 paginated envelope. */
export function Pager({ page, count, pageSize, hasNext, hasPrevious, onPage }) {
  if (!hasNext && !hasPrevious) return null;
  const pages = Math.max(1, Math.ceil(count / pageSize));
  return (
    <nav aria-label="Pagination" className="flex items-center justify-between gap-3 pt-4">
      <button type="button" className={secondaryButton} disabled={!hasPrevious} onClick={() => onPage(page - 1)}>
        Previous
      </button>
      <span className="text-sm text-gray-600 dark:text-gray-400">Page {page} of {pages}</span>
      <button type="button" className={secondaryButton} disabled={!hasNext} onClick={() => onPage(page + 1)}>
        Next
      </button>
    </nav>
  );
}

/**
 * Two-step destructive/state action: the first click asks for confirmation
 * inline (no modal), the second runs `onConfirm`.
 */
export function ConfirmAction({ label, confirmLabel = "Confirm", prompt, onConfirm, disabled, busy, tone = "secondary" }) {
  const [asking, setAsking] = useState(false);
  const triggerRef = useRef(null);
  const confirmRef = useRef(null);
  const restoreFocus = useRef(false);
  const baseClass = tone === "danger" ? dangerButton : secondaryButton;

  // Move focus into the prompt when it opens; hand it back to the trigger when it closes.
  useEffect(() => {
    if (asking) confirmRef.current?.focus();
    else if (restoreFocus.current) {
      restoreFocus.current = false;
      triggerRef.current?.focus();
    }
  }, [asking]);

  const close = () => {
    restoreFocus.current = true;
    setAsking(false);
  };

  if (!asking) {
    return (
      <button ref={triggerRef} type="button" className={baseClass} disabled={disabled || busy} onClick={() => setAsking(true)}>
        {label}
      </button>
    );
  }
  return (
    <div
      role="alertdialog"
      aria-label={`Confirm ${label}`}
      onKeyDown={(event) => {
        if (event.key === "Escape") close();
      }}
      className="flex flex-col sm:flex-row sm:items-center gap-2 rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950 p-3 text-sm"
    >
      <span className="text-amber-900 dark:text-amber-100">{prompt}</span>
      <span className="flex gap-2">
        <button
          ref={confirmRef}
          type="button"
          className={tone === "danger" ? dangerButton : primaryButton}
          disabled={busy}
          onClick={async () => {
            await onConfirm();
            close();
          }}
        >
          {busy ? "Working…" : confirmLabel}
        </button>
        <button type="button" className={secondaryButton} disabled={busy} onClick={close}>
          Cancel
        </button>
      </span>
    </div>
  );
}
