import { useCallback, useEffect, useRef, useState } from "react";
import { AUDIO_CONTENT_TYPE, AUDIO_LIMIT_BYTES } from "./constants.js";
import { finalizeUpload, getResource, requestAudioUpload } from "./dawahAdminService.js";
import { formatBytes, parseIsoInstant } from "./time.js";
import { putToSignedUrl, UploadTransportError } from "./uploadTransport.js";

/*
 * Audio upload state machine (D2 "Frontend Design"):
 *   resource draft (already saved) -> intent -> direct PUT -> finalize -> re-read resource
 * Retry rules:
 *   - PUT network/CORS failure: retry the SAME intent unless it has expired.
 *   - PUT 403 / expired intent: request a NEW intent for the SAME resource.
 *   - finalize transport/provider failure: retry finalize only (no re-PUT).
 *   - finalize rejection: choose a new file (new intent, same resource).
 * "ready" is only ever derived from the server's resource.storage_status.
 */

const EXPIRY_MARGIN_MS = 5_000;
const INITIAL = { phase: "idle", progress: 0, message: null, retryAction: null, fileName: null, fileSize: null };

export function validateAudioFile(file) {
  if (!file) return "Choose an MP3 file.";
  const looksMp3 = /\.mp3$/i.test(file.name) && (!file.type || file.type === AUDIO_CONTENT_TYPE);
  if (!looksMp3) return "Only MP3 audio files (.mp3) are accepted.";
  if (file.size <= 0) return "That file is empty.";
  if (file.size > AUDIO_LIMIT_BYTES) return `That file is ${formatBytes(file.size)}. The limit is ${formatBytes(AUDIO_LIMIT_BYTES)}.`;
  return null;
}

function isExpired(intent) {
  const expires = parseIsoInstant(intent?.expiresAt);
  return expires !== null && expires - EXPIRY_MARGIN_MS <= Date.now();
}

function describeApiError(error) {
  const fieldMessages = Object.values(error.fields ?? {}).flat();
  return [error.message, ...fieldMessages].filter(Boolean).join(" ");
}

const isTransient = (error) => error.status === 0 || error.status === 429 || error.status >= 500;

export function useAudioUpload({ eventId, resourceId, onResourceChange }) {
  const [state, setState] = useState(INITIAL);
  const fileRef = useRef(null);
  const intentRef = useRef(null);
  const putDoneRef = useRef(false);
  const abortRef = useRef(null);
  const aliveRef = useRef(true);
  const onChangeRef = useRef(onResourceChange);

  useEffect(() => {
    onChangeRef.current = onResourceChange;
  }, [onResourceChange]);
  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
      abortRef.current?.abort();
    };
  }, []);

  const patch = useCallback((next) => {
    if (aliveRef.current) setState((current) => ({ ...current, ...next }));
  }, []);

  /** Re-read the resource and derive the outcome from the server's storage_status. */
  const confirmServerState = useCallback(async () => {
    try {
      const resource = await getResource(eventId, resourceId);
      onChangeRef.current?.(resource);
      if (resource.storageStatus === "ready") {
        patch({ phase: "ready", message: null, retryAction: null });
      } else if (resource.storageStatus === "failed") {
        patch({ phase: "failed", message: "The server did not accept this audio file. Choose a different file.", retryAction: "choose" });
      } else {
        patch({ phase: "pending", message: "The server has not marked this audio ready yet.", retryAction: "check" });
      }
    } catch (error) {
      patch({ phase: "pending", message: `Could not confirm the audio state: ${error.message}`, retryAction: "check" });
    }
  }, [eventId, resourceId, patch]);

  const run = useCallback(async () => {
    const file = fileRef.current;
    if (!putDoneRef.current) {
      let intent = intentRef.current;
      if (!intent || isExpired(intent)) {
        intentRef.current = null;
        patch({ phase: "requesting", progress: 0, message: null, retryAction: null });
        try {
          intent = await requestAudioUpload(eventId, resourceId, file);
        } catch (error) {
          patch({ phase: "failed", message: describeApiError(error), retryAction: isTransient(error) ? "put" : "choose" });
          return;
        }
        intentRef.current = intent;
      }
      patch({ phase: "uploading", progress: 0, message: null, retryAction: null });
      const controller = new AbortController();
      abortRef.current = controller;
      try {
        await putToSignedUrl({
          uploadUrl: intent.uploadUrl,
          headers: intent.headers,
          file,
          signal: controller.signal,
          onProgress: (fraction) => patch({ progress: fraction }),
        });
        putDoneRef.current = true;
      } catch (error) {
        if (!(error instanceof UploadTransportError)) throw error;
        if (error.kind === "network") {
          patch({
            phase: "failed",
            retryAction: "put",
            message:
              "Could not send the file to storage. Check your connection; if it keeps failing the storage service may be rejecting this site (CORS). Your draft is saved and a retry reuses the same upload link while it is valid.",
          });
        } else if (error.kind === "aborted") {
          patch({ phase: "failed", retryAction: "put", message: "Upload cancelled. Your draft is saved." });
        } else {
          // 403 is the expired/invalid signature case; any other status: ask for a fresh link.
          intentRef.current = null;
          patch({
            phase: "failed",
            retryAction: "put",
            message:
              error.status === 403
                ? "The upload link expired or was refused. Retrying requests a new link for the same draft."
                : `Storage rejected the upload (HTTP ${error.status}). Retrying requests a new link for the same draft.`,
          });
        }
        return;
      } finally {
        abortRef.current = null;
      }
    }

    patch({ phase: "validating", progress: 1, message: null, retryAction: null });
    try {
      await finalizeUpload(intentRef.current.uploadId);
    } catch (error) {
      if (isTransient(error)) {
        patch({ phase: "failed", retryAction: "finalize", message: `${describeApiError(error)} The file is uploaded; retry validation.` });
      } else {
        intentRef.current = null;
        putDoneRef.current = false;
        patch({ phase: "failed", retryAction: "choose", message: describeApiError(error) });
      }
      return;
    }
    await confirmServerState();
  }, [eventId, resourceId, patch, confirmServerState]);

  const start = useCallback(
    (file) => {
      const problem = validateAudioFile(file);
      if (problem) {
        patch({ ...INITIAL, phase: "failed", message: problem, retryAction: "choose" });
        return;
      }
      fileRef.current = file;
      intentRef.current = null;
      putDoneRef.current = false;
      patch({ fileName: file.name, fileSize: file.size });
      return run();
    },
    [patch, run],
  );

  const retry = useCallback(() => {
    if (state.retryAction === "check") return confirmServerState();
    if (state.retryAction === "choose") {
      fileRef.current = null;
      intentRef.current = null;
      putDoneRef.current = false;
      if (aliveRef.current) setState(INITIAL);
      return undefined;
    }
    return run();
  }, [state.retryAction, run, confirmServerState]);

  const cancel = useCallback(() => abortRef.current?.abort(), []);
  const reset = useCallback(() => {
    fileRef.current = null;
    intentRef.current = null;
    putDoneRef.current = false;
    setState(INITIAL);
  }, []);

  return { ...state, start, retry, cancel, reset };
}
