import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { ConfigError, buildCsp, readHostingConfig, renderHeaders } from '../../scripts/hosting/headers.mjs'
import { scanDist } from '../../scripts/hosting/scan-bundle.mjs'

const env = {
  VITE_API_URL: 'https://api.example.org',
  PUBLIC_MEDIA_ORIGIN: 'https://media.example.org',
  R2_S3_PRESIGN_ORIGIN: 'https://acct.r2.cloudflarestorage.com',
}

describe('hosting headers (RELEASE-04)', () => {
  it('renders CSP and security headers from the configured origins only', () => {
    const text = renderHeaders(readHostingConfig(env))
    const csp = buildCsp(readHostingConfig(env))
    expect(csp).toContain("connect-src 'self' https://api.example.org https://acct.r2.cloudflarestorage.com")
    expect(csp).toContain("img-src 'self' data: https://media.example.org https://acct.r2.cloudflarestorage.com")
    expect(csp).toContain("media-src 'self' https://media.example.org https://acct.r2.cloudflarestorage.com")
    expect(csp).toContain('frame-src https://www.youtube-nocookie.com;')
    expect(csp).toMatch(/script-src 'self';/)
    expect(csp).not.toMatch(/script-src[^;]*unsafe/)
    for (const directive of ["object-src 'none'", "base-uri 'self'", "form-action 'self'", "frame-ancestors 'none'", 'upgrade-insecure-requests']) expect(csp).toContain(directive)
    expect(csp).not.toContain('*')
    for (const header of ['Strict-Transport-Security', 'X-Content-Type-Options: nosniff', 'Referrer-Policy: strict-origin-when-cross-origin', 'Permissions-Policy']) expect(text).toContain(header)
    expect(text).toMatch(/\/assets\/\*\n {2}! Cache-Control\n {2}Cache-Control: public, max-age=31536000, immutable/)
    expect(text).toMatch(/\/\*\n(?: {2}.*\n)* {2}Cache-Control: no-cache/)
    expect(Math.max(...text.split('\n').map((line) => line.length))).toBeLessThan(2000) // Cloudflare _headers line limit
  })

  it('uses PUBLIC_API_ORIGIN, rejects a mismatch with the origin baked into the bundle', () => {
    expect(readHostingConfig({ ...env, VITE_API_URL: undefined, PUBLIC_API_ORIGIN: 'https://api2.example.org/' }).apiOrigin).toBe('https://api2.example.org')
    expect(() => readHostingConfig({ ...env, PUBLIC_API_ORIGIN: 'https://other.example.org' })).toThrow(/disagree/)
  })

  it.each([
    [{ VITE_API_URL: undefined }, /required/],
    [{ VITE_API_URL: 'https://api.example.org/api/v1' }, /origin only/],
    [{ VITE_API_URL: 'http://api.example.org' }, /https/],
    [{ VITE_API_URL: 'https://*.example.org' }, /wildcard/],
    [{ VITE_API_URL: 'https://user:pw@api.example.org' }, /credentials/],
    [{ PUBLIC_MEDIA_ORIGIN: undefined }, /PUBLIC_MEDIA_ORIGIN is required/],
    [{ PUBLIC_MEDIA_ORIGIN: 'https://pub-1234.r2.dev' }, /r2\.dev/],
    [{ R2_S3_PRESIGN_ORIGIN: '' }, /R2_S3_PRESIGN_ORIGIN is required/],
  ])('rejects invalid configuration %#', (override, message) => {
    expect(() => readHostingConfig({ ...env, ...override })).toThrow(ConfigError)
    expect(() => readHostingConfig({ ...env, ...override })).toThrow(message)
  })

  it('allows http localhost origins only when explicitly enabled and then omits HSTS/upgrade', () => {
    const local = { ...env, VITE_API_URL: 'http://127.0.0.1:8000' }
    expect(() => readHostingConfig(local)).toThrow(/https/)
    const text = renderHeaders(readHostingConfig({ ...local, HOSTING_ALLOW_INSECURE: '1' }))
    expect(text).not.toContain('Strict-Transport-Security')
    expect(text).not.toContain('upgrade-insecure-requests')
  })

  it('supports comma-separated S3 hosts, optional third parties and report-only', () => {
    const config = readHostingConfig({ ...env, R2_S3_PRESIGN_ORIGIN: 'https://a.r2.cloudflarestorage.com, https://b.a.r2.cloudflarestorage.com', PUBLIC_GOOGLE_FONTS_ENABLED: 'false', PUBLIC_PRAYER_API_ENABLED: 'false', CSP_REPORT_ONLY: 'true' })
    const text = renderHeaders(config)
    expect(text).toContain('Content-Security-Policy-Report-Only:')
    expect(text).toContain('https://b.a.r2.cloudflarestorage.com')
    expect(text).not.toContain('fonts.googleapis.com')
    expect(text).not.toContain('aladhan')
  })
})

describe('bundle secret scan (RELEASE-04)', () => {
  const dirs = []
  const dist = (files) => {
    const dir = mkdtempSync(join(tmpdir(), 'release04-scan-'))
    dirs.push(dir)
    mkdirSync(join(dir, 'assets'))
    for (const [name, content] of Object.entries(files)) writeFileSync(join(dir, name), content)
    return dir
  }
  afterEach(() => dirs.splice(0).forEach((dir) => rmSync(dir, { recursive: true, force: true })))

  it('passes ordinary code', () => {
    expect(scanDist(dist({ 'assets/app.js': 'const h = "Bearer " + token; fetch(`${base}/accounts/me/`)' }), {})).toEqual([])
  })

  it.each([
    ['RESEND_API_KEY="x"'],
    ['key="re_' + 'a1B2c3D4e5F6g7H8i9J0k1L2m3N4"'],
    ['const s = "R2_SECRET_ACCESS_KEY"'],
    ['"sk_live_' + 'abcdef1234567890"'],
    ['headers: {Authorization: "Bearer ' + 'abcdefghijklmnopqrstuvwxyz012345"}'],
    ['"-----BEGIN RSA PRIVATE KEY-----"'],
    ['AKIA' + 'ABCDEFGHIJKLMNOP'],
    ['postgres://admin:hunter2@db.example.org/app'],
    ['https://r2.example.org/k?X-Amz-Signature=' + '0123456789abcdef0123456789abcdef'],
  ])('flags %s', (content) => {
    expect(scanDist(dist({ 'assets/app.js': content }), {}).length).toBeGreaterThan(0)
  })

  it('flags secret-looking public build variables', () => {
    expect(scanDist(dist({}), { VITE_RESEND_TOKEN: 'x' })).toHaveLength(1)
    expect(scanDist(dist({}), { VITE_API_URL: 'https://a.example.org', VITE_GA_MEASUREMENT_ID: 'G-X' })).toEqual([])
  })
})
