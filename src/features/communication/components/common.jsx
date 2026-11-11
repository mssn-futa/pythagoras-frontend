import { COUNT_LABELS, broadcastStateText, deliveryStateText } from "../model.js";

export const cardClass = "rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6 dark:border-gray-700 dark:bg-gray-800";
export const primaryButton =
  "inline-flex items-center justify-center rounded-lg bg-[#2A742F] px-4 py-2.5 text-sm font-medium text-white transition-all hover:bg-[#04AF43] focus:outline-none focus:ring-2 focus:ring-[#2A742F] focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60";
export const secondaryButton =
  "inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition-all hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#2A742F] disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200";

const TONES = {
  gray: "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200",
  blue: "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  green: "bg-green-50 text-[#2A742F] dark:bg-green-950 dark:text-green-300",
  amber: "bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  red: "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300",
};

function Badge({ tone, children }) {
  return <span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${TONES[tone] ?? TONES.gray}`}>{children}</span>;
}

export function BroadcastStateBadge({ state }) {
  const { label, tone } = broadcastStateText(state);
  return <Badge tone={tone}>{label}</Badge>;
}

export function DeliveryStateBadge({ state }) {
  const { label, tone } = deliveryStateText(state);
  return <Badge tone={tone}>{label}</Badge>;
}

/** "42 recipients: 3 queued, 38 Resend accepted, ..." — zero buckets stay visible for honesty. */
export function CountsLine({ broadcast }) {
  const parts = COUNT_LABELS.filter(([key]) => key !== "cancelled" || broadcast.counts.cancelled > 0).map(
    ([key, label]) => `${broadcast.counts[key]} ${label}`,
  );
  return (
    <p className="text-sm text-gray-600 dark:text-gray-300">
      {broadcast.recipientCount} {broadcast.recipientCount === 1 ? "recipient" : "recipients"}: {parts.join(", ")}
    </p>
  );
}

export function Pager({ page, count, pageSize, onPage, label = "Pagination" }) {
  const pages = Math.max(1, Math.ceil(count / pageSize));
  if (pages <= 1) return null;
  return (
    <nav aria-label={label} className="mt-4 flex items-center justify-between gap-3">
      <button type="button" className={secondaryButton} disabled={page <= 1} onClick={() => onPage(page - 1)}>
        Previous
      </button>
      <span className="text-sm text-gray-600 dark:text-gray-300">
        Page {page} of {pages}
      </span>
      <button type="button" className={secondaryButton} disabled={page >= pages} onClick={() => onPage(page + 1)}>
        Next
      </button>
    </nav>
  );
}

export function EmptyState({ children }) {
  return <p className="rounded-lg border border-dashed border-gray-300 p-6 text-center text-sm text-gray-600 dark:border-gray-600 dark:text-gray-300">{children}</p>;
}

export function LoadingLine({ children = "Loading…" }) {
  return (
    <p role="status" className="p-4 text-sm text-gray-600 dark:text-gray-300">
      {children}
    </p>
  );
}

export function PageError({ error, onRetry }) {
  return (
    <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
      <p>{error.message}</p>
      {onRetry && (
        <button type="button" onClick={onRetry} className="mt-2 font-medium underline">
          Try again
        </button>
      )}
    </div>
  );
}
