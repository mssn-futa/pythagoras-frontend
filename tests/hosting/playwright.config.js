import { defineConfig, devices } from '@playwright/test'

// RELEASE-04: runs the REAL production build behind the generated _headers (CSP etc.) served by
// `wrangler dev` (Workers Static Assets, local mode, no Cloudflare account). It reuses the existing
// browser specs (so every feature page runs under the policy) plus tests/hosting/*.spec.js.
// Synthetic origins match what those specs already intercept with page.route.
const PORT = Number(process.env.HOSTING_PORT ?? 4181)
export const buildEnv = {
  VITE_API_URL: 'https://api.pythagoras.test',
  PUBLIC_MEDIA_ORIGIN: 'https://media.pythagoras.test',
  R2_S3_PRESIGN_ORIGIN: 'https://r2.example.test',
}

export default defineConfig({
  testDir: '..',
  testMatch: ['browser/**/*.spec.js', 'hosting/**/*.spec.js'],
  testIgnore: [
    'browser/harness.spec.js', // targets the Vite-only RELEASE-02 fixture page
    // PLAT-08: the Vite-only /ga-harness page, and the GA4 build check, which needs its own build with a measurement ID
    // (tests/hosting/analytics.playwright.config.js; without consent the banner would sit over the other specs' pages).
    'browser/analytics.spec.js',
    'hosting/analytics-csp.spec.js',
    // Pre-existing timing race (focus/selection after "Apply link" before the synthetic paste): it also fails
    // intermittently on `vite preview` with no CSP. Editor + sandboxed preview are covered by hosting/csp.spec.js.
    'browser/communication-rich.spec.js',
  ],
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  workers: 2,
  reporter: [['list']],
  use: { baseURL: `http://127.0.0.1:${PORT}`, serviceWorkers: 'block' },
  projects: [
    { name: 'chromium-desktop', use: { ...devices['Desktop Chrome'], launchOptions: launchOptions() } },
    { name: 'chromium-mobile', use: { ...devices['Pixel 7'], launchOptions: launchOptions() } },
  ],
  webServer: {
    cwd: new URL('../..', import.meta.url).pathname, // repo root, so wrangler state/config resolve there
    command: `npm run build:cloudflare && npx wrangler dev --ip 127.0.0.1 --port ${PORT}`,
    url: `http://127.0.0.1:${PORT}/`,
    reuseExistingServer: false,
    env: buildEnv,
    timeout: 120_000,
  },
})

// CHROMIUM_EXECUTABLE lets a machine with a different Chromium revision point at it without editing this file.
function launchOptions() {
  return process.env.CHROMIUM_EXECUTABLE ? { executablePath: process.env.CHROMIUM_EXECUTABLE } : {}
}
