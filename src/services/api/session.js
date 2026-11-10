/**
 * Session token storage (D0 session policy).
 *
 * - The access token lives only in module memory: it is lost on reload and is
 *   recovered by exchanging the refresh token.
 * - The refresh token lives in sessionStorage (per tab, cleared when the tab
 *   closes). This is a release engineering choice, not an HttpOnly cookie:
 *   any script running in the page (XSS) can read it. See docs/frontend-client.md.
 * - Passwords are never stored.
 */

export const REFRESH_STORAGE_KEY = "pythagoras.refreshToken";

let accessToken = null;
const listeners = new Set();

function storage() {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export function getAccessToken() {
  return accessToken;
}

export function getRefreshToken() {
  try {
    return storage()?.getItem(REFRESH_STORAGE_KEY) || null;
  } catch {
    return null;
  }
}

export function hasStoredSession() {
  return Boolean(getRefreshToken());
}

export function setSessionTokens({ access, refresh }) {
  accessToken = access || null;
  try {
    if (refresh) storage()?.setItem(REFRESH_STORAGE_KEY, refresh);
  } catch {
    // Storage unavailable (private mode/quota): the session lasts for this page only.
  }
}

export function clearSession() {
  accessToken = null;
  try {
    storage()?.removeItem(REFRESH_STORAGE_KEY);
  } catch {
    // Nothing persisted to clear.
  }
}

/** Subscribe to forced sign-out (refresh failure). Returns an unsubscribe function. */
export function onSessionEnded(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function notifySessionEnded(reason = "expired") {
  for (const listener of [...listeners]) listener(reason);
}
