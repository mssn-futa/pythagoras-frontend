import base, { buildEnv } from './playwright.config.js'

// PLAT-08: the production build WITH a synthetic GA4 measurement ID behind its generated _headers (wrangler dev),
// so the GA4 CSP allowances are exercised by a real browser. Separate from the main hosting suite because a
// GA-enabled build shows the consent banner on every page. Run: npx playwright test --config tests/hosting/analytics.playwright.config.js
const PORT = Number(process.env.HOSTING_ANALYTICS_PORT ?? 4182)

export default {
  ...base,
  testMatch: ['hosting/analytics-csp.spec.js'],
  testIgnore: [],
  use: { ...base.use, baseURL: `http://127.0.0.1:${PORT}` },
  webServer: {
    ...base.webServer,
    command: `npm run build:cloudflare && npx wrangler dev --ip 127.0.0.1 --port ${PORT}`,
    url: `http://127.0.0.1:${PORT}/`,
    env: { ...buildEnv, VITE_GA_MEASUREMENT_ID: 'G-PLAT08TEST' },
  },
}
