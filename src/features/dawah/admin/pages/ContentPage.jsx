import { useCallback } from "react";
import { Link, useSearchParams } from "react-router-dom";
import ResourceTable from "../components/ResourceTable.jsx";
import { Card, EmptyState, ErrorState, Loading, PageHeader, Pager, SelectInput, primaryButton, secondaryButton } from "../components/ui.jsx";
import { LIST_PAGE_SIZE_MAX, RESOURCE_TYPES, STATUS_FILTERS } from "../constants.js";
import { listAllEventsForPicker, listResources } from "../dawahAdminService.js";
import { useLoad } from "../hooks.js";

const TYPE_FILTERS = [{ value: "all", label: "All types" }, ...Object.entries(RESOURCE_TYPES).map(([value, label]) => ({ value, label }))];

function ResourcesOfEvent({ eventId, eventTitle, type, status, page, onPage }) {
  const loader = useCallback(() => listResources(eventId, { page, pageSize: LIST_PAGE_SIZE_MAX, type, status }), [eventId, page, type, status]);
  const { data, error, loading, reload } = useLoad(loader);
  if (loading && !data) return <Loading label="Loading content…" />;
  if (error?.status === 404 && page > 1) {
    return (
      <EmptyState title="That page no longer exists">
        <button type="button" className={secondaryButton} onClick={() => onPage(1)}>Go to the first page</button>
      </EmptyState>
    );
  }
  if (error) return <ErrorState error={error} onRetry={reload} title="Could not load content" />;
  if (data.results.length === 0) {
    return (
      <EmptyState title="No content found">
        {type !== "all" || status !== "all" ? "No resources match these filters." : `Add audio to “${eventTitle}” to get started.`}
      </EmptyState>
    );
  }
  return (
    <>
      <ResourceTable resources={data.results} />
      <Pager page={page} count={data.count} pageSize={LIST_PAGE_SIZE_MAX} hasNext={Boolean(data.next)} hasPrevious={Boolean(data.previous)} onPage={onPage} />
    </>
  );
}

/** /admin/content: resources of one event, with type/status filters. */
export default function ContentPage() {
  const [params, setParams] = useSearchParams();
  const eventId = params.get("event") ?? "";
  const type = params.get("type") ?? "all";
  const status = params.get("status") ?? "all";
  const page = Math.max(1, Number(params.get("page")) || 1);
  const eventsState = useLoad(listAllEventsForPicker);

  const update = (changes) => {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries({ page: 1, ...changes })) {
      if (!value || value === "all" || (key === "page" && value === 1)) next.delete(key);
      else next.set(key, String(value));
    }
    setParams(next);
  };

  const events = eventsState.data?.results ?? [];
  const selected = events.find((event) => String(event.id) === eventId);

  return (
    <section className="max-w-6xl mx-auto space-y-6">
      <PageHeader
        title="Content"
        subtitle="Audio and video resources attached to events."
        actions={eventId && (
          <>
            <Link to={`/admin/events/${eventId}/resources/new`} className={primaryButton}>Add audio</Link>
            <Link to={`/admin/events/${eventId}/resources/new?type=vid`} className={secondaryButton}>Add video link</Link>
          </>
        )}
      />
      <Card>
        {eventsState.error ? (
          <ErrorState error={eventsState.error} onRetry={eventsState.reload} title="Could not load events" />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <SelectInput
              label="Event"
              value={eventId}
              disabled={eventsState.loading && !eventsState.data}
              options={[{ value: "", label: eventsState.loading && !eventsState.data ? "Loading events…" : "Choose an event" }, ...events.map((event) => ({ value: String(event.id), label: event.title }))]}
              onChange={(event) => update({ event: event.target.value })}
            />
            <SelectInput label="Type" value={type} options={TYPE_FILTERS} onChange={(event) => update({ type: event.target.value })} />
            <SelectInput label="Status" value={status} options={STATUS_FILTERS} onChange={(event) => update({ status: event.target.value })} />
          </div>
        )}
      </Card>
      <Card>
        {!eventId ? (
          <EmptyState title="Choose an event">
            {events.length === 0 && !eventsState.loading ? "There are no events yet. Create an event first." : "Pick an event to see its content."}
          </EmptyState>
        ) : (
          <ResourcesOfEvent
            key={eventId}
            eventId={eventId}
            eventTitle={selected?.title ?? "this event"}
            type={type}
            status={status}
            page={page}
            onPage={(next) => update({ page: next })}
          />
        )}
      </Card>
    </section>
  );
}
