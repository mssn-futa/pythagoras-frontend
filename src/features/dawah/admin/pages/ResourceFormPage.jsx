import { useCallback, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Alert, Breadcrumbs, Card, ErrorState, Field, Loading, PageHeader, SelectInput, primaryButton } from "../components/ui.jsx";
import { createAudioResourceSafely, createVideoResourceSafely, getEvent } from "../dawahAdminService.js";
import { describeAdminError } from "../errors.js";
import { useLoad } from "../hooks.js";
import { youtubeLinkProblem } from "../youtubeLink.js";

function ResourceForm({ eventId }) {
  const navigate = useNavigate();
  const loader = useCallback(() => getEvent(eventId), [eventId]);
  const { data: event, error: loadError, loading, reload } = useLoad(loader);
  const [searchParams] = useSearchParams();
  const [kind, setKind] = useState(searchParams.get("type") === "vid" ? "vid" : "aud");
  const [title, setTitle] = useState("");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [urlClientError, setUrlClientError] = useState(null);
  const [clientError, setClientError] = useState(null);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const { message, fields } = describeAdminError(error, ["title", "type", "youtube_url"]);

  if (loading && !event) return <Loading label="Loading event…" />;
  if (loadError) return <ErrorState error={loadError} onRetry={reload} title="Could not load this event" />;

  const submit = async (submitEvent) => {
    submitEvent.preventDefault();
    setError(null);
    if (!title.trim()) return setClientError(["Enter a title."]);
    setClientError(null);
    const video = kind === "vid";
    if (video) {
      const problem = youtubeLinkProblem(youtubeUrl);
      if (problem) return setUrlClientError([problem]);
    }
    setUrlClientError(null);
    setSaving(true);
    try {
      const resource = video
        ? await createVideoResourceSafely(eventId, { title, youtubeUrl })
        : await createAudioResourceSafely(eventId, { title });
      const notice = video ? "Draft saved with the YouTube link. Check the details below, then publish when ready." : "Draft saved. Now upload the audio file.";
      navigate(`/admin/events/${eventId}/resources/${resource.id}`, { state: { notice } });
    } catch (caught) {
      setError(caught);
      setSaving(false);
    }
  };

  return (
    <section className="max-w-2xl mx-auto space-y-6">
      <Breadcrumbs items={[{ label: "Events", to: "/admin/events" }, { label: event.title, to: `/admin/events/${eventId}` }, { label: kind === "vid" ? "New video link" : "New audio" }]} />
      <PageHeader
        title={kind === "vid" ? "New video resource" : "New audio resource"}
        subtitle={kind === "vid" ? "Attach an existing YouTube video by its link. Nothing is uploaded to YouTube." : "Save the draft first. The audio file is uploaded on the next screen."}
      />
      <Card>
        <form onSubmit={submit} noValidate className="space-y-4" aria-label={kind === "vid" ? "Video resource details" : "Audio resource details"}>
          <Alert>{message}</Alert>
          <SelectInput
            label="Type"
            value={kind}
            disabled={saving}
            onChange={(changeEvent) => { setKind(changeEvent.target.value); setUrlClientError(null); }}
            options={[{ value: "aud", label: "Audio (upload a file)" }, { value: "vid", label: "Video (existing YouTube link)" }]}
            errors={fields.type}
          />
          <Field label="Title" name="title" required maxLength={200} value={title} onChange={(changeEvent) => setTitle(changeEvent.target.value)} errors={clientError ?? fields.title} />
          {kind === "vid" && (
            <p className="text-xs text-gray-600 dark:text-gray-400">Paste the link of an existing YouTube video. The server checks it and keeps only the video ID.</p>
          )}
          {kind === "vid" && (
            <Field
              label="YouTube link"
              name="youtube_url"
              type="url"
              inputMode="url"
              autoComplete="off"
              required
              maxLength={300}
              placeholder="https://www.youtube.com/watch?v=…"
              value={youtubeUrl}
              onChange={(changeEvent) => setYoutubeUrl(changeEvent.target.value)}
              errors={urlClientError ?? fields.youtube_url}
            />
          )}
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
