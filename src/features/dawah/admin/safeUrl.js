/**
 * Returns the normalised URL only for a plain https URL without userinfo; otherwise null.
 * Unlike the public guard this deliberately ALLOWS signed query strings: it is used for the
 * admin-only short-lived preview_url, which is a signed capability. It is never for public links.
 */
export function safeHttpsUrl(value) {
  if (typeof value !== "string") return null;
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    return null;
  }
  return parsed.protocol === "https:" && !parsed.username && !parsed.password ? parsed.href : null;
}
