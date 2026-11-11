import { useCallback, useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import AudioUploadPanel from "../components/AudioUploadPanel.jsx";
import DocumentUploadPanel from "../components/DocumentUploadPanel.jsx";
import VideoLinkPanel from "../components/VideoLinkPanel.jsx";
import {
  Alert, Badge, Breadcrumbs, Card, ConfirmAction, ErrorState, Field, Loading, PageHeader, StatusBadge, primaryButton,
} from "../components/ui.jsx";
import { RESOURCE_TYPES, STORAGE_STATUS_LABELS } from "../constants.js";
import { deleteResource, getEvent, getResource, publishResource, unpublishResource, updateResource } from "../dawahAdminService.js";
import { adminErrorMessage, describeAdminError } from "../errors.js";
import { useLoad } from "../hooks.js";
import { safeHttpsUrl } from "../safeUrl.js";
import { useAudioUpload } from "../useAudioUpload.js";
import { useDocumentUpload } from "../useDocumentUpload.js";
import { formatBytes, formatDuration, formatLagos } from "../time.js";

function TitleForm({ resource, eventId }) {
  const [title, setTitle] = useState(resource.title);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [clientError, setClientError] = useState(null);
  const { message, fields } = describeAdminError(error, ["title"]);

  const submit = async (event) => {
    event.preventDefault();
    setSaved(false);
    setError(null);
    if (!title.trim()) return setClientError(["Enter a title."]);
    setClientError(null);
    setSaving(true);
    try {
      await updateResource(eventId, resource.id, { title });
      setSaved(true);
    } catch (caught) {
      setError(caught);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-3" aria-label="Resource details">
      <Alert>{message}</Alert>
      {saved && <Alert tone="success">Title saved.</Alert>}
      <Field label="Title" name="title" required maxLength={200} value={title} onChange={(event) => { setSaved(false); setTitle(event.target.value); }} errors={clientError ?? fields.title} />
      <button type="submit" disabled={saving} className={primaryButton}>
        {saving ? "Saving…" : "Save title"}
      </button>
    </form>
  );
}

function ResourceDetail({ eventId, resourceId }) {
  const navigate = useNavigate();
  const location = useLocation();
  const resourceLoader = useCallback(() => getResource(eventId, resourceId), [eventId, resourceId]);
  const eventLoader = useCallback(() => getEvent(eventId), [eventId]);
  const resourceState = useLoad(resourceLoader);
  const eventState = useLoad(eventLoader);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState(null);
  const [notice, setNotice] = useState(location.state?.notice ?? null);

  const resource = resourceState.data;
  // Owned here (not in the panel) so state actions can be blocked while an upload runs.
  // Both hooks are always called (rules of hooks); only the one matching the resource type is ever started.
  const audioUpload = useAudioUpload({ eventId, resourceId, resource, onResourceChange: resourceState.reload });
  const documentUpload = useDocumentUpload({ eventId, resourceId, resource, onResourceChange: resourceState.reload });
  const uploading = audioUpload.busy || documentUpload.busy;
  useEffect(() => {
    if (uploading) setNotice(null);
  }, [uploading]);
  if (resourceState.loading && !resource) return <Loading label="Loading resource…" />;
  if (resourceState.error) return <ErrorState error={resourceState.error} onRetry={resourceState.reload} title="Could not load this resource" />;

  const event = eventState.data;
  const run = async (action, success, after) => {
    setBusy(true);
    setActionError(null);
    setNotice(null);
    try {
      await action();
      setNotice(success);
      if (after) after();
      else resourceState.reload();
    } catch (error) {
      setActionError(adminErrorMessage(error));
      if (error.code === "INVALID_STATE_TRANSITION") resourceState.reload();
    } finally {
      setBusy(false);
    }
  };

  const published = resource.status === "published";
  const eventNotPublished = Boolean(event) && event.status !== "published";
  const isAudio = resource.type === "aud";
  const isVideo = resource.type === "vid";
  const isDocument = resource.type === "doc";
  const previewSrc = resource.previewUrl ?? resource.mediaUrl;
  // Admin-only short-lived preview (or the public URL once promoted); https only, never persisted.
  const documentHref = safeHttpsUrl(documentUpload.previewUrl ?? resource.previewUrl ?? resource.mediaUrl);

  return (
    <section className="max-w-3xl mx-auto space-y-6">
      <Breadcrumbs
        items={[
          { label: "Events", to: "/admin/events" },
          { label: event?.title ?? "Event", to: `/admin/events/${eventId}` },
          { label: resource.title || "Resource" },
        ]}
      />
      <PageHeader
        title={resource.title || "Untitled resource"}
        subtitle={`${RESOURCE_TYPES[resource.type] ?? resource.type}${resource.duration ? ` · ${formatDuration(resource.duration)}` : ""}`}
        actions={
          <>
            <StatusBadge status={resource.status} />
            <Badge tone={resource.storageStatus === "ready" ? "ready" : resource.storageStatus === "failed" ? "failed" : undefined}>
              {STORAGE_STATUS_LABELS[resource.storageStatus] ?? resource.storageStatus}
            </Badge>
          </>
        }
      />
      <Alert tone="success">{notice}</Alert>
      <Alert>{actionError}</Alert>

      <Card aria-label="Resource details">
        <h2 className="text-lg font-semibold text-gray-800 dark:text-white mb-3">Details</h2>
        <TitleForm key={resource.id} resource={resource} eventId={eventId} />
      </Card>

      {isAudio ? (
        <AudioUploadPanel resource={resource} upload={audioUpload} />
      ) : isDocument ? (
        <DocumentUploadPanel resource={resource} upload={documentUpload} />
      ) : isVideo ? (
        <VideoLinkPanel key={resource.id} eventId={eventId} resource={resource} onSaved={resourceState.reload} />
      ) : (
        <Card>
          <p className="text-sm text-gray-600 dark:text-gray-400">This {RESOURCE_TYPES[resource.type] ?? "resource"} is managed in a later release. Only its state can be changed here.</p>
        </Card>
      )}

      {isDocument && resource.storageStatus === "ready" && documentHref && (
        <Card aria-label="Document preview">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-white">Preview</h2>
          <p className="mt-2 break-all text-sm text-gray-700 dark:text-gray-300">
            {resource.fileName ?? "Document"}
            {resource.sizeBytes ? <span className="text-gray-500 dark:text-gray-400"> · {formatBytes(resource.sizeBytes)}</span> : null}
          </p>
          <a href={documentHref} target="_blank" rel="noopener noreferrer" className="mt-3 inline-block text-sm font-medium text-[#2A742F] underline dark:text-green-400">
            Open document (opens in a new tab)
          </a>
          <p className="mt-2 text-xs text-gray-600 dark:text-gray-400">
            The document is never displayed inside this page.
            {resource.uploadedAt ? ` Uploaded ${formatLagos(resource.uploadedAt)}.` : ""}
          </p>
        </Card>
      )}

      {isAudio && resource.storageStatus === "ready" && previewSrc && (
        <Card aria-label="Audio preview">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-white">Preview</h2>
          <audio controls preload="metadata" src={previewSrc} className="mt-3 w-full">
            Your browser does not support audio playback.
          </audio>
          <p className="mt-2 text-xs text-gray-600 dark:text-gray-400">
            {resource.contentType ?? "audio/mpeg"}
            {resource.sizeBytes ? ` · ${formatBytes(resource.sizeBytes)}` : ""}
            {resource.uploadedAt ? ` · uploaded ${formatLagos(resource.uploadedAt)}` : ""}
          </p>
        </Card>
      )}

      <Card aria-label="Publication">
        <h2 className="text-lg font-semibold text-gray-800 dark:text-white">Publication</h2>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          {published
            ? `Visible to readers while its event is published. Unpublish to hide it, replace its ${isVideo ? "link" : isDocument ? "document" : "audio"} or delete it.`
            : isVideo
              ? "Publishing needs a saved YouTube link and a published event. The server checks both. This does not publish anything on YouTube."
              : `Publishing needs a ready ${isDocument ? "document" : "audio file"} and a published event. The server checks both.`}
        </p>
        {event && event.status !== "published" && !published && (
          <p id="publish-blocked-hint" className="mt-2 text-sm text-amber-800 dark:text-amber-300">
            The event is {event.status}. Publish the event before publishing this resource. The publish button is disabled until then.{" "}
            <Link to={`/admin/events/${eventId}`} className="font-medium underline">Go to the event</Link>
          </p>
        )}
        {uploading && <p className="mt-2 text-sm text-amber-800 dark:text-amber-300">An upload is in progress. Publication actions are unavailable until it finishes or is cancelled.</p>}
        <div className="mt-3 flex flex-wrap gap-2">
          {published ? (
            <ConfirmAction
              label="Unpublish resource"
              confirmLabel="Unpublish"
              prompt="Hide this resource from readers?"
              busy={busy}
              disabled={uploading}
              onConfirm={() => run(() => unpublishResource(eventId, resourceId), "Resource unpublished.")}
            />
          ) : (
            <button type="button" className={primaryButton} disabled={busy || uploading || (eventNotPublished && !published)} aria-describedby={eventNotPublished ? "publish-blocked-hint" : undefined} onClick={() => run(() => publishResource(eventId, resourceId), "Resource published.")}>
              {resource.status === "unpublished" ? "Republish resource" : "Publish resource"}
            </button>
          )}
          {published ? (
            <p className="text-xs text-gray-600 dark:text-gray-400 self-center">Published resources must be unpublished before deletion.</p>
          ) : (
            <ConfirmAction
              label="Delete resource"
              confirmLabel="Delete resource"
              prompt={isVideo ? "Delete this video resource? The video on YouTube is not affected." : isDocument ? "Delete this resource and its uploaded document?" : "Delete this resource and its uploaded audio?"}
              tone="danger"
              busy={busy}
              disabled={uploading}
              onConfirm={() => run(() => deleteResource(eventId, resourceId), "Resource deleted.", () => navigate(`/admin/events/${eventId}`))}
            />
          )}
        </div>
      </Card>
    </section>
  );
}

/** /admin/events/:eventId/resources/:resourceId */
export default function ResourcePage() {
  const { eventId, resourceId } = useParams();
  return <ResourceDetail key={`${eventId}-${resourceId}`} eventId={eventId} resourceId={resourceId} />;
}
