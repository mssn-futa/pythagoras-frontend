import { api, refreshSession } from "./axiosConfig.js";
import { clearSession, getRefreshToken, hasStoredSession, setSessionTokens } from "./session.js";

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

export function getCurrentUser() {
  return api.get(ACCOUNT_PATHS.me);
}

/** PATCH only the student-editable fields; anything else is dropped. */
export function updateProfile(changes) {
  const payload = {};
  for (const field of PROFILE_EDITABLE_FIELDS) {
    if (field in changes) payload[field] = trimmed(changes[field]) ?? "";
  }
  return api.patch(ACCOUNT_PATHS.me, payload);
}

/** Revokes the refresh token server-side, then clears local state regardless. */
export async function logout() {
  const refresh = getRefreshToken();
  try {
    if (refresh) await api.post(ACCOUNT_PATHS.logout, { refresh }, { skipAuthRefresh: true });
  } catch {
    // Local sign-out must not depend on the API; the token expires server-side.
  } finally {
    clearSession();
  }
}

let restoreInFlight = null;

/**
 * Restores a session after reload: refresh → current user. Resolves to the
 * user, or null when there is no stored session or restoration failed (the
 * session is then cleared). Concurrent callers share one attempt.
 */
export function restoreSession() {
  if (!hasStoredSession()) return Promise.resolve(null);
  if (restoreInFlight) return restoreInFlight;
  restoreInFlight = refreshSession()
    .then(() => getCurrentUser())
    .catch(() => {
      clearSession();
      return null;
    })
    .finally(() => {
      restoreInFlight = null;
    });
  return restoreInFlight;
}
