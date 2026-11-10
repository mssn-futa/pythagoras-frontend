import { useCallback } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Card, EmptyState, ErrorState, Loading, PageHeader, Pager, SelectInput, StatusBadge, primaryButton, secondaryButton } from "../components/ui.jsx";
import { PAGE_SIZE, STATUS_FILTERS } from "../constants.js";
import { listEvents } from "../dawahAdminService.js";
import { useLoad } from "../hooks.js";
import { formatLagos } from "../time.js";

/** /admin/events: draft-inclusive list with status filter and pagination. */
export default function EventsListPage() {
  const [params, setParams] = useSearchParams();
  const status = params.get("status") ?? "all";
  const upcoming = params.get("upcoming") === "true";
  const page = Math.max(1, Number(params.get("page")) || 1);
  const loader = useCallback(() => listEvents({ status, upcoming, page }), [status, upcoming, page]);
  const { data, error, loading, reload } = useLoad(loader);

  const update = (changes) => {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries({ page: 1, ...changes })) {
      if (value === null || value === undefined || value === false || value === "all" || (key === "page" && value === 1)) next.delete(key);
      else next.set(key, String(value));
    }
    setParams(next);
  };

  return (
    <section className="max-w-6xl mx-auto space-y-6">
      <PageHeader
        title="Events"
        subtitle="Create, publish and manage Da'wah events."
        actions={<Link to="/admin/events/new" className={primaryButton}>New event</Link>}
      />

      <Card>
        <div className="flex flex-col sm:flex-row sm:items-end gap-4">
          <SelectInput
            label="Status"
            className="sm:w-56"
            options={STATUS_FILTERS}
            value={status}
            onChange={(event) => update({ status: event.target.value })}
          />
          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 pb-2">
            <input type="checkbox" checked={upcoming} onChange={(event) => update({ upcoming: event.target.checked })} />
            Upcoming only
          </label>
        </div>
      </Card>

      <Card>
        {loading && !data ? (
          <Loading label="Loading events…" />
        ) : error?.status === 404 && page > 1 ? (
          <EmptyState title="That page no longer exists">
            <button type="button" className={secondaryButton} onClick={() => update({ page: 1 })}>Go to the first page</button>
          </EmptyState>
        ) : error ? (
          <ErrorState error={error} onRetry={reload} title="Could not load events" />
        ) : data.results.length === 0 ? (
          <EmptyState title="No events found">
            {status === "all" && !upcoming ? "Create the first event to get started." : "Try a different filter."}
          </EmptyState>
        ) : (
          <>
            <ul className="divide-y divide-gray-200 dark:divide-gray-700" aria-label="Events">
              {data.results.map((event) => (
                <li key={event.id} className="py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div className="min-w-0">
                    <Link to={`/admin/events/${event.id}`} className="font-medium text-[#2A742F] hover:underline break-words">
                      {event.title}
                    </Link>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                      {formatLagos(event.startTime)}
                      {event.speakers ? ` · ${event.speakers}` : ""}
                      {event.location ? ` · ${event.location}` : ""}
                    </p>
                  </div>
                  <StatusBadge status={event.status} />
                </li>
              ))}
            </ul>
            <Pager
              page={page}
              count={data.count}
              pageSize={PAGE_SIZE}
              hasNext={Boolean(data.next)}
              hasPrevious={Boolean(data.previous)}
              onPage={(next) => update({ page: next })}
            />
          </>
        )}
      </Card>
    </section>
  );
}
