import { DOCUMENT_LIMIT_BYTES } from "../constants.js";
import { formatBytes } from "../time.js";
import FileUploadPanel from "./FileUploadPanel.jsx";

/** Document (PDF/DOCX) upload for one saved draft `doc` resource. Replacing published bytes needs unpublication first (D2). */
export default function DocumentUploadPanel({ resource, upload }) {
  const published = resource.status === "published";
  return (
    <FileUploadPanel
      upload={upload}
      ariaLabel="Document file"
      heading="Document file"
      intro={
        published
          ? "Published documents cannot be replaced. Unpublish this resource first to upload a different document."
          : resource.storageStatus === "ready"
            ? "A document is ready. Upload again to replace it."
            : "Upload a PDF or Word (.docx) document to make this draft publishable."
      }
      fileLabel="PDF or Word file"
      accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      limitBytes={DOCUMENT_LIMIT_BYTES}
      readyText="The server confirmed this document is ready. You can publish it."
      locked={published}
    >
      {resource.storageStatus === "ready" && (resource.fileName || resource.sizeBytes) && (
        <p className="text-sm text-gray-700 dark:text-gray-300 break-all">
          Current file: {resource.fileName ?? "document"}
          {resource.sizeBytes ? <span className="text-gray-500 dark:text-gray-400"> · {formatBytes(resource.sizeBytes)}</span> : null}
        </p>
      )}
    </FileUploadPanel>
  );
}
