import { useMemo } from "react";
import { getResource, requestDocumentUpload } from "./dawahAdminService.js";
import { validateDocumentFile } from "./uploadFiles.js";
import { useFileUpload } from "./useFileUpload.js";

const readResource = (resource) => ({ storageStatus: resource.storageStatus, uploadedAt: resource.uploadedAt });

/** Document (PDF/DOCX) upload for one saved draft `doc` resource: intent -> direct PUT -> finalize -> re-read. */
export function useDocumentUpload({ eventId, resourceId, resource, onResourceChange }) {
  const config = useMemo(
    () => ({
      noun: "document",
      nounFile: "document",
      validate: validateDocumentFile,
      requestIntent: (file, options) => requestDocumentUpload(eventId, resourceId, file, options),
      fetchFresh: () => getResource(eventId, resourceId),
      read: readResource,
    }),
    [eventId, resourceId],
  );
  return useFileUpload({ config, current: resource, onChange: onResourceChange });
}
