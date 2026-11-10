import { useCallback, useEffect, useRef, useState } from "react";
import { AUDIO_LIMIT_BYTES } from "./constants.js";
import { finalizeUpload, getResource, requestAudioUpload } from "./dawahAdminService.js";
import { formatBytes, parseIsoInstant } from "./time.js";
import { putToSignedUrl, UploadTransportError } from "./uploadTransport.js";

/*
 * Audio upload state machine (D2 "Frontend Design"):
 *   resource draft (already saved) -> intent -> direct PUT -> finalize -> re-read resource
 * Every run owns ONE AbortController, stored immediately and checked after each
 * await, so cancel/unmount can never continue into a PUT or finalize.
 * Retry rules:
 *   - PUT network/CORS failure: retry the SAME intent unless it has expired.
 *   - PUT 403 / expired intent: request a NEW intent for the SAME resource.
 *   - finalize transport/provider/conflict failure: retry finalize only (no re-PUT).
 *   - finalize rejection (other 4xx): choose a new file (new intent, same resource).
 * "ready" is derived from the server: the finalize outcome and the re-read
 * resource. When replacing an already-ready asset, the old asset's
 * storage_status alone never counts.
 */

const EXPIRY_MARGIN_MS = 5_000;
const INITIAL = { phase: "idle", progress: 0, message: null, retryAction: null, fileName: null, fileSize: null };
const BUSY_PHASES = ["requesting", "uploading", "validating"];
const MP3_TYPES = ["audio/mpeg", "audio/mp3", "audio/x-mpeg"]; // browsers report all three for .mp3
const REJECTED_UPLOAD_STATUSES = new Set(["rejected", "failed", "invalid", "error"]);

