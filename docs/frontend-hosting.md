# Frontend hosting on Cloudflare Workers Static Assets — RELEASE-04

Governing designs: D5 "Cloudflare hosting topology", "Deployment and origins" and "Logging throttling and
security"; D0 "Frontend client and route convention". The React/Vite app is hosted as static assets with only a tiny miss-guard Worker. PLAT-08 GA4 consent/CSP: see `docs/analytics.md`.

## Files

| File | Purpose |
|---|---|
| `wrangler.jsonc`, `worker/assets-guard.js` | Static assets from `dist/`, `not_found_handling: "single-page-application"` (unknown navigation paths return `/index.html`, 200). A tiny Worker runs only for non-navigation misses and turns a missing `/assets/*` file into 404. `env.staging` is a separate Worker, `pythagoras-frontend-staging`. |
| `scripts/hosting/headers.mjs`, `render-headers.mjs` | Validate origin env vars and write `dist/_headers` at build time. Nothing is hard-coded except Google Fonts and the Aladhan API (both switchable). |
| `scripts/hosting/scan-bundle.mjs` | Fails when `dist/` (text files incl. maps) contains secret patterns, or the build env has secret-looking `VITE_*` names. |
| `tests/behavior/hosting.test.js` | Unit tests for rendering, validation and the scanner. |
| `tests/hosting/` | `npm run test:hosting`: production build behind `wrangler dev`, the existing browser specs plus `csp.spec.js`. |
| `.github/workflows/hosting-checks.yml` | Secret scan + header render check job (no deploy, no secrets). |

`wrangler` is pinned as a devDependency (`wrangler@4.154.0`, the newest 4.x release that was at least two weeks old when pinned; installed with `--ignore-scripts --save-exact`): it is
the only supported way to validate the config (`deploy --dry-run`) and to serve Static Assets locally with `_headers`
and SPA fallback. It is not part of the browser bundle.

## Build environment (public values only)

| Variable | Required | Meaning |
|---|---|---|
| `VITE_API_URL` | yes (bundle) | Django API origin baked into the bundle. No `/api/v1`, no trailing slash (D0). |
| `PUBLIC_API_ORIGIN` | no | Same origin for the CSP; defaults to `VITE_API_URL`; build fails if both are set and differ. |
| `PUBLIC_MEDIA_ORIGIN` | yes | R2 public custom domain (`img-src`, `media-src`). `*.r2.dev` is rejected (D5). |
| `R2_S3_PRESIGN_ORIGIN` | yes | S3 endpoint host(s) of the presigned PUT (`connect-src`; also `img-src`/`media-src` because admin previews can be short-lived presigned GETs). Comma-separate bucket-style hosts. |
| `PUBLIC_PRAYER_API_ENABLED` / `PUBLIC_PRAYER_API_ORIGIN` | no | Default **off**: D0 hides prayer/Hijri widgets in Phase 1, so `api.aladhan.com` is not in `connect-src` and `geolocation=()`. `=true` adds the origin (default `https://api.aladhan.com`, `src/services/islamicApi.js`) and `geolocation=(self)`. |
| `PUBLIC_GOOGLE_FONTS_ENABLED` | no | Allows `fonts.googleapis.com` (`style-src`) and `fonts.gstatic.com` (`font-src`) for `src/index.css`'s Poppins `@import`. |
| `VITE_GA_MEASUREMENT_ID` | no | PLAT-08 public GA4 measurement ID (`G-…`, not a secret). Set → the bundle offers analytics consent and the CSP adds `https://www.googletagmanager.com` to `script-src` and it plus `https://www.google-analytics.com`, `https://region1.google-analytics.com`, `https://region1.analytics.google.com` to `connect-src`/`img-src`. Unset → no GA origin anywhere. A malformed ID fails the build. |
| `PUBLIC_GA_ENABLED` | no | Optional confirmation of the above; defaults to "ID present". `true` without an ID, or `false` with one, fails the build (CSP and bundle would disagree). |
| `PUBLIC_EXTRA_CONNECT_ORIGINS` | no | Exact extra `connect-src` origins (e.g. a further GA4 regional collection host if DebugView shows one). No wildcards. |
| `CSP_REPORT_ONLY` | no | Emit `Content-Security-Policy-Report-Only` for a staged rollout. |
| `HOSTING_ALLOW_INSECURE` | no | Local proof only: accept `http://localhost` origins; omits HSTS and `upgrade-insecure-requests`. |

