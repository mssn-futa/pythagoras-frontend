import { useId } from "react";
import { Link } from "react-router-dom";
import { describeLoadError, retryButton } from "./loadError.js";

/** Inline error with a retry button, shared by panels and count cards. */
export function LoadError({ title, error, onRetry }) {
  return (
    <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-200">
      <p className="font-medium">{title}</p>
      <p className="mt-1">{describeLoadError(error)}</p>
      <button type="button" onClick={onRetry} className={retryButton}>
        Try again
      </button>
    </div>
  );
}

/**
 * One independently loaded dashboard panel: heading, optional "view all"
 * link, and loading / error / empty / ready bodies driven by `source`
 * (the result of useLiveData). `isEmpty(data)` decides the empty state.
 */
export default function DashboardPanel({ title, source, viewAll, loadingText, errorTitle, emptyText, isEmpty, children }) {
  const headingId = useId();
  const { status, data, error, reload } = source;
  return (
    <section aria-labelledby={headingId} className="flex flex-col rounded-2xl bg-white p-5 shadow-sm md:p-6 dark:bg-black">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 id={headingId} className="text-lg font-semibold text-[#1F2937] dark:text-white">
          {title}
        </h2>
        {viewAll && (
          <Link to={viewAll.to} className="text-sm font-medium text-[#2A742F] hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2A742F] rounded dark:text-green-300">
            {viewAll.label}
          </Link>
        )}
      </div>
      {status === "loading" && (
        <p role="status" className="py-6 text-center text-sm text-[#6B7280] dark:text-gray-400">
          {loadingText}
        </p>
      )}
      {status === "error" && <LoadError title={errorTitle} error={error} onRetry={reload} />}
      {status === "ready" && (isEmpty(data) ? <p className="py-6 text-center text-sm text-[#6B7280] dark:text-gray-400">{emptyText}</p> : children(data))}
    </section>
  );
}
