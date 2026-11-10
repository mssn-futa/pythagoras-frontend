import { useCallback, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import EventForm from "../components/EventForm.jsx";
import ResourceTable from "../components/ResourceTable.jsx";
import { Alert, Breadcrumbs, Card, ConfirmAction, EmptyState, ErrorState, Loading, PageHeader, StatusBadge, primaryButton, secondaryButton } from "../components/ui.jsx";
import { deleteEvent, getEvent, listResources, publishEvent, unpublishEvent, updateEvent } from "../dawahAdminService.js";
import { adminErrorMessage } from "../errors.js";
import { useLoad } from "../hooks.js";
import { formatLagos } from "../time.js";

function EventDetail({ eventId }) {
  const navigate = useNavigate();
  const location = useLocation();
  const eventLoader = useCallback(() => getEvent(eventId), [eventId]);
  const resourcesLoader = useCallback(() => listResources(eventId), [eventId]);
  const eventState = useLoad(eventLoader);
  const resourcesState = useLoad(resourcesLoader);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState(null);
  const [notice, setNotice] = useState(location.state?.notice ?? null);

  const event = eventState.data;
  if (eventState.loading && !event) return <Loading label="Loading event…" />;
  if (eventState.error) return <ErrorState error={eventState.error} onRetry={eventState.reload} title="Could not load this event" />;

  const run = async (action, success, after) => {
    setBusy(true);
    setActionError(null);
    setNotice(null);
    try {
      await action();
      setNotice(success);
      if (after) after();
      else {
        eventState.reload();
        resourcesState.reload();
      }
    } catch (error) {
      setActionError(adminErrorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const published = event.status === "published";
  const resources = resourcesState.data?.results ?? [];

  return (
    <section className="max-w-4xl mx-auto space-y-6">
      <Breadcrumbs items={[{ label: "Events", to: "/admin/events" }, { label: event.title }]} />
      <PageHeader
        title={event.title}
        subtitle={`${formatLagos(event.startTime)} to ${formatLagos(event.endTime)}`}
        actions={<StatusBadge status={event.status} />}
      />
      <Alert tone="success">{notice}</Alert>
      <Alert>{actionError}</Alert>

      <Card aria-label="Publication">
        <h2 className="text-lg font-semibold text-gray-800">Publication</h2>
        <p className="mt-1 text-sm text-gray-600">
          {published
            ? `Published${event.publishedAt ? ` ${formatLagos(event.publishedAt)}` : ""}. Unpublishing hides the event and all its resources from discovery without changing their own states. Links already shared may still work.`
            : "Publishing needs valid metadata and timing. Audio is published separately once it is ready."}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {published ? (
            <ConfirmAction
              label="Unpublish event"
              confirmLabel="Unpublish"
              prompt="Hide this event and all its resources?"
              busy={busy}
              onConfirm={() => run(() => unpublishEvent(eventId), "Event unpublished.")}
            />
          ) : (
            <button type="button" className={primaryButton} disabled={busy} onClick={() => run(() => publishEvent(eventId), "Event published.")}>
              {event.status === "unpublished" ? "Republish event" : "Publish event"}
            </button>
          )}
          {published ? (
            <p className="text-xs text-gray-600 self-center">Published events must be unpublished before deletion.</p>
          ) : (
            <ConfirmAction
              label="Delete event"
              confirmLabel="Delete event"
              prompt="Permanently delete this event and its draft resources?"
              tone="danger"
              busy={busy}
              onConfirm={() => run(() => deleteEvent(eventId), "Event deleted.", () => navigate("/admin/events"))}
            />
          )}
        </div>
      </Card>

      <Card aria-label="Event details">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Details</h2>
        <EventForm event={event} submitLabel="Save changes" onSubmit={(values) => updateEvent(eventId, values)} onSaved={eventState.reload} />
      </Card>

      <Card aria-label="Event resources">
        <div className="flex items-center justify-between gap-2 mb-2">
          <h2 className="text-lg font-semibold text-gray-800">Resources</h2>
          <Link to={`/admin/events/${eventId}/resources/new`} className={secondaryButton}>Add audio</Link>
        </div>
        {resourcesState.loading && !resourcesState.data ? (
          <Loading label="Loading resources…" />
        ) : resourcesState.error ? (
          <ErrorState error={resourcesState.error} onRetry={resourcesState.reload} title="Could not load resources" />
        ) : resources.length === 0 ? (
          <EmptyState title="No resources yet">Add an audio draft to upload khutbah or lecture audio.</EmptyState>
        ) : (
          <ResourceTable resources={resources} />
        )}
      </Card>
    </section>
  );
}

/** /admin/events/:eventId */
export default function EventDetailPage() {
  const { eventId } = useParams();
  return <EventDetail key={eventId} eventId={eventId} />;
}
