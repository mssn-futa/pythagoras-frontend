/*
 * Renders the Cloudflare Workers Static Assets `_headers` file from build-time
 * origin configuration (RELEASE-04, D5 "Deployment and origins"). Nothing here
 * is a secret: every value is a public origin that the browser already sees.
 * No hostname is hard-coded except the third-party hosts the app uses (Google Fonts, the Aladhan
 * prayer-times API only when explicitly enabled, and GA4 only when a measurement ID is configured),
 * which have env switches.
 */

export const YOUTUBE_EMBED_ORIGIN = 'https://www.youtube-nocookie.com'
const FONT_STYLE_ORIGIN = 'https://fonts.googleapis.com'
const FONT_FILE_ORIGIN = 'https://fonts.gstatic.com'
const DEFAULT_PRAYER_API_ORIGIN = 'https://api.aladhan.com'

/*
 * GA4 via gtag.js (PLAT-08), only when VITE_GA_MEASUREMENT_ID is set. Exact hosts, no wildcards (D5).
 * Google's CSP guide (developers.google.com/tag-platform/security/guides/csp, "without Ads features") lists
 * www.googletagmanager.com for scripts and *.google-analytics.com / *.analytics.google.com for hits; the
 * wildcards exist for regional endpoints, so the documented regional hosts are listed one by one. Google
 * signals and ads personalization are disabled in code and in the property, so no doubleclick/google.com hosts.
 * The script loads only after consent (src/features/analytics); the CSP allowance alone sends nothing.
 */
export const GA_SCRIPT_ORIGIN = 'https://www.googletagmanager.com'
export const GA_COLLECT_ORIGINS = Object.freeze(['https://www.google-analytics.com', 'https://region1.google-analytics.com', 'https://region1.analytics.google.com'])
const GA_MEASUREMENT_ID = /^G-[A-Z0-9]{4,20}$/

export class ConfigError extends Error {}

/** Normalises one origin: scheme://host[:port], no path/query/credentials/wildcards. */
export function parseOrigin(name, value, { allowInsecure = false } = {}) {
  const raw = String(value ?? '').trim()
  if (!raw) throw new ConfigError(`${name} is empty`)
  if (raw.includes('*')) throw new ConfigError(`${name} must not contain a wildcard`)
  let url
  try {
    url = new URL(raw)
  } catch {
    throw new ConfigError(`${name} is not a valid origin: ${raw}`)
  }
  if (url.username || url.password) throw new ConfigError(`${name} must not contain credentials`)
  if (url.search || url.hash || (url.pathname !== '/' && url.pathname !== '')) {
    throw new ConfigError(`${name} must be an origin only (no path, query or fragment; no /api/v1 prefix): ${raw}`)
  }
  // Only characters that can appear in scheme://host[:port]; rejects ; % , quotes, spaces and newlines that could inject directives.
  if (!/^https?:\/\/[A-Za-z0-9.:[\]-]+\/?$/.test(raw)) throw new ConfigError(`${name} contains characters that are not valid in an origin: ${JSON.stringify(raw)}`)
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
  if (url.protocol !== 'https:' && !(allowInsecure && url.protocol === 'http:' && local)) {
    throw new ConfigError(`${name} must be https (http is only accepted for localhost with HOSTING_ALLOW_INSECURE=1): ${raw}`)
  }
  const dnsName = /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(url.hostname) && !/^[0-9.]+$/.test(url.hostname)
  if (!dnsName && !(allowInsecure && local)) throw new ConfigError(`${name} must use a DNS hostname (no IP address, trailing dot or odd characters): ${raw}`)
  return url.origin
}

function parseOriginList(name, value, options) {
  return String(value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => parseOrigin(name, item, options))
}

const flag = (value, fallback) => (value === undefined || value === '' ? fallback : ['1', 'true', 'yes'].includes(String(value).toLowerCase()))

/** GA4 is on exactly when the bundle has a measurement ID; PUBLIC_GA_ENABLED may only confirm that, never contradict it. */
function readAnalytics(env) {
  const measurementId = String(env.VITE_GA_MEASUREMENT_ID ?? '').trim().toUpperCase()
  if (measurementId && !GA_MEASUREMENT_ID.test(measurementId)) {
    throw new ConfigError(`VITE_GA_MEASUREMENT_ID must be a GA4 measurement ID like G-XXXXXXXXXX: ${JSON.stringify(env.VITE_GA_MEASUREMENT_ID)}`)
  }
  const enabled = flag(env.PUBLIC_GA_ENABLED, Boolean(measurementId))
  if (enabled && !measurementId) throw new ConfigError('PUBLIC_GA_ENABLED is set but VITE_GA_MEASUREMENT_ID is empty: the bundle would have analytics off')
  if (!enabled && measurementId) throw new ConfigError('VITE_GA_MEASUREMENT_ID is set but PUBLIC_GA_ENABLED is false: the bundle would load a tag the CSP blocks')
  return enabled ? { measurementId } : null
}

