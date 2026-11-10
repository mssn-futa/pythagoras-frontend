import axios from "axios";
import {
  clearSession,
  getAccessToken,
  getRefreshToken,
  getSessionGeneration,
  notifySessionEnded,
  setSessionTokens,
} from "./session.js";

/**
 * The one shared Pythagoras API client (D0 "Frontend client and route
 * convention"). Domain services import `api` (or `apiClient`) from
 * `src/services/api` and never add their own token interceptors.
 *
 * Per-request options (passed in the axios config object):
 * - `public: true`          no bearer header and never refreshes on 401.
 * - `skipAuthRefresh: true` sends the bearer header (if any) but never
 *                           refreshes/retries on 401 (used by logout).
 */

export const REFRESH_PATH = "/accounts/refresh/";

const DEFAULT_MESSAGES = {
  0: "Unable to reach the server. Check your connection and try again.",
  400: "Correct the highlighted fields.",
  401: "Your session has ended. Sign in again.",
  403: "You do not have permission to do that.",
  404: "The requested item was not found.",
  409: "This change conflicts with the current state. Refresh and try again.",
  429: "Too many attempts. Wait a moment and try again.",
  503: "The service is temporarily unavailable. Try again shortly.",
};

const DEFAULT_CODES = {
  0: "NETWORK_ERROR",
  400: "VALIDATION_ERROR",
  401: "NOT_AUTHENTICATED",
  403: "PERMISSION_DENIED",
  404: "NOT_FOUND",
  409: "CONFLICT",
  429: "THROTTLED",
  503: "SERVICE_UNAVAILABLE",
};

/** Backend origin from VITE_API_URL, without a trailing slash or invented prefix. */
export function getApiBaseUrl() {
  const raw = import.meta.env.VITE_API_URL;
  return typeof raw === "string" ? raw.trim().replace(/\/+$/, "") : "";
}

/** Typed error every client call rejects with: {status, code, message, fields}. */
export class ApiError extends Error {
  constructor({ status = 0, code, message, fields = {}, retryAfter = null } = {}) {
    super(message || DEFAULT_MESSAGES[status] || "Something went wrong. Try again.");
    this.name = "ApiError";
    this.status = status;
    this.code = code || DEFAULT_CODES[status] || (status >= 500 ? "SERVER_ERROR" : "REQUEST_FAILED");
    this.fields = fields;
    this.retryAfter = retryAfter;
  }
}

