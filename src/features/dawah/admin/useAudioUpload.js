import { useMemo } from "react";
import { AUDIO_LIMIT_BYTES } from "./constants.js";
import { getResource, requestAudioUpload } from "./dawahAdminService.js";
import { formatBytes } from "./time.js";
import { useFileUpload } from "./useFileUpload.js";

/* Audio upload for one saved draft resource. The state machine lives in useFileUpload.js. */

const MP3_TYPES = ["audio/mpeg", "audio/mp3", "audio/x-mpeg"]; // browsers report all three for .mp3

export function validateAudioFile(file) {
  if (!file) return "Choose an MP3 file.";
  const looksMp3 = /\.mp3$/i.test(file.name) && (!file.type || MP3_TYPES.includes(file.type));
  if (!looksMp3) return "Only MP3 audio files (.mp3) are accepted.";
  if (file.size <= 0) return "That file is empty.";
  if (file.size > AUDIO_LIMIT_BYTES) return `That file is ${formatBytes(file.size)}. The limit is ${formatBytes(AUDIO_LIMIT_BYTES)}.`;
  return null;
}

const readResource = (resource) => ({ storageStatus: resource.storageStatus, uploadedAt: resource.uploadedAt });

export function useAudioUpload({ eventId, resourceId, resource, onResourceChange }) {
  const config = useMemo(
    () => ({
      noun: "audio",
      nounFile: "audio file",
      validate: validateAudioFile,
      requestIntent: (file, options) => requestAudioUpload(eventId, resourceId, file, options),
      fetchFresh: () => getResource(eventId, resourceId),
      read: readResource,
    }),
    [eventId, resourceId],
  );
  return useFileUpload({ config, current: resource, onChange: onResourceChange });
}
