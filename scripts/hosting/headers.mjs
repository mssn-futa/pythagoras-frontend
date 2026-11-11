/*
 * Renders the Cloudflare Workers Static Assets `_headers` file from build-time
 * origin configuration (RELEASE-04, D5 "Deployment and origins"). Nothing here
 * is a secret: every value is a public origin that the browser already sees.
 * No hostname is hard-coded except the two third-party hosts the app uses today
 * (Google Fonts, and the Aladhan prayer-times API only when explicitly enabled), which have env switches.
 */

export const YOUTUBE_EMBED_ORIGIN = 'https://www.youtube-nocookie.com'
const FONT_STYLE_ORIGIN = 'https://fonts.googleapis.com'
const FONT_FILE_ORIGIN = 'https://fonts.gstatic.com'
const DEFAULT_PRAYER_API_ORIGIN = 'https://api.aladhan.com'

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
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
  if (url.protocol !== 'https:' && !(allowInsecure && url.protocol === 'http:' && local)) {
    throw new ConfigError(`${name} must be https (http is only accepted for localhost with HOSTING_ALLOW_INSECURE=1): ${raw}`)
  }
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
    reportOnly: flag(env.CSP_REPORT_ONLY, false),
    allowInsecure,
  }
}

const unique = (values) => [...new Set(values)]

export function buildCsp(config) {
  const connect = unique(["'self'", config.apiOrigin, ...config.presignOrigins, ...(config.prayerApiOrigin ? [config.prayerApiOrigin] : []), ...config.extraConnectOrigins])
  const directives = {
    'default-src': ["'self'"],
    'script-src': ["'self'"],
    // 'unsafe-inline' is for styles only (never scripts). Needed by (a) the Tiptap/ProseMirror editor, which injects
    // a <style> element at runtime, and (b) srcdoc email previews, which inherit this policy and render server HTML
    // with inline style attributes. Measured with tests/hosting/csp.spec.js; see docs/frontend-hosting.md.
    'style-src': unique(["'self'", "'unsafe-inline'", ...(config.googleFonts ? [FONT_STYLE_ORIGIN] : [])]),
    'font-src': unique(["'self'", ...(config.googleFonts ? [FONT_FILE_ORIGIN] : [])]),
    'img-src': unique(["'self'", 'data:', config.mediaOrigin, ...config.presignOrigins]),
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