export function validateAudioFile(file) {
  if (!file) return "Choose an MP3 file.";
  const looksMp3 = /\.mp3$/i.test(file.name) && (!file.type || MP3_TYPES.includes(file.type));
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
// 409 on finalize is a lease/state conflict (another validation running, state race): retry, don't re-pick.
const isRetryableFinalize = (error) => isTransient(error) || error.status === 409;

export function useAudioUpload({ eventId, resourceId, resource, onResourceChange }) {
  const [state, setState] = useState(INITIAL);
  const fileRef = useRef(null);
  const intentRef = useRef(null);
  const putDoneRef = useRef(false);
  const abortRef = useRef(null);
  const aliveRef = useRef(true);
  const finalizeInfoRef = useRef(null);
  const baselineRef = useRef({ ready: false, uploadedAt: null });
  const resourceRef = useRef(resource);
  const onChangeRef = useRef(onResourceChange);

  useEffect(() => {
    onChangeRef.current = onResourceChange;
    resourceRef.current = resource;
  }, [onResourceChange, resource]);
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

  /** Decide the outcome from the finalize result plus the re-read resource. */
  const evaluate = useCallback(
    (fresh) => {
      const uploadStatus = finalizeInfoRef.current?.uploadStatus ?? null;
      if ((uploadStatus && REJECTED_UPLOAD_STATUSES.has(uploadStatus)) || fresh.storageStatus === "failed") {
        patch({ phase: "failed", message: "The server did not accept this audio file. Choose a different file.", retryAction: "choose" });
        return;
      }
      if (fresh.storageStatus !== "ready" || (uploadStatus && uploadStatus !== "ready")) {
        patch({ phase: "pending", message: "The server has not marked this audio ready yet.", retryAction: "check" });
        return;
      }
      const baseline = baselineRef.current;
      if (baseline.ready) {
        // Replacing a ready asset: the old asset is also "ready", so require this upload's identity.
        const explicit = uploadStatus === "ready";
        const changed = Boolean(fresh.uploadedAt) && fresh.uploadedAt !== baseline.uploadedAt;
        if (!explicit && !changed) {
          patch({ phase: "pending", message: "The server still shows the previous audio. Check again shortly.", retryAction: "check" });
          return;
        }
      }
      baselineRef.current = { ready: true, uploadedAt: fresh.uploadedAt };
      patch({ phase: "ready", message: null, retryAction: null });
    },
    [patch],
  );

  const confirmServerState = useCallback(async () => {
    try {
      const fresh = await getResource(eventId, resourceId);
      if (!aliveRef.current) return;
      onChangeRef.current?.(fresh);
      evaluate(fresh);
    } catch (error) {
      patch({ phase: "pending", message: `Could not confirm the audio state: ${error.message}`, retryAction: "check" });
    }
  }, [eventId, resourceId, patch, evaluate]);

  const run = useCallback(async () => {
    const file = fileRef.current;
    const controller = new AbortController();
    abortRef.current = controller;
    const { signal } = controller;
    const stopped = () => signal.aborted || !aliveRef.current;
    const cancelled = () => patch({ phase: "failed", retryAction: "put", message: "Upload cancelled. Your draft is saved." });

    try {
      if (!putDoneRef.current) {
        let intent = intentRef.current;
        if (!intent || isExpired(intent)) {
          intentRef.current = null;
          patch({ phase: "requesting", progress: 0, message: null, retryAction: null });
          try {
            intent = await requestAudioUpload(eventId, resourceId, file, { signal });
          } catch (error) {
            if (stopped()) return void cancelled();
            patch({ phase: "failed", message: describeApiError(error), retryAction: isTransient(error) ? "put" : "choose" });
            return;
          }
          if (stopped()) return void cancelled(); // never PUT after cancel/unmount
          intentRef.current = intent;
        }
        patch({ phase: "uploading", progress: 0, message: null, retryAction: null });
        try {
          await putToSignedUrl({
            uploadUrl: intent.uploadUrl,
            headers: intent.headers,
            file,
            signal,
            onProgress: (fraction) => patch({ progress: fraction }),
          });
          putDoneRef.current = true;
        } catch (error) {
          if (!(error instanceof UploadTransportError)) throw error;
          if (stopped() || error.kind === "aborted") return void cancelled();
          if (error.kind === "network") {
            patch({
              phase: "failed",
              retryAction: "put",
              message:
                "Could not send the file to storage. Check your connection; if it keeps failing the storage service may be rejecting this site (CORS). Your draft is saved and a retry reuses the same upload link while it is valid.",
            });
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
        }
        if (stopped()) return void cancelled(); // bytes landed, but do not finalize after cancel/unmount
      }

      patch({ phase: "validating", progress: 1, message: null, retryAction: null });
      try {
        finalizeInfoRef.current = await finalizeUpload(intentRef.current.uploadId, { signal });
      } catch (error) {
        if (stopped()) return;
        if (isRetryableFinalize(error)) {
          patch({ phase: "failed", retryAction: "finalize", message: `${describeApiError(error)} The file is uploaded; retry validation.` });
        } else {
          intentRef.current = null;
          putDoneRef.current = false;
          patch({ phase: "failed", retryAction: "choose", message: describeApiError(error) });
        }
        return;
      }
      if (stopped()) return;
      await confirmServerState();
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
    }
  }, [eventId, resourceId, patch, confirmServerState]);

  const start = useCallback(
    (file) => {
      const problem = validateAudioFile(file);
      if (problem) {
        patch({ ...INITIAL, phase: "failed", message: problem, retryAction: "choose" });
        return undefined;
      }
      fileRef.current = file;
      intentRef.current = null;
      putDoneRef.current = false;
      finalizeInfoRef.current = null;
      const current = resourceRef.current;
      baselineRef.current = { ready: current?.storageStatus === "ready", uploadedAt: current?.uploadedAt ?? null };
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

  /** Cancel while requesting the link or sending bytes (finalize is not cancellable). */
  const cancel = useCallback(() => abortRef.current?.abort(), []);

  return { ...state, busy: BUSY_PHASES.includes(state.phase), start, retry, cancel };
}