/** Reads the public hosting configuration from an env-like object. */
export function readHostingConfig(env) {
  const allowInsecure = flag(env.HOSTING_ALLOW_INSECURE, false)
  const options = { allowInsecure }
  const api = env.PUBLIC_API_ORIGIN?.trim() || env.VITE_API_URL?.trim()
  if (!api) throw new ConfigError('PUBLIC_API_ORIGIN (or VITE_API_URL) is required')
  const apiOrigin = parseOrigin('PUBLIC_API_ORIGIN', api, options)
  if (env.VITE_API_URL?.trim() && env.PUBLIC_API_ORIGIN?.trim()) {
    const built = parseOrigin('VITE_API_URL', env.VITE_API_URL, options)
    if (built !== apiOrigin) {
      throw new ConfigError(`VITE_API_URL (${built}) and PUBLIC_API_ORIGIN (${apiOrigin}) disagree: the bundle would call an origin the CSP blocks`)
    }
  }
  if (!env.PUBLIC_MEDIA_ORIGIN?.trim()) throw new ConfigError('PUBLIC_MEDIA_ORIGIN is required (R2 public custom domain, not r2.dev)')
  const mediaOrigin = parseOrigin('PUBLIC_MEDIA_ORIGIN', env.PUBLIC_MEDIA_ORIGIN, options)
  if (/(^|\.)r2\.dev$/i.test(new URL(mediaOrigin).hostname)) throw new ConfigError('PUBLIC_MEDIA_ORIGIN must be a custom domain, not public r2.dev (D5)')
  const presignOrigins = parseOriginList('R2_S3_PRESIGN_ORIGIN', env.R2_S3_PRESIGN_ORIGIN, options)
  if (presignOrigins.length === 0) throw new ConfigError('R2_S3_PRESIGN_ORIGIN is required (S3 endpoint host that receives the browser PUT; comma-separate bucket-style hosts)')
  return {
    apiOrigin,
    mediaOrigin,
    presignOrigins,
    prayerApiOrigin: flag(env.PUBLIC_PRAYER_API_ENABLED, false)
      ? parseOrigin('PUBLIC_PRAYER_API_ORIGIN', env.PUBLIC_PRAYER_API_ORIGIN?.trim() || DEFAULT_PRAYER_API_ORIGIN, options)
      : null,
    googleFonts: flag(env.PUBLIC_GOOGLE_FONTS_ENABLED, true),
    extraConnectOrigins: parseOriginList('PUBLIC_EXTRA_CONNECT_ORIGINS', env.PUBLIC_EXTRA_CONNECT_ORIGINS, options),
    analytics: readAnalytics(env),
    reportOnly: flag(env.CSP_REPORT_ONLY, false),
    allowInsecure,
  }
}

const unique = (values) => [...new Set(values)]

export function buildCsp(config) {
  const ga = config.analytics ? [GA_SCRIPT_ORIGIN, ...GA_COLLECT_ORIGINS] : []
  const connect = unique(["'self'", config.apiOrigin, ...config.presignOrigins, ...(config.prayerApiOrigin ? [config.prayerApiOrigin] : []), ...ga, ...config.extraConnectOrigins])
  const directives = {
    'default-src': ["'self'"],
    // gtag.js is an external script (no inline snippet), so 'unsafe-inline' stays out of script-src.
    'script-src': unique(["'self'", ...(config.analytics ? [GA_SCRIPT_ORIGIN] : [])]),
    // 'unsafe-inline' is for styles only (never scripts). Needed by (a) the Tiptap/ProseMirror editor, which injects
    // a <style> element at runtime, and (b) srcdoc email previews, which inherit this policy and render server HTML
    // with inline style attributes. Measured with tests/hosting/csp.spec.js; see docs/frontend-hosting.md.
    'style-src': unique(["'self'", "'unsafe-inline'", ...(config.googleFonts ? [FONT_STYLE_ORIGIN] : [])]),
    'font-src': unique(["'self'", ...(config.googleFonts ? [FONT_FILE_ORIGIN] : [])]),
    'img-src': unique(["'self'", 'data:', config.mediaOrigin, ...config.presignOrigins, ...ga]),
    'media-src': unique(["'self'", config.mediaOrigin, ...config.presignOrigins]),
    'connect-src': connect,
    'frame-src': [YOUTUBE_EMBED_ORIGIN],
    'object-src': ["'none'"],
    'base-uri': ["'self'"],
    'form-action': ["'self'"],
    'frame-ancestors': ["'none'"],
    'manifest-src': ["'self'"],
    'worker-src': ["'none'"],
  }
  const parts = Object.entries(directives).map(([name, values]) => `${name} ${values.join(' ')}`)
  if (!config.allowInsecure) parts.push('upgrade-insecure-requests')
  return parts.join('; ')
}

// Prayer times (the only geolocation user) are hidden in Phase 1 (D0), so geolocation is off unless the prayer API is enabled.
export const permissionsPolicy = (config) => [
  'accelerometer=()', 'autoplay=(self "' + YOUTUBE_EMBED_ORIGIN + '")', 'camera=()', 'display-capture=()', `geolocation=${config.prayerApiOrigin ? '(self)' : '()'}`, 'gyroscope=()',
  'magnetometer=()', 'microphone=()', 'midi=()', 'payment=()', 'usb=()', 'serial=()', 'hid=()', 'interest-cohort=()',
].join(', ')

export function renderHeaders(config) {
  const cspName = config.reportOnly ? 'Content-Security-Policy-Report-Only' : 'Content-Security-Policy'
  const lines = [
    '# Generated by scripts/hosting/render-headers.mjs at build time. Do not edit or commit.',
    '# Cloudflare Workers Static Assets _headers; values come from PUBLIC_* build env (see docs/frontend-hosting.md).',
    '/*',
    `  ${cspName}: ${buildCsp(config)}`,
    ...(config.allowInsecure ? [] : ['  Strict-Transport-Security: max-age=31536000; includeSubDomains']),
    '  X-Content-Type-Options: nosniff',
    '  X-Frame-Options: DENY',
    '  Referrer-Policy: strict-origin-when-cross-origin',
    `  Permissions-Policy: ${permissionsPolicy(config)}`,
    // index.html and every SPA-fallback deep link revalidate; fingerprinted assets override below.
    '  Cache-Control: no-cache',
    '',
    '/assets/*',
    '  ! Cache-Control',
    '  Cache-Control: public, max-age=31536000, immutable',
    '',
  ]
  return lines.join('\n')
}
