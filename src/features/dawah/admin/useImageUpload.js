import { useMemo } from "react";
import { getEvent, requestImageUpload } from "./dawahAdminService.js";
import { validateImageFile } from "./uploadFiles.js";
import { useFileUpload } from "./useFileUpload.js";

/**
 * Normalise the event's image state. D2 gives the event only `featured_image_url`
 * (ASSUMPTION: an optional admin status/time may also be present), so when the
 * event carries no explicit status, the finalize outcome decides "ready".
 */
function readEvent(event, finalizeInfo) {
  const explicit = event.featuredImageStatus;
  const finalized = finalizeInfo?.uploadStatus === "ready";
  const present = Boolean(event.featuredImageUrl || event.previewUrl);
  const storageStatus = explicit ?? (finalizeInfo ? (finalized ? "ready" : "none") : present ? "ready" : "none");
  return { storageStatus, uploadedAt: event.featuredImageUploadedAt };
}

/** Featured-image upload for one saved event: intent -> direct PUT -> finalize -> re-read the event. */
export function useImageUpload({ eventId, event, onEventChange }) {
  const config = useMemo(
    () => ({
      noun: "image",
      nounFile: "image",
      validate: validateImageFile,
      requestIntent: (file, options) => requestImageUpload(eventId, file, options),
      fetchFresh: () => getEvent(eventId),
      read: readEvent,
    }),
    [eventId],
  );
  return useFileUpload({ config, current: event, onChange: onEventChange });
}
