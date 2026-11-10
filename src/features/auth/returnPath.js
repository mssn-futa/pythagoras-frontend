export const SIGN_IN_PATH = "/sign-in";
export const RETURN_PARAM = "next";

const AUTH_PAGES = new Set(["/sign-in", "/sign-up"]);

function hasControlCharacter(value) {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code < 0x20 || code === 0x7f) return true;
  }
  return false;
}

/**
 * Accepts only an in-app path ("/profile?tab=1#x"). Rejects absolute,
 * protocol-relative ("//host"), backslash, scheme ("javascript:") and
 * control-character values, and auth pages (which would loop). Returns the
 * normalized path or null.
 */
export function getSafeReturnPath(value) {
  if (typeof value !== "string" || value.length === 0 || value.length > 2048) return null;
  if (!value.startsWith("/") || value.startsWith("//")) return null;
  if (/[\\\s]/.test(value) || hasControlCharacter(value)) return null;
  let url;
  try {
    const origin = window.location.origin;
    url = new URL(value, origin);
    if (url.origin !== origin) return null;
  } catch {
    return null;
  }
  if (AUTH_PAGES.has(url.pathname.replace(/\/+$/, "") || "/")) return null;
  return `${url.pathname}${url.search}${url.hash}`;
}

/** Sign-in URL carrying a validated return destination, if any. */
export function buildSignInPath(location) {
  const target = location ? `${location.pathname}${location.search ?? ""}${location.hash ?? ""}` : "";
  const safe = getSafeReturnPath(target);
  if (!safe || safe === "/") return SIGN_IN_PATH;
  return `${SIGN_IN_PATH}?${new URLSearchParams({ [RETURN_PARAM]: safe })}`;
}
