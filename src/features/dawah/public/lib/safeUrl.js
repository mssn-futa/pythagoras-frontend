/**
 * Defensive validation of server-supplied file/image URLs (D2: documents and
 * featured images are served from a validated public HTTPS media URL; signed
 * capability URLs, credentials and non-https schemes are never public data).
 * Returns the normalised URL string, or null when the value must not be used.
 */
export function safePublicUrl(value) {
  if (typeof value !== 'string' || value.trim() !== value || !value) return null
  let parsed
  try {
    parsed = new URL(value)
  } catch {
    return null
  }
  if (parsed.protocol !== 'https:' || !parsed.hostname || parsed.username || parsed.password) return null
  // The S3 API host only ever serves presigned (bearer-capability) URLs; public media uses the custom media domain.
  if (/(^|\.)r2\.cloudflarestorage\.com$/i.test(parsed.hostname)) return null
  // A presigned/signed URL is a temporary bearer capability and must never be a public link.
  for (const key of parsed.searchParams.keys()) {
    if (/^x-amz-/i.test(key) || /^(signature|sig|token|access_token)$/i.test(key)) return null
  }
  return parsed.href
}