Origins must be `https` origins only (no path, query, credentials or wildcard). Never put a secret in a `VITE_*` or
`PUBLIC_*` variable; they are embedded in public files and the scanner rejects secret-looking `VITE_*` names.

## Commands

```bash
VITE_API_URL=https://api.example.org PUBLIC_MEDIA_ORIGIN=https://media.example.org \
  R2_S3_PRESIGN_ORIGIN=https://<account-id>.r2.cloudflarestorage.com npm run build:cloudflare  # vite build + _headers + secret scan
npm run hosting:dev        # wrangler dev (local, offline) at http://127.0.0.1:8788 serving dist with _headers + SPA fallback
npm run hosting:dry-run    # wrangler deploy --dry-run: validates wrangler.jsonc and the asset directory
npm run test:hosting       # production build behind wrangler dev: existing browser specs + CSP specs
npx playwright test --config tests/hosting/analytics.playwright.config.js  # PLAT-08: GA-enabled build + CSP (port 4182)
```

`npm run build` is unchanged (plain Vite build for CI/dev). Production deploys must use `build:cloudflare`.

## Rendered policy and rationale

| Header | Value / reason |
|---|---|
| `Content-Security-Policy` | `default-src 'self'`; `script-src 'self'` (the build has no inline script); `connect-src` self + API + S3 presign host (+ Aladhan only when enabled); `img-src` self + `data:` (Vite inlines small assets) + media + S3 host; `media-src` self + media + S3 host; `frame-src https://www.youtube-nocookie.com` (privacy-enhanced embed only; `youtube.com` is a link, not a frame); `object-src 'none'`; `base-uri 'self'`; `form-action 'self'`; `frame-ancestors 'none'`; `worker-src 'none'`; `upgrade-insecure-requests`. |
| `style-src` | `'self' 'unsafe-inline'` plus Google Fonts. **Narrow deviation from a strict policy:** measured with `tests/hosting/csp.spec.js` — (a) the Tiptap/ProseMirror editor injects a `<style>` element at runtime, and (b) sandboxed email previews are `srcdoc` iframes, which inherit the parent policy, so server HTML with inline `style` attributes and the preview's own `<style>` are blocked without it. It is scoped to styles; scripts remain `'self'`. The preview additionally carries its own meta CSP (`default-src 'none'`, no scripts/images) and `sandbox=""`, so the effective preview policy is the intersection. Removing it needs a source change by the editor owner (editor `injectCSS: false`/nonce plus attribute-free preview HTML). |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` (no `preload`; opt in deliberately after staging). |
| `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy` | `nosniff`, `DENY` (legacy mirror of `frame-ancestors`), `strict-origin-when-cross-origin`. |
| `Permissions-Policy` | Everything denied (`geolocation=()` unless the prayer API is enabled) except `autoplay` for the YouTube frame; `fullscreen`/`encrypted-media`/`picture-in-picture` stay at their defaults so the iframe `allow` attribute keeps working. |
| `Cache-Control` | `no-cache` for `/*` (index.html and every SPA-fallback deep link); `public, max-age=31536000, immutable` for `/assets/*` (fingerprinted by Vite). `! Cache-Control` detaches the broader rule so values are not merged. |

Third-party hosts allowed: Google Fonts (`src/index.css`) and `www.youtube-nocookie.com` (`VideoEmbed`); `api.aladhan.com`
only if prayer times return; the GA4 hosts above only when a measurement ID is configured. Self-hosting the font would remove that allowance (a feature-source change outside RELEASE-04).

The app has no PWA/service worker. GA4 (PLAT-08) is an external, consent-gated script; `script-src` stays free of
`unsafe-inline` (see `docs/analytics.md`).

## SPA fallback and deep links

