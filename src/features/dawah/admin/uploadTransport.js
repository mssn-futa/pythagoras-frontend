/**
 * Direct browser → R2 PUT (D2 "R2 upload validation and delivery").
 *
 * This is deliberately NOT the shared Pythagoras API client: the presigned URL
 * is a bearer capability for the storage host, so no Authorization header, no
 * cookies and no refresh logic may ever ride along. XMLHttpRequest is used
 * because it exposes real byte-level upload progress.
 */

const FORBIDDEN_HEADERS = new Set(["authorization", "cookie", "proxy-authorization"]);

export class UploadTransportError extends Error {
  /** @param {'network'|'http'|'aborted'} kind */
  constructor(kind, { status = 0, message } = {}) {
    super(message ?? (kind === "network" ? "Could not reach the storage service." : `Storage responded with ${status}.`));
    this.name = "UploadTransportError";
    this.kind = kind;
    this.status = status;
  }
}

/** Only the headers the intent requires (Content-Type), minus credentials. */
export function safeUploadHeaders(headers = {}) {
  return Object.fromEntries(Object.entries(headers).filter(([name]) => !FORBIDDEN_HEADERS.has(name.toLowerCase())));
}

/**
 * PUT `file` to `uploadUrl`. Resolves `{ etag }`; rejects with UploadTransportError.
 * `onProgress(fraction)` is called only with measured values (0..1).
 */
export function putToSignedUrl({ uploadUrl, headers, file, onProgress, signal }) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", uploadUrl);
    xhr.withCredentials = false;
    for (const [name, value] of Object.entries(safeUploadHeaders(headers))) xhr.setRequestHeader(name, value);

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0) onProgress?.(Math.min(1, event.loaded / event.total));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress?.(1);
        resolve({ etag: xhr.getResponseHeader("ETag") });
      } else {
        reject(new UploadTransportError("http", { status: xhr.status }));
      }
    };
    // CORS rejection, DNS or connectivity loss all surface here with no detail.
    xhr.onerror = () => reject(new UploadTransportError("network"));
    xhr.ontimeout = () => reject(new UploadTransportError("network", { message: "The upload timed out." }));
    xhr.onabort = () => reject(new UploadTransportError("aborted", { message: "Upload cancelled." }));

    if (signal) {
      if (signal.aborted) return reject(new UploadTransportError("aborted", { message: "Upload cancelled." }));
      signal.addEventListener("abort", () => xhr.abort(), { once: true });
    }
    xhr.send(file);
  });
}
