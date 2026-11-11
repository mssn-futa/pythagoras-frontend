#!/usr/bin/env node
/* Usage: node scripts/hosting/render-headers.mjs [distDir]  (reads .env/.env.production like Vite, process.env wins: PUBLIC_API_ORIGIN, PUBLIC_MEDIA_ORIGIN, R2_S3_PRESIGN_ORIGIN, ...) */
import { mkdirSync, writeFileSync, existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { ConfigError, readHostingConfig, renderHeaders } from './headers.mjs'
import { loadBuildEnv } from './env.mjs'

const dist = resolve(process.argv[2] ?? 'dist')
if (!existsSync(join(dist, 'index.html'))) {
  console.error(`render-headers: ${dist}/index.html not found; run vite build first`)
  process.exit(1)
}
try {
  const config = readHostingConfig(await loadBuildEnv())
  const body = renderHeaders(config)
  mkdirSync(dist, { recursive: true })
  writeFileSync(join(dist, '_headers'), body)
  console.log(`render-headers: wrote ${join(dist, '_headers')} (api ${config.apiOrigin}, media ${config.mediaOrigin}, s3 ${config.presignOrigins.join(' ')})`)
} catch (error) {
  if (!(error instanceof ConfigError)) throw error
  console.error(`render-headers: ${error.message}`)
  process.exit(1)
}
