import { useId } from "react";
import { formatBytes } from "../time.js";
import { Alert, Card, inputClass, primaryButton, secondaryButton } from "./ui.jsx";

const RETRY_LABELS = {
  put: "Retry upload",
  finalize: "Retry validation",
  check: "Check again",
  choose: "Choose another file",
};

function uploadStepText(phase, progress) {
  if (phase === "requesting") return "Requesting an upload link…";
  if (phase === "uploading") return `Uploading… ${Math.round(progress * 100)}%`;
  if (phase === "validating" || phase === "ready" || phase === "pending") return "Uploaded to storage";
  return "Waiting for a file";
}

function validationStepText(phase) {
  if (phase === "validating") return "Validating on the server…";
  if (phase === "ready") return "Validated: ready to publish";
  if (phase === "pending") return "Not confirmed by the server yet";
  if (phase === "failed") return "Not accepted or not completed";
  return "Not started";
}

/**
 * File upload controls for one saved parent (audio draft, document draft or event).
 * Byte progress and server validation are separate steps; "ready" comes only from the server.
 */
export default function FileUploadPanel({ upload, ariaLabel, heading, intro, fileLabel, accept, limitBytes, readyText, locked = false, children }) {
  const inputId = useId();
  const busy = upload.busy;
  const showStatus = upload.phase !== "idle" && upload.fileName;

  const percent = Math.round(upload.progress * 100);
  return (
    <Card aria-label={ariaLabel}>
      <h2 className="text-lg font-semibold text-gray-800 dark:text-white">{heading}</h2>
      <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{intro}</p>
      <div className="mt-4 space-y-4">
        {children}
        {!locked && (upload.phase === "idle" || upload.phase === "failed" || upload.phase === "ready" || upload.phase === "pending") && (
          <div>
            <label htmlFor={inputId} className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {fileLabel} <span className="font-normal text-xs text-gray-500 dark:text-gray-400">(up to {formatBytes(limitBytes)})</span>
            </label>
            <input
              id={inputId}
              type="file"
              accept={accept}
              className={inputClass}
              disabled={busy}
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (file) upload.start(file);
              }}
            />
          </div>
        )}

        {showStatus && (
          <p className="text-sm text-gray-700 dark:text-gray-300 break-all">
            {upload.fileName}
            {upload.fileSize != null && <span className="text-gray-500 dark:text-gray-400"> · {formatBytes(upload.fileSize)}</span>}
          </p>
        )}

        {showStatus && (
          <ol className="space-y-3 text-sm" aria-label="Upload steps">
            <li>
              <div className="flex justify-between gap-2">
                <span className="font-medium text-gray-800 dark:text-white">1. Upload to storage</span>
                <span className="text-gray-600 dark:text-gray-400">{uploadStepText(upload.phase, upload.progress)}</span>
              </div>
              <div
                role="progressbar"
                aria-label="Upload progress"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={percent}
                className="mt-1 h-2 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden"
              >
                <div className="h-full bg-[#2A742F] transition-all" style={{ width: `${percent}%` }} />
              </div>
            </li>
            <li className="flex justify-between gap-2">
              <span className="font-medium text-gray-800 dark:text-white">2. Server validation</span>
              <span className="text-gray-600 dark:text-gray-400">{validationStepText(upload.phase)}</span>
            </li>
          </ol>
        )}

        {upload.phase === "ready" && <Alert tone="success">{readyText}</Alert>}
        {(upload.phase === "failed" || upload.phase === "pending") && <Alert tone={upload.phase === "failed" ? "error" : "warning"}>{upload.message}</Alert>}

        <div className="flex flex-wrap gap-2">
          {(upload.phase === "requesting" || upload.phase === "uploading") && (
            <button type="button" className={secondaryButton} onClick={upload.cancel}>
              Cancel upload
            </button>
          )}
          {upload.retryAction && !busy && (
            <button type="button" className={primaryButton} onClick={upload.retry}>
              {RETRY_LABELS[upload.retryAction]}
            </button>
          )}
        </div>
      </div>
    </Card>
  );
}
