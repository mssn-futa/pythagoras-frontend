import { IMAGE_LIMIT_BYTES } from "../constants.js";
import { safeHttpsUrl } from "../safeUrl.js";
import FileUploadPanel from "./FileUploadPanel.jsx";

/**
 * Featured-image upload for one saved event. The only image ever rendered here is the
 * server's short-lived admin `preview_url` (from finalize or the event re-read): never
 * a local file URL, never the public URL, and never stored in browser storage.
 */
export default function FeaturedImagePanel({ event, upload }) {
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
            alt={`Featured image preview for ${event.title}`}
            referrerPolicy="no-referrer"
            className="max-h-56 w-full rounded-lg object-contain bg-gray-100 dark:bg-gray-900"
          />
          <figcaption className="mt-1 text-xs text-gray-600 dark:text-gray-400">Admin preview. Readers see the image only after the event is published.</figcaption>
        </figure>
      ) : (
        hasImage && <p className="text-sm text-gray-600 dark:text-gray-400">No preview is available right now. Reload the page to request a fresh preview.</p>
      )}
    </FileUploadPanel>
  );
}
