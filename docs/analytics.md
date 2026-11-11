# Phase 1 analytics (GA4) and consent — PLAT-08

Governing designs: D1 "Phase 1 analytics"; D0 "Cross-domain invariants" (analytics never receives tokens, email,
matric number, raw URL query/fragment or private record content); D5 (CSP for GA4 consented requests, no wildcard).

## What is measured

| Event | When | Parameters |
|---|---|---|
| `page_view` | Once per **completed** SPA navigation while consent is active | `page_location` = app origin + route template (e.g. `https://app.example.org/dawah/events/:id`), `page_title` = generic title (`Event details`), `page_referrer` = the previous template |
| `sign_up` | Once, after `POST /accounts/register/` succeeded (AuthProvider `onRegistered`), while consent is active | `{ method: 'email' }` |

Nothing else: no login, clicks, search terms, errors, user ID or user properties. No product activity model.

Sanitized examples (what a hit carries):

```js
gtag('event', 'page_view', { page_location: 'https://app.example.org/dawah/events/:id', page_title: 'Event details', page_referrer: 'https://app.example.org/dawah' })
gtag('event', 'page_view', { page_location: 'https://app.example.org/admin/communication/drafts/:id', page_title: 'Admin broadcast draft', page_referrer: 'https://app.example.org/admin/communication' })
gtag('event', 'page_view', { page_location: 'https://app.example.org/not-found', page_title: 'Page not found' }) // any unknown path
gtag('event', 'sign_up', { method: 'email' })
```

Route templates come from the mounted route tree (`src/routes/routePreload.js` tree + sign-in/up/privacy), so new
slot routes are templated automatically; add a generic title in `src/features/analytics/routeTemplates.js`
(`PAGE_TITLES`; a test fails when a mounted route has none — the fallback title is `Pythagoras`).

## Consent model

- Config: public `VITE_GA_MEASUREMENT_ID` (`G-XXXXXXXXXX`). Absent/malformed → analytics fully off: no banner, no
  script, no `dataLayer`, no CSP allowance.
- Explicit opt-in: a non-modal banner (Accept / Decline, link to `/privacy`). Until Accept nothing is loaded or sent.
- Preference: `localStorage['pythagoras.analyticsConsent'] = {"v":1,"choice":"granted"|"denied","at":"<ISO>"}`. Only
  this preference is stored. A different `v` re-asks. Unusable storage → the choice lasts for the page only.
- Do Not Track (`navigator.doNotTrack === '1'`, `window.doNotTrack`, `msDoNotTrack`) or Global Privacy Control
  (`navigator.globalPrivacyControl === true`) = declined, never prompted, not overridable while the signal is on.
- Change/withdraw: `/privacy` (public, in the student/public layout), linked from the banner, the sign-in and
  sign-up footers and the profile page. Withdrawal sets `window['ga-disable-<ID>'] = true` (GA's documented opt-out),
  sends `gtag('consent','update',{analytics_storage:'denied'})`, expires `_ga`, `_ga_*` (and legacy `_gid`, `_gat*`)
  for the host and each parent domain, and stops all events. No reload. Other open tabs follow via the `storage` event.
- No replay: events are never queued. A page view or sign-up before consent is dropped; accepting does not send the
  current page (only navigations completed after consent). A navigation completes when React Router commits it (pages
  load in a transition), session restoration has finished, and the path stayed 300 ms (so `/profile` →
  `/sign-in?next=…` guard redirects count once, as the final page). Query/hash-only changes are not new pages.
- After consent the tag is injected once: `https://www.googletagmanager.com/gtag/js?id=<ID>` (external, async, no
  inline snippet), then `consent default` (`analytics_storage: granted`, all ad storage/user data/personalization
  `denied`), `js`, `set` (sanitized page context so automatic hits never carry the raw URL or `document.title`), and
  `config` with `send_page_view: false`, `allow_google_signals: false`, `allow_ad_personalization_signals: false`.
  GA4 does not log or store IP addresses, so no `anonymize_ip` is needed.
- The initial referrer is reduced to an origin (`https://other.site/`, or the app origin), never a path or query.
- Failures are swallowed: blocked/failed script (ad blocker), throwing `dataLayer`, storage errors, and errors in the
  registration observer never affect rendering, auth or navigation.

Code: `src/features/analytics/` (`analytics.js` adapter, `consent.js`, `routeTemplates.js`, `RouteAnalytics.jsx`,
`ConsentBanner.jsx`, `AnalyticsSettings.jsx`, `PrivacyPage.jsx`); seams: `src/main.jsx` (creates the controller),
`src/App.jsx` (`AppRoot`, `/privacy` route, observer + banner), `AuthProvider` `onRegistered` prop (called with no
arguments only after the register request resolved).

## GA4 property settings checklist (organization-owned property; lead/admin)

These settings cannot be enforced from code and are required:

1. Admin → Data streams → Web stream → **Enhanced measurement: OFF** (all of it). Important: with enhanced
   measurement on, "Page changes based on browser history events" sends its own `page_view` with the raw URL even
   though the code sets `send_page_view: false` (Google documents this). Also off: scrolls, outbound clicks, site
   search (would read query strings), form interactions, video engagement, file downloads.
2. Admin → Data collection → **Google signals: OFF**; **Granular location and device data collection**: off if available.
3. Admin → Data collection / Ads links: **no Google Ads link**; **Ads personalization: disabled** for all regions.
4. Admin → Data retention → **event data retention: 2 months** (minimum); "Reset user data on new activity": off.
5. Admin → Data streams → Web stream → Configure tag settings: no cross-domain linking, no "Collect Universal
   Analytics events"; **Define internal traffic** optional; **Unwanted referrals** not needed.
6. No User-ID, user properties or custom dimensions that could hold personal data. No BigQuery export unless approved.
7. Data stream URL = the app origin; measurement ID → `VITE_GA_MEASUREMENT_ID` in the Cloudflare build env (public).

## CSP / hosting

`scripts/hosting/headers.mjs` adds GA4 origins only when `VITE_GA_MEASUREMENT_ID` is set (`PUBLIC_GA_ENABLED` may
confirm, never contradict it; the build fails on a malformed ID, `PUBLIC_GA_ENABLED=true` without an ID, or an ID with
`PUBLIC_GA_ENABLED=false`):

| Directive | Added |
|---|---|
| `script-src` | `https://www.googletagmanager.com` (no `'unsafe-inline'`: the tag is an external script) |
| `connect-src`, `img-src` | `https://www.googletagmanager.com https://www.google-analytics.com https://region1.google-analytics.com https://region1.analytics.google.com` |

Source: Google's "Use a Content Security Policy" guide (tag-platform/security/guides/csp, Google Analytics without
Ads features) lists `www.googletagmanager.com` and the wildcards `*.google-analytics.com`, `*.analytics.google.com`
(and `*.google.com`). D5 forbids wildcards, so the documented regional collection hosts are listed exactly; the
`google.com`/`doubleclick` hosts are only needed for Ads/Google-signals features, which are disabled. If DebugView or
the browser console shows a CSP refusal for another Google collection host (e.g. a new regional host), add that exact
origin with `PUBLIC_EXTRA_CONNECT_ORIGINS` and record it here. CSP allowances alone send nothing: the tag still loads
only after consent.

