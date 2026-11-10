import { useState } from "react";
import VideoEmbed from "../../public/components/VideoEmbed.jsx";
import { safePlayback } from "../../public/lib/youtube.js";
import { updateResource } from "../dawahAdminService.js";
import { describeAdminError } from "../errors.js";
import { youtubeLinkProblem } from "../youtubeLink.js";
import { Alert, Card, Field, primaryButton } from "./ui.jsx";

/**
 * Existing-YouTube-link entry for a video resource. Saving is an ordinary
 * metadata PATCH: nothing is uploaded to or published on YouTube, and a saved
 * link is not confirmation that the video can be played.
 */
export default function VideoLinkPanel({ eventId, resource, onSaved }) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState(null);
  const [clientError, setClientError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const { message, fields } = describeAdminError(error, ["youtube_url"]);
  const safe = safePlayback(resource.playback);

  const submit = async (event) => {
    event.preventDefault();
    setSaved(false);
    setError(null);
    const problem = youtubeLinkProblem(url);
    if (problem) return setClientError([problem]);
    setClientError(null);
    setSaving(true);
    try {
      await updateResource(eventId, resource.id, { youtubeUrl: url });
      setSaved(true);
      setUrl("");
      onSaved();
    } catch (caught) {
      setError(caught);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card aria-label="Video source">
      <h2 className="text-lg font-semibold text-gray-800 dark:text-white">YouTube link</h2>
      {safe ? (
        <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm text-gray-700 dark:text-gray-300">
          <dt className="font-medium">Video ID</dt>
          <dd data-testid="video-id" className="font-mono break-all">{safe.videoId}</dd>
          {safe.watchUrl && (
            <>
              <dt className="font-medium">Watch URL</dt>
              <dd className="break-all">
                <a href={safe.watchUrl} target="_blank" rel="noopener noreferrer" className="text-[#2A742F] underline dark:text-green-400">{safe.watchUrl}</a>
              </dd>
            </>
          )}
        </dl>
      ) : (
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">No valid YouTube link is saved yet.</p>
      )}
      <form onSubmit={submit} noValidate className="mt-4 space-y-3" aria-label="YouTube link form">
        <Alert>{message}</Alert>
        {saved && <Alert tone="success">YouTube link saved.</Alert>}
        <Field
          label={safe ? "Replace YouTube link" : "YouTube link"}
          name="youtube_url"
          type="url"
          inputMode="url"
          autoComplete="off"
          maxLength={300}
          placeholder="https://www.youtube.com/watch?v=…"
          value={url}
          onChange={(event) => { setSaved(false); setUrl(event.target.value); }}
          errors={clientError ?? fields.youtube_url}
        />
        <button type="submit" disabled={saving} className={primaryButton}>{saving ? "Saving…" : "Save link"}</button>
      </form>
      <p className="mt-3 text-xs text-gray-600 dark:text-gray-400">
        This only stores a link to an existing video. Nothing is uploaded or published to YouTube, and a saved link does not confirm that the video can be played.
      </p>
      {safe && (
        <div className="mt-4">
          <h3 className="mb-2 text-sm font-semibold text-gray-800 dark:text-white">Preview</h3>
          <VideoEmbed playback={resource.playback} title={resource.title} />
        </div>
      )}
    </Card>
  );
}
