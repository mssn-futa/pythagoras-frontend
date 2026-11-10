import { api, isDefinitiveRefreshRejection, pendingRefreshTokens, refreshSession } from "./axiosConfig.js";
import { clearSession, getAccessToken, getRefreshToken, hasStoredSession, setSessionTokens } from "./session.js";

/** D1 account endpoints. Payload mapping only; transport lives in axiosConfig. */
export const ACCOUNT_PATHS = {
  login: "/accounts/login/",
  register: "/accounts/register/",
  logout: "/accounts/logout/",
  me: "/accounts/me/",
};

export const PROFILE_EDITABLE_FIELDS = ["first_name", "last_name", "department", "level"];
export const LEVEL_OPTIONS = ["100", "200", "300", "400", "500"];

function trimmed(value) {
  return typeof value === "string" ? value.trim() : value;
}

/** Signs in with email or matric number. Stores tokens and resolves to the user. */
export async function login({ emailOrMatric, password }) {
  const data = await api.post(
    ACCOUNT_PATHS.login,
    { email_or_matric: trimmed(emailOrMatric), password },
    { public: true },
  );
  clearSession(); // new session generation: late results of any older session are discarded
  setSessionTokens({ access: data.tokens.access, refresh: data.tokens.refresh });
  return data.user;
}

/**
 * Direct registration (D1): names/email/password required; matric, department
 * and level optional and omitted when blank. Resolves to the created user.
 */
export async function register(values) {
  const payload = {
    email: trimmed(values.email),
    password: values.password,
    password_confirm: values.passwordConfirm,
    first_name: trimmed(values.firstName),
    last_name: trimmed(values.lastName),
  };
  for (const [key, value] of [
    ["matric_number", trimmed(values.matricNumber)],
    ["department", trimmed(values.department)],
    ["level", values.level],
  ]) {
    if (value) payload[key] = value;
  }
  return api.post(ACCOUNT_PATHS.register, payload, { public: true });
}

export function getCurrentUser(config) {
  return api.get(ACCOUNT_PATHS.me, config);
}

/** PATCH only the student-editable fields; anything else is dropped. */
export function updateProfile(changes) {
  const payload = {};
  for (const field of PROFILE_EDITABLE_FIELDS) {
    if (field in changes) payload[field] = trimmed(changes[field]) ?? "";
  }
  return api.patch(ACCOUNT_PATHS.me, payload);
}

/**
 * Revokes the refresh token server-side, then clears local state regardless.
 * The session is cleared FIRST (so an in-flight refresh cannot resurrect it
 * and pending requests are not retried), then any in-flight refresh is
 * awaited so the newest rotated refresh token is the one revoked.
 */
export async function logout() {
  let refresh = getRefreshToken();
  let access = getAccessToken();
  const pending = pendingRefreshTokens();
  clearSession();
  try {
    const rotated = pending ? await pending : null;
    if (rotated?.refresh) {
      refresh = rotated.refresh;
      access = rotated.access;
    }
    if (refresh) {
      await api.post(
        ACCOUNT_PATHS.logout,
        { refresh },
        { skipAuthRefresh: true, headers: access ? { Authorization: `Bearer ${access}` } : {} },
      );
    }
  } catch {
    // Local sign-out must not depend on the API; the token expires server-side.
  } finally {
    clearSession();
  }
}

/** Session-restoration failure that left the stored session intact. */
export class SessionRestoreError extends Error {
  constructor(cause) {
    super(cause?.message || "Unable to restore your session.");
    this.name = "SessionRestoreError";
    this.cause = cause;
    this.status = cause?.status ?? 0;
  }
}

let restoreInFlight = null;

/**
 * Restores a session after reload: refresh → current user. Resolves to the
 * user, or null when there is no stored session or the session is definitively
 * invalid (refresh rejected 400/401/403, or current user 401/403; the session
 * is then cleared). Transient failures (network, 429, 5xx) keep the tokens and
 * reject with SessionRestoreError so the UI can offer a retry. Concurrent
 * callers share one attempt.
 */
export function restoreSession() {
  if (!hasStoredSession()) return Promise.resolve(null);
  if (restoreInFlight) return restoreInFlight;
  restoreInFlight = (async () => {
    try {
      await refreshSession();
    } catch (error) {
      if (isDefinitiveRefreshRejection(error)) return null; // already cleared
      throw new SessionRestoreError(error);
    }
    try {
      return await getCurrentUser({ skipAuthRefresh: true });
    } catch (error) {
      if (error?.status === 401 || error?.status === 403) {
        clearSession();
        return null;
      }
      throw new SessionRestoreError(error);
    }
  })().finally(() => {
    restoreInFlight = null;
  });
  return restoreInFlight;
}
