import { useState } from "react";
import { IMAGE_LIMIT_BYTES } from "../constants.js";
import { updateEventImageAlt } from "../dawahAdminService.js";
import { describeAdminError } from "../errors.js";
import { safeHttpsUrl } from "../safeUrl.js";
import FileUploadPanel from "./FileUploadPanel.jsx";
import { Alert, Field, secondaryButton } from "./ui.jsx";

/**
 * Featured-image upload for one saved event. The only image ever rendered here is the
 * server's short-lived admin `preview_url` (from finalize or the event re-read): never
 * a local file URL, never the public URL, and never stored in browser storage.
 */
function AltTextForm({ event, onSaved }) {
  const [alt, setAlt] = useState(event.featuredImageAlt ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(null);
  const { message, fields } = describeAdminError(error, ["featured_image_alt"]);
  const submit = async (submitEvent) => {
    submitEvent.preventDefault();
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      await updateEventImageAlt(event.id, alt);
      setSaved(true);
      onSaved?.();
    } catch (caught) {
      setError(caught);
    } finally {
      setSaving(false);
    }
  };
  return (
    <form onSubmit={submit} noValidate className="space-y-2" aria-label="Image description">
      <Alert>{message}</Alert>
      {saved && <Alert tone="success">Image description saved.</Alert>}
      <Field
        label="Image description (alt text)"
        hint="Read aloud by screen readers. Leave blank to use a generic description."
        name="featured_image_alt"
        maxLength={200}
        value={alt}
        onChange={(changeEvent) => { setSaved(false); setAlt(changeEvent.target.value); }}
        errors={fields.featured_image_alt}
      />
      <button type="submit" disabled={saving} className={secondaryButton}>
        {saving ? "Saving…" : "Save description"}
      </button>
    </form>
  );
}

export default function FeaturedImagePanel({ event, upload, onAltSaved }) {
  const preview = safeHttpsUrl(upload.previewUrl ?? event.previewUrl);
  const hasImage = Boolean(event.featuredImageUrl || event.previewUrl || upload.phase === "ready");
  return (
    <FileUploadPanel
      upload={upload}
      ariaLabel="Featured image"
      heading="Featured image"
      intro={
        event.status === "published"
          ? "Replacing the image of a published event keeps the old image visible until the new one is validated and promoted."
          : hasImage
            ? "A featured image is set. Upload again to replace it. It becomes public when the event is published."
            : "Optional. A JPEG or PNG shown on the event for readers once it is published."
      }
      fileLabel="Image file"
      accept=".jpg,.jpeg,.png,image/jpeg,image/png"
      limitBytes={IMAGE_LIMIT_BYTES}
      readyText="The server confirmed this image is ready."
    >
      {preview ? (
        <figure>
          <img
            src={preview}
            alt={event.featuredImageAlt || `Featured image preview for ${event.title}`}
            referrerPolicy="no-referrer"
            className="max-h-56 w-full rounded-lg object-contain bg-gray-100 dark:bg-gray-900"
          />
          <figcaption className="mt-1 text-xs text-gray-600 dark:text-gray-400">Admin preview. Readers see the image only after the event is published.</figcaption>
        </figure>
      ) : (
        hasImage && <p className="text-sm text-gray-600 dark:text-gray-400">No preview is available right now. Reload the page to request a fresh preview.</p>
      )}
      {hasImage && <AltTextForm key={event.featuredImageAlt} event={event} onSaved={onAltSaved} />}
    </FileUploadPanel>
  );
}