`not_found_handling: "single-page-application"` returns `/index.html` (200) for any path that is not an asset, so
`/admin/quizzes/1` and `/dawah/content/3` reload into the SPA, where `RequireAdmin`/guards decide access
(direct private-route reloads stay guarded; the server never serves private data from static assets).
A missing fingerprinted file must not become `index.html` under the immutable cache rule. With the built-in SPA fallback alone,
`/assets/missing.js` returned `index.html` (200, immutable) for every `Sec-Fetch-Mode`. `worker/assets-guard.js` (about 10
lines) fixes it without `run_worker_first`: Static Assets serve real files and browser navigations (`Sec-Fetch-Mode: navigate`)
themselves, and invoke the Worker only for non-navigation requests that match no file, for example a stale
`<script src="/assets/old-hash.js">`. The Worker returns `404` + `Cache-Control: no-store` only when the path starts with
`/assets/` and the binding answered HTML; everything else passes through unchanged. Cost rationale: Worker invocations are
billed and add latency, so hits and navigations (nearly all traffic) must not run it; with `run_worker_first` every asset
request would.
Local proof (`wrangler dev`, Worker invocations counted via the local observability API: 0 invocations for a real asset and two deep links, 1 per missing-asset request):
missing asset with `no-cors`, `cors` or no header returns 404; deep links with `Sec-Fetch-Mode: navigate` return 200 `no-cache`;
a real asset returns 200 immutable without invoking the Worker. A human *navigating* to a missing `/assets/x.js` still gets the
SPA (200); that is a typed URL, not a stale subresource. Deploy with `--old-asset-ttl <seconds>` (a `wrangler deploy` option, not
`versions upload`) so a previous release's chunks survive for tabs still open.
The favicon is `public/favicon.png` (copy of `src/assets/logo.png`); the dead `/vite.svg` link was replaced.

## Origin and CORS facts (for RELEASE-06/07, handover)

- Distinct hostnames for app / API / media (D5). The API client sends the bearer to `VITE_API_URL` only; the
  browser PUT to R2 sends no `Authorization` and no credentials (`uploadTransport.js`).
- API CORS must allow the app origin and the `Authorization`, `Content-Type`, `Accept` headers; R2 bucket CORS must
  allow the app origin, `PUT`, `Content-Type`, and expose `ETag`. Presigned URLs work only on the S3 host, never on
  the media custom domain.
- Cloudflare must not cache API responses (no Cache Everything on the API host); Static Assets rules above apply to
  the app host only.

## Local proof recorded for this package

See the RELEASE-04 handoff: `npm run build:cloudflare` with synthetic origins, `wrangler dev` deep-link/cache/header
checks, `npm run test:hosting` (42 specs, zero unintended CSP violations).

## Staging deployment (BLOCKED until a Cloudflare account exists)

Do not run these locally without account access. Commands were checked against the installed wrangler `--help`.
Staging is a separate Worker (`env.staging`, name `pythagoras-frontend-staging`), so production history is untouched.

```bash
npx wrangler login                                   # or CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID in CI secrets
# Token permissions: Workers Scripts: Edit; for custom domains also Zone: Read and DNS: Edit (and Workers Routes: Edit
# if routes are used) on the app zone. Without zone/DNS permission `--domain` fails.
VITE_API_URL=https://<staging-api> PUBLIC_MEDIA_ORIGIN=https://<staging-media> \
  R2_S3_PRESIGN_ORIGIN=https://<acct>.r2.cloudflarestorage.com npm run build:cloudflare
npx wrangler deploy --dry-run --env staging          # validates config/assets offline

# Option A: direct deploy to the staging Worker (also attaches the custom domain and keeps old assets for a day)
npx wrangler deploy --env staging --domain <staging-app-hostname> --old-asset-ttl 86400

# Option B: gradual: upload a version, then promote it explicitly
npx wrangler versions upload --env staging --tag staging --message "RELEASE-04 staging"   # prints the version id
npx wrangler versions deploy <version-id>@100% --env staging                               # promote
npx wrangler deployments list --env staging
npx wrangler rollback <previous-version-id> --env staging
```

`--old-asset-ttl` exists on `wrangler deploy` only. Production uses the same commands without `--env staging`, after the
staging checklist passes.

Staging proof checklist: custom domains and DNS/TLS for app/API/media; real API and R2 origins; deep links
`/admin/quizzes/1`, `/dawah/content/3`, `/sign-in?next=...` return the SPA (200) and the guard redirects when
signed out; `curl -I` shows the rendered `_headers` on `/`, a deep link, `/assets/<hash>.js` (immutable); a missing
`/assets/missing.js` fetched as a subresource (`curl -H 'Sec-Fetch-Mode: no-cors'`) is 404 `no-store`; API CORS/bearer round
trip; direct R2 PUT with bucket CORS and no bearer; media Range/206 on the media domain; browser console shows no CSP
violations.
