#!/usr/bin/env node
/*
 * Fails when the built bundle (or the build environment) could carry a server/provider secret.
 * Usage: node scripts/hosting/scan-bundle.mjs [distDir]
 */
import { existsSync, readdirSync, readFileSync, realpathSync, statSync } from 'node:fs'
import { join, resolve, relative, extname } from 'node:path'
import { pathToFileURL } from 'node:url'
import { loadBuildEnv } from './env.mjs'

export const PATTERNS = [
  { name: 'Resend setting or key', re: /RESEND_[A-Z_]+|\bre_[A-Za-z0-9]{24,}\b/ },
  { name: 'R2/S3 credential name', re: /R2_(?:SECRET|ACCESS_KEY)[A-Z_]*|AWS_SECRET_ACCESS_KEY|SECRET_ACCESS_KEY|secretAccessKey/ },
  { name: 'AWS access key id', re: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/ },
  { name: 'Stripe-style secret key', re: /\bsk_(?:live|test)_[A-Za-z0-9]{8,}/ },
  { name: 'Authorization Bearer literal', re: /Bearer\s+[A-Za-z0-9\-._~+/]{20,}=*/ },
  { name: 'JWT literal', re: /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/ },
  { name: 'Private key block', re: /-----BEGIN (?:[A-Z]+ )?PRIVATE KEY-----/ },
  { name: 'Django/database/cloud secret setting', re: /\b(?:DJANGO_SECRET_KEY|SECRET_KEY|DATABASE_URL|CLOUDFLARE_API_TOKEN|CF_API_TOKEN)\b/ },
  { name: 'Database URL with credentials', re: /\bpostgres(?:ql)?:\/\/[^\s:@/]+:[^\s@/]+@/ },
  { name: 'Presigned URL signature', re: /X-Amz-Signature=[0-9a-f]{32,}/i },
  { name: 'Cloudflare API token', re: /\bcf(?:ut|at|k)_[A-Za-z0-9]{30,}/ },
  { name: 'R2/S3 key-like hex near credential context', re: /(?:\br2\b|access[_-]?key|secret|credential)[^\n]{0,40}?["'`:= ]+(?:[0-9a-f]{64}|[0-9a-f]{32})\b/i },
  { name: 'GitHub token', re: /\bgh[pousr]_[A-Za-z0-9]{30,}\b/ },
]

const TEXT = new Set(['.js', '.mjs', '.css', '.html', '.json', '.map', '.svg', '.txt', '.webmanifest', ''])
const SECRETISH_VITE = /^VITE_.*(KEY|SECRET|TOKEN|PASSWORD|PRIVATE|SIGNING|CREDENTIAL)/i
const ENV_FILES = ['.env', '.env.local', '.env.production', '.env.production.local']

export function listFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name)
    return entry.isDirectory() ? listFiles(full) : [full]
  })
}

function scanText(file, text, findings) {
  for (const { name, re } of PATTERNS) {
    const match = re.exec(text)
    if (match) findings.push({ file, rule: name, sample: `${match[0].slice(0, 6)}… (${match[0].length} chars)` })
  }
}

/** Scans the Vite-visible .env files of `cwd`: secret-looking VITE_* names (embedded in the bundle) and secret values. */
export function scanEnvFiles(cwd, findings = []) {
  for (const name of ENV_FILES) {
    const file = join(cwd, name)
    if (!existsSync(file)) continue
    const text = readFileSync(file, 'utf8')
    for (const line of text.split('\n')) {
      const key = /^\s*(?:export\s+)?(VITE_[A-Za-z0-9_]*)\s*=/.exec(line)?.[1]
      if (key && SECRETISH_VITE.test(key)) findings.push({ file: name, rule: `public build variable ${key} looks like a secret; VITE_* values are embedded in the bundle` })
    }
    scanText(name, text, findings)
  }
  return findings
}

export function scanDist(dist, env = process.env, { cwd } = {}) {
  const findings = []
  for (const name of Object.keys(env)) {
    if (SECRETISH_VITE.test(name)) findings.push({ file: '(build env)', rule: `public build variable ${name} looks like a secret; VITE_* values are embedded in the bundle` })
  }
  if (cwd) scanEnvFiles(cwd, findings)
  const files = listFiles(dist)
  if (files.length === 0) findings.push({ file: dist, rule: 'no files to scan (empty dist)' })
  let scanned = 0
  for (const file of files) {
    if (!TEXT.has(extname(file).toLowerCase()) || statSync(file).size > 20 * 1024 * 1024) continue
    scanned += 1
    scanText(relative(dist, file), readFileSync(file, 'utf8'), findings)
  }
  if (files.length > 0 && scanned === 0) findings.push({ file: dist, rule: 'no text files were scanned' })
  return findings
}

export const isMain = (argv1 = process.argv[1]) => Boolean(argv1) && import.meta.url === pathToFileURL(realpathSync(argv1)).href

if (isMain()) {
  const dist = resolve(process.argv[2] ?? 'dist')
  if (!existsSync(dist)) {
    console.error(`scan-bundle: ${dist} does not exist; run the build first`)
    process.exit(1)
  }
  const findings = scanDist(dist, await loadBuildEnv(), { cwd: process.cwd() })
  if (findings.length) {
    for (const f of findings) console.error(`scan-bundle: ${f.file}: ${f.rule}${f.sample ? ` [${f.sample}]` : ''}`)
    console.error(`scan-bundle: FAILED with ${findings.length} finding(s)`)
    process.exit(1)
  }
  console.log(`scan-bundle: ok (${listFiles(dist).length} files scanned in ${dist})`)
}