## Tests

- `tests/behavior/analytics.test.jsx` (vitest): config, no banner/script without ID, nothing before consent, DNT/GPC,
  Accept → one script + safe config + no replay, templated page views per navigation (ids/query/hash/not-found),
  guard redirect and session-restoration dedupe, decline persistence, withdrawal (cookies, opt-out flag, re-allow,
  cross-tab), outdated preference, sign_up once after success only (400/503 first; not before consent; not login),
  failure swallowing, every mounted route has a title.
- `tests/behavior/hosting.test.js`: GA4 CSP additions and configuration errors.
- `tests/browser/analytics.spec.js` (Playwright desktop + mobile, Vite): the real app under `/ga-harness/*`
  (`tests/browser/analytics.html`, synthetic ID `G-PLAT08TEST`; other specs stay analytics-off). Google hosts are
  intercepted (`tests/browser/ga-stub.js`, a stub tag that turns events into `/g/collect` hits): zero Google requests
  before consent, sanitized hits after, withdrawal, GPC, decline, blocked tag, sign_up once.
- `tests/hosting/analytics-csp.spec.js` with `npx playwright test --config tests/hosting/analytics.playwright.config.js`:
  GA-enabled production build behind `wrangler dev` and its generated CSP: no request before consent, tag + collection
  allowed without violations, `www.google.com`/`doubleclick`/arbitrary script hosts refused. (Separate build because a
  GA-enabled build shows the banner over the pages other hosting specs click.)

The stub proves gating and sanitization only. It does **not** prove receipt by GA4.

## Real GA4 verification (BLOCKED: no property access)

Status: **BLOCKED** — no organization-owned GA4 property or test access was available to this package. Final analytics
acceptance needs the following, done by someone with property access:

1. Apply the checklist above; note the measurement ID.
2. `VITE_GA_MEASUREMENT_ID=G-… npm run build:cloudflare` (with the real origins) and deploy to staging.
3. In Chrome, install/enable the Tag Assistant or add `debug_mode` for the session only (Tag Assistant
   `tagassistant.google.com` connect is easiest; do not commit `debug_mode`). Open GA4 → Admin → DebugView.
4. Load the app: confirm **no** request to Google in DevTools Network and no `_ga` cookie before choosing.
5. Accept; navigate `/dawah` → an event → a content item → `/privacy`. DebugView must show one `page_view` per
   navigation with `page_location` = templates (`…/dawah/events/:id`), generic `page_title`, no query/fragment/IDs.
6. Register a synthetic account: exactly one `sign_up` with `method = email`; a failed attempt (duplicate email) shows none.
7. Withdraw in `/privacy`: `_ga` cookies disappear, no further events. Repeat with DNT/GPC enabled: no banner, no requests.
8. Console: no CSP violations. Record screenshots/export of DebugView (no PII) in the release evidence (RELEASE-06/07).
