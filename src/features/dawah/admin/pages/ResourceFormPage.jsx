import { useCallback, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Alert, Breadcrumbs, Card, ErrorState, Field, Loading, PageHeader, primaryButton } from "../components/ui.jsx";
import { createAudioResourceSafely, getEvent } from "../dawahAdminService.js";
import { describeAdminError } from "../errors.js";
import { useLoad } from "../hooks.js";

function ResourceForm({ eventId }) {
  const navigate = useNavigate();
  const loader = useCallback(() => getEvent(eventId), [eventId]);
  const { data: event, error: loadError, loading, reload } = useLoad(loader);
  const [title, setTitle] = useState("");
  const [clientError, setClientError] = useState(null);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const { message, fields } = describeAdminError(error, ["title", "type"]);

  if (loading && !event) return <Loading label="Loading event…" />;
  if (loadError) return <ErrorState error={loadError} onRetry={reload} title="Could not load this event" />;

  const submit = async (submitEvent) => {
    submitEvent.preventDefault();
    setError(null);
    if (!title.trim()) return setClientError(["Enter a title."]);
    setClientError(null);
    setSaving(true);
    try {
      const resource = await createAudioResourceSafely(eventId, { title });
      navigate(`/admin/events/${eventId}/resources/${resource.id}`, { state: { notice: "Draft saved. Now upload the audio file." } });
    } catch (caught) {
      setError(caught);
      setSaving(false);
    }
  };

  return (
    <section className="max-w-2xl mx-auto space-y-6">
      <Breadcrumbs items={[{ label: "Events", to: "/admin/events" }, { label: event.title, to: `/admin/events/${eventId}` }, { label: "New audio" }]} />
      <PageHeader title="New audio resource" subtitle="Save the draft first. The audio file is uploaded on the next screen." />
      <Card>
        <form onSubmit={submit} noValidate className="space-y-4" aria-label="Audio resource details">
          <Alert>{message}</Alert>
          <Field label="Title" name="title" required maxLength={200} value={title} onChange={(changeEvent) => setTitle(changeEvent.target.value)} errors={clientError ?? fields.title} />
          <button type="submit" disabled={saving} className={primaryButton}>
            {saving ? "Saving…" : "Save draft"}
          </button>
        </form>
      </Card>
    </section>
  );
}

/** /admin/events/:eventId/resources/new */
export default function ResourceFormPage() {
  const { eventId } = useParams();
  return <ResourceForm key={eventId} eventId={eventId} />;
}