export function isApiError(error) {
  return error instanceof ApiError;
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isEnvelope(body) {
  return isPlainObject(body) && typeof body.success === "boolean" && "data" in body;
}

/** Field errors as {field: [messages]}; tolerates string or nested values. */
export function normalizeFieldErrors(fields) {
  if (!isPlainObject(fields)) return {};
  const result = {};
  for (const [name, value] of Object.entries(fields)) {
    const messages = (Array.isArray(value) ? value : [value])
      .flatMap((item) => (isPlainObject(item) ? Object.values(item).flat() : [item]))
      .filter((item) => item !== null && item !== undefined && item !== "")
      .map(String);
    if (messages.length) result[name] = messages;
  }
  return result;
}

function parseRetryAfter(headers) {
  const value = headers?.["retry-after"] ?? headers?.get?.("retry-after");
  const seconds = Number.parseInt(value, 10);
  return Number.isFinite(seconds) ? seconds : null;
}

/** Converts any axios/transport failure into an ApiError. Never includes tokens. */
export function normalizeApiError(error) {
  if (isApiError(error)) return error;
  const response = error?.response;
  if (!response) {
    const timedOut = error?.code === "ECONNABORTED" || error?.code === "ETIMEDOUT";
    return new ApiError({
      status: 0,
      code: timedOut ? "TIMEOUT" : "NETWORK_ERROR",
      message: timedOut ? "The server took too long to respond. Try again." : DEFAULT_MESSAGES[0],
    });
  }
  const { status } = response;
  const body = response.data;
  let code;
  let message;
  let fields = {};
  if (isEnvelope(body)) {
    const data = isPlainObject(body.data) ? body.data : {};
    code = typeof data.code === "string" ? data.code : undefined;
    fields = normalizeFieldErrors(data.fields);
    message = typeof body.message === "string" && body.message ? body.message : undefined;
  } else if (isPlainObject(body)) {
    // Un-enveloped DRF/proxy error: keep a readable detail, never raw HTML.
    if (typeof body.detail === "string") message = body.detail;
    if (typeof body.code === "string") code = body.code;
  }
  return new ApiError({ status, code, message, fields, retryAfter: parseRetryAfter(response.headers) });
}

/**
 * Unwraps the D0 success envelope exactly once: response.data becomes the
 * envelope's `data`, response.message its message. 204/empty bodies become null.
 * Non-envelope bodies (e.g. files) pass through untouched.
 */
function unwrapEnvelope(response) {
  const body = response.data;
  if (response.status === 204 || body === "" || body === undefined) {
    response.data = null;
    response.message = "";
    return response;
  }
  if (isEnvelope(body)) {
    if (!body.success) {
      throw new ApiError({
        status: response.status,
        code: body.data?.code,
        message: body.message,
        fields: normalizeFieldErrors(body.data?.fields),
      });
    }
    response.data = body.data;
    response.message = typeof body.message === "string" ? body.message : "";
  }
  return response;
}

export const apiClient = axios.create({
  timeout: 30_000,
  headers: { Accept: "application/json" },
});

apiClient.interceptors.request.use((config) => {
  config.baseURL = config.baseURL ?? getApiBaseUrl();
  const token = config.public ? null : getAccessToken();
  if (token) {
    config.headers.set("Authorization", `Bearer ${token}`);
  } else if (config.public) {
    config.headers.delete("Authorization");
  }
  config._accessTokenUsed = token;
  config._sessionGeneration = getSessionGeneration();
  return config;
});

/**
 * Only a definitive answer from /accounts/refresh/ (400/401/403) ends the
 * session. Network/timeout (status 0), 429 and 5xx are transient: tokens are
 * kept and the caller receives the normalized error.
 */
export function isDefinitiveRefreshRejection(error) {
  return [400, 401, 403].includes(error?.status);
}

function sessionEndedError() {
  return new ApiError({ status: 401, code: "SESSION_EXPIRED" });
}

let refreshInFlight = null;

/**
 * Exchanges the stored refresh token for a rotated pair. Concurrent callers in
 * the same session generation share ONE in-flight request. A result that
 * arrives after the session was cleared (logout) is discarded. A definitive
 * rejection clears the session and signals sign-out; transient failures keep
 * the tokens. Rejects with an ApiError.
 */
export function refreshSession() {
  const generation = getSessionGeneration();
  if (refreshInFlight && refreshInFlight.generation === generation) return refreshInFlight.result;
  const refresh = getRefreshToken();
  if (!refresh) {
    endSession("expired");
    return Promise.reject(sessionEndedError());
  }
  const raw = apiClient.post(REFRESH_PATH, { refresh }, { public: true }).then((response) => {
    const tokens = response.data;
    if (!tokens?.access) throw new ApiError({ status: 401, code: "TOKEN_NOT_VALID" });
    return { access: tokens.access, refresh: tokens.refresh || refresh };
  });
  const result = raw.then(
    (tokens) => {
      if (getSessionGeneration() !== generation) throw sessionEndedError();
      setSessionTokens(tokens);
      return tokens.access;
    },
    (error) => {
      const normalized = normalizeApiError(error);
      if (isDefinitiveRefreshRejection(normalized) && getSessionGeneration() === generation) {
        endSession("expired");
      }
      throw normalized;
    },
  );
  const entry = { generation, raw, result };
  refreshInFlight = entry;
  result
    .finally(() => {
      if (refreshInFlight === entry) refreshInFlight = null;
    })
    .catch(() => {});
  return result;
}

/**
 * The raw rotated pair of the refresh currently in flight (or null). Logout
 * awaits it so it can revoke the newest refresh token even though the result
 * is no longer applied to the cleared session.
 */
export function pendingRefreshTokens() {
  return refreshInFlight ? refreshInFlight.raw.catch(() => null) : null;
}

function endSession(reason) {
  const hadSession = Boolean(getAccessToken() || getRefreshToken());
  clearSession();
  if (hadSession) notifySessionEnded(reason);
}

async function retryAfterAuthFailure(error) {
  const config = error?.config;
  const eligible =
    error?.response?.status === 401 &&
    config &&
    !config.public &&
    !config.skipAuthRefresh;
  if (!eligible) throw normalizeApiError(error);

  // The session this request was sent under has ended (logout/sign-out):
  // never retry it with another session's credentials.
  if (config._sessionGeneration !== getSessionGeneration()) throw normalizeApiError(error);

  if (config._authRetried) {
    // A request already retried with a fresh token was still rejected: stop.
    endSession("expired");
    throw normalizeApiError(error);
  }
  config._authRetried = true;

  const current = getAccessToken();
  if (current && current !== config._accessTokenUsed) {
    // Another request refreshed while this one was in flight; reuse its token.
    return apiClient(config);
  }
  if (!getRefreshToken()) {
    endSession("expired");
    throw normalizeApiError(error);
  }
  const generation = config._sessionGeneration;
  try {
    await refreshSession();
  } catch (refreshError) {
    if (isDefinitiveRefreshRejection(refreshError)) throw sessionEndedError();
    throw refreshError;
  }
  if (getSessionGeneration() !== generation) throw sessionEndedError();
  return apiClient(config);
}

apiClient.interceptors.response.use(unwrapEnvelope, retryAfterAuthFailure);

async function send(config) {
  const response = await apiClient.request(config);
  return response.data;
}

/** Convenience methods resolving to the unwrapped envelope `data`. */
export const api = {
  request: send,
  get: (url, config = {}) => send({ ...config, method: "get", url }),
  delete: (url, config = {}) => send({ ...config, method: "delete", url }),
  post: (url, data, config = {}) => send({ ...config, method: "post", url, data }),
  put: (url, data, config = {}) => send({ ...config, method: "put", url, data }),
  patch: (url, data, config = {}) => send({ ...config, method: "patch", url, data }),
};

export default api;
