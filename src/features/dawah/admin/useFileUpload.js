import { useCallback, useEffect, useRef, useState } from "react";
import { finalizeUpload } from "./dawahAdminService.js";
import { parseIsoInstant } from "./time.js";
import { putToSignedUrl, UploadTransportError } from "./uploadTransport.js";

/*
 * Generic file upload state machine (D2 "Frontend Design"), shared by audio,
 * documents and event featured images (DAWAH-08 generalised the DAWAH-03 audio hook):
 *   parent already saved -> intent -> direct PUT -> finalize -> re-read parent
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
const INITIAL = { phase: "idle", progress: 0, message: null, retryAction: null, fileName: null, fileSize: null, previewUrl: null };
const BUSY_PHASES = ["requesting", "uploading", "validating"];
const REJECTED_UPLOAD_STATUSES = new Set(["rejected", "failed", "invalid", "error"]);

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

/**
 * @param {object} options
 * @param {object} options.config  stable-by-contract description of one upload kind:
 *   noun / nounFile  copy ("audio" / "audio file"),
 *   validate(file)   -> problem string | null,
 *   requestIntent(file, { signal }) -> mapped intent,
 *   fetchFresh()     -> re-read of the owning record (resource or event),
 *   read(record, finalizeInfo) -> { storageStatus, uploadedAt } normalised server state.
 * @param {object} options.current  the owning record as the page holds it (for the replace baseline).
 * @param {(fresh: object) => void} options.onChange  called with every re-read record.
 */
export function useFileUpload({ config, current: currentRecord, onChange }) {
  const [state, setState] = useState(INITIAL);
  const configRef = useRef(config);
  const fileRef = useRef(null);
  const intentRef = useRef(null);
  const putDoneRef = useRef(false);
  const abortRef = useRef(null);
  const aliveRef = useRef(true);
  const finalizeInfoRef = useRef(null);
  const baselineRef = useRef({ ready: false, uploadedAt: null });
  const resourceRef = useRef(currentRecord);
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    configRef.current = config;
    onChangeRef.current = onChange;
    resourceRef.current = currentRecord;
  }, [config, onChange, currentRecord]);
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

  /**
   * Decide the outcome from the finalize result plus the re-read record. On a manual
   * re-check (`authoritative`) the finalize snapshot is stale (e.g. "validating"), so the
   * re-read record alone decides; the replacement baseline (uploaded_at change) still applies.
   */
  const evaluate = useCallback(
    (record, authoritative = false) => {
      const { noun, nounFile, read } = configRef.current;
      const info = authoritative ? null : finalizeInfoRef.current;
      const uploadStatus = info?.uploadStatus ?? null;
      const fresh = read(record, info);
      if (uploadStatus === "expired") {
        // Terminal: the intent can no longer be finalized. A new file choice requests a new intent for the same parent.
        intentRef.current = null;
        putDoneRef.current = false;
        patch({ phase: "failed", message: `The upload link expired before the ${nounFile} was validated. Choose the file again to start a new upload.`, retryAction: "choose" });
        return;
      }
      if ((uploadStatus && REJECTED_UPLOAD_STATUSES.has(uploadStatus)) || fresh.storageStatus === "failed") {
        patch({ phase: "failed", message: `The server did not accept this ${nounFile}. Choose a different file.`, retryAction: "choose" });
        return;
      }
      if (fresh.storageStatus !== "ready" || (uploadStatus && uploadStatus !== "ready")) {
        patch({ phase: "pending", message: `The server has not marked this ${noun} ready yet.`, retryAction: "check" });
        return;
      }
      const baseline = baselineRef.current;
      if (baseline.ready) {
        // Replacing a ready asset: the old asset is also "ready", so require this upload's identity.
        const explicit = uploadStatus === "ready";
        const changed = Boolean(fresh.uploadedAt) && fresh.uploadedAt !== baseline.uploadedAt;
        if (!explicit && !changed) {
          patch({ phase: "pending", message: `The server still shows the previous ${noun}. Check again shortly.`, retryAction: "check" });
          return;
        }
      }
      baselineRef.current = { ready: true, uploadedAt: fresh.uploadedAt };
      patch({ phase: "ready", message: null, retryAction: null });
    },
    [patch],
  );

  const confirmServerState = useCallback(async (authoritative = false) => {
    try {
      const fresh = await configRef.current.fetchFresh();
      if (!aliveRef.current) return;
      onChangeRef.current?.(fresh);
      evaluate(fresh, authoritative);
    } catch (error) {
      patch({ phase: "pending", message: `Could not confirm the ${configRef.current.noun} state: ${error.message}`, retryAction: "check" });
    }
  }, [patch, evaluate]);

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
            intent = await configRef.current.requestIntent(file, { signal });
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
        patch({ previewUrl: finalizeInfoRef.current.previewUrl ?? null });
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
  }, [patch, confirmServerState]);

  const start = useCallback(
    (file) => {
      const problem = configRef.current.validate(file);
      if (problem) {
        patch({ ...INITIAL, phase: "failed", message: problem, retryAction: "choose" });
        return undefined;
      }
      fileRef.current = file;
      intentRef.current = null;
      putDoneRef.current = false;
      finalizeInfoRef.current = null;
      const current = resourceRef.current;
      const before = current ? configRef.current.read(current, null) : null;
      baselineRef.current = { ready: before?.storageStatus === "ready", uploadedAt: before?.uploadedAt ?? null };
      patch({ fileName: file.name, fileSize: file.size, previewUrl: null });
      return run();
    },
    [patch, run],
  );

  const retry = useCallback(() => {
    if (state.retryAction === "check") return confirmServerState(true);
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
