#!/usr/bin/env node
/*
 * Fails when the built bundle (or the build environment) could carry a server/provider secret.
 * Usage: node scripts/hosting/scan-bundle.mjs [distDir]
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, resolve, relative, extname } from 'node:path'

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
  { name: 'GitHub token', re: /\bgh[pousr]_[A-Za-z0-9]{30,}\b/ },
]

const TEXT = new Set(['.js', '.mjs', '.css', '.html', '.json', '.map', '.svg', '.txt', '.webmanifest', ''])
const SECRETISH_VITE = /^VITE_.*(SECRET|TOKEN|PASSWORD|PRIVATE|CREDENTIAL|API_KEY|ACCESS_KEY)/i

export function listFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name)
    return entry.isDirectory() ? listFiles(full) : [full]
  })
}

export function scanDist(dist, env = process.env) {
  const findings = []
  for (const name of Object.keys(env)) {
    if (SECRETISH_VITE.test(name)) findings.push({ file: '(build env)', rule: `public build variable ${name} looks like a secret; VITE_* values are embedded in the bundle` })
  }
  for (const file of listFiles(dist)) {
    if (!TEXT.has(extname(file).toLowerCase()) || statSync(file).size > 20 * 1024 * 1024) continue
    const text = readFileSync(file, 'utf8')
    for (const { name, re } of PATTERNS) {
      const match = re.exec(text)
      if (match) findings.push({ file: relative(dist, file), rule: name, sample: `${match[0].slice(0, 6)}… (${match[0].length} chars)` })
    }
  }
  return findings
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const dist = resolve(process.argv[2] ?? 'dist')
  const findings = scanDist(dist)
  if (findings.length) {
    for (const f of findings) console.error(`scan-bundle: ${f.file}: ${f.rule}${f.sample ? ` [${f.sample}]` : ''}`)
    console.error(`scan-bundle: FAILED with ${findings.length} finding(s)`)
    process.exit(1)
  }
  console.log(`scan-bundle: ok (${listFiles(dist).length} files scanned in ${dist})`)
}
