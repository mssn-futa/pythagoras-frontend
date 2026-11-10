/** Returns the URL string only for a plain https URL (no userinfo, no signature query); otherwise null. */
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
