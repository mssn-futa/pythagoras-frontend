import { AUDIO_LIMIT_BYTES } from "../constants.js";
import FileUploadPanel from "./FileUploadPanel.jsx";

/** Audio upload controls for one saved draft resource (see FileUploadPanel). */
export default function AudioUploadPanel({ resource, upload }) {
  const published = resource.status === "published";
  return (
    <FileUploadPanel
      upload={upload}
      ariaLabel="Audio file"
      heading="Audio file"
      intro={
        published
          ? "Published audio cannot be replaced. Unpublish this resource first to upload different audio."
          : resource.storageStatus === "ready"
            ? "Audio is ready. Upload again to replace it."
            : "Upload an MP3 to make this draft publishable."
      }
      fileLabel="MP3 file"
      accept=".mp3,audio/mpeg"
      limitBytes={AUDIO_LIMIT_BYTES}
      readyText="The server confirmed this audio is ready. You can publish it."
      locked={published}
    />
  );
}
