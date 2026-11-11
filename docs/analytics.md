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
  this preference is stored. A different `v` re-asks, and so does a choice older than **12 months** (or with a missing,
  invalid or future `at`); a lapsed choice also expires any leftover `_ga*` cookies. Unusable storage → the choice lasts
  for the page only.
- Do Not Track (`navigator.doNotTrack === '1'`, `window.doNotTrack`, `msDoNotTrack`) or Global Privacy Control
  (`navigator.globalPrivacyControl === true`) = declined, never prompted, not overridable while the signal is on.
- Change/withdraw: `/privacy` (public, in the student/public layout), linked from the banner, the sign-in and
  sign-up footers and the profile page. Withdrawal sets `window['ga-disable-<ID>'] = true` (GA's documented opt-out),
  sends `gtag('consent','update',{analytics_storage:'denied'})`, expires `_ga`, `_ga_*` (and legacy `_gid`, `_gat*`)
  for the host and each parent domain, stops all events, and then — only if gtag.js was loaded in this document —
  **reloads the page once** so the tag is unloaded (no reliance on consent-mode cookieless pings). Loop guard: a
  `sessionStorage['pythagoras.analyticsWithdrawReload']` timestamp is written before the reload; the reloaded page
  consumes it (and shows "Consent withdrawn … the Google tag was unloaded"), starts with consent denied so it never
  loads the tag, and no controller reloads more than once or within 60 s of another withdrawal reload; without
  usable sessionStorage it does not reload at all (the tag stays disabled by the opt-out flag). Other open tabs follow
  the withdrawal via the `storage` event (opt-out flag + denied consent) but are not reloaded, since that could lose
  unsaved input.
- Banner stacking: `z-[44]`, above the navbar (z-30) and the mobile-menu dim (z-40) and below drawers, the open
  sidebar and dialogs (z-45/z-50); it also hides while any `[aria-modal="true"]` or `dialog[open]` is in the document
  and reserves its height as `body` bottom padding while shown so it never permanently covers the last controls.
- No replay: events are never queued. A page view or sign-up before consent is dropped; accepting does not send the
  current page (only navigations completed after consent). A navigation completes when React Router commits it (pages
  load in a transition), session restoration has finished, and the path stayed 300 ms (so `/profile` →
  `/sign-in?next=…` guard redirects count once, as the final page). Query/hash-only changes are not new pages.
- After consent the tag is injected once: `https://www.googletagmanager.com/gtag/js?id=<ID>` (external, async, no
  inline snippet), then `consent default` (`analytics_storage: granted`, all ad storage/user data/personalization
  `denied`), `js`, `set` (sanitized page context so automatic hits never carry the raw URL or `document.title`), and
  `config` with `send_page_view: false`, `allow_google_signals: false`, `allow_ad_personalization_signals: false`.
  GA4 does not log or store IP addresses, so no `anonymize_ip` is needed.
- History hooks (defence in depth for a misconfigured property): while consent is active the adapter wraps
  `history.pushState`/`replaceState` and listens to `popstate` (installed before gtag.js loads, removed on withdrawal).
  Each call first does `gtag('set', { page_location, page_title })` for the **target** URL's route template (resolved
  with the router basename by `RouteAnalytics`), so an automatic "history change" page view from enhanced
  measurement can only see the template. What could NOT be controlled from code: enhanced-measurement events that
  read the clicked element (outbound clicks: `link_url`/`link_domain`; file downloads: `file_name`/`link_url`; site
  search: `search_term` from the query; form interactions: `form_id`/`form_destination`; video events). gtag has no
  supported switch to strip or override those per-event parameters, so **enhanced measurement OFF in the property is
  a release gate** (below). Also not verifiable offline: whether real gtag.js's history listener honours the `set`
  context (the local stub does; DebugView must confirm).
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
  cross-tab), single guarded withdrawal reload (+ post-reload notice, loop guards), 12-month expiry, outdated
  preference, history hooks (push/replace/popstate set the target template; BrowserRouter basename; inert after
  withdrawal), banner below/aside a bottom-aligned modal dialog, sign_up once after success only (400/503 first; not
  before consent; not login; StrictMode + double submit), failure swallowing, every mounted route has a title.
- `tests/behavior/hosting.test.js`: GA4 CSP additions and configuration errors.
- `tests/browser/analytics.spec.js` (Playwright desktop + mobile, Vite): the real app under `/ga-harness/*`
  (`tests/browser/analytics.html`, synthetic ID `G-PLAT08TEST`; other specs stay analytics-off). Google hosts are
  intercepted (`tests/browser/ga-stub.js`, a stub tag that turns events into `/g/collect` hits, writes `_ga`/`_ga_<id>`
  cookies on config and emulates enhanced measurement's history page views as `history_probe` hits): zero Google
  requests before consent, sanitized hits after, history probes only ever see templates, withdrawal (tag-written
  cookies expire, exactly one reload, no tag afterwards), GPC, decline, blocked tag, sign_up once, banner below a
  bottom sheet and hidden while a modal dialog is open.
- `tests/hosting/analytics-csp.spec.js` with `npx playwright test --config tests/hosting/analytics.playwright.config.js`:
  GA-enabled production build behind `wrangler dev` and its generated CSP: no request before consent, tag + collection
  allowed without violations, `www.google.com`/`doubleclick`/arbitrary script hosts refused. (Separate build because a
  GA-enabled build shows the banner over the pages other hosting specs click.)

The stub proves gating and sanitization only. It does **not** prove receipt by GA4.

## Release acceptance gate: GA4 DebugView (RELEASE-06/07; BLOCKED here: no property access)

Status: **BLOCKED** for PLAT-08 — no organization-owned GA4 property or test access was available. Final analytics
acceptance is this check, performed by someone with property access on the staging build, and recorded (screenshots or
DebugView export, no PII) in the release evidence. Any failure blocks the release.

1. Apply the property checklist above (enhanced measurement OFF is mandatory); note the measurement ID.
2. `VITE_GA_MEASUREMENT_ID=G-… npm run build:cloudflare` (with the real origins) and deploy to staging.
3. Enable debug for the session only via Tag Assistant (`tagassistant.google.com` → connect the staging URL); never
   commit `debug_mode`. Open GA4 → Admin → DebugView. Keep DevTools → Network open with "Preserve log".
4. Fresh profile, no consent: load the app. **No** request to `googletagmanager.com`/`google-analytics.com`, no `_ga`
   cookie. DebugView shows nothing.
5. Accept. Then the **probe**: open `/dawah` and click through to an event, then type the probe URL
   `/dawah/events/42?utm_source=x#y` into the address bar (full load) and click one in-app link from it.
   Required in DebugView for each navigation after consent: **exactly one `page_view`**, `page_location` =
   `https://<app>/dawah/events/:id` (templated `dl`: no `42`, no `utm_source`, no `#y`), `page_title` = `Event details`,
   `page_referrer` without a path/query from another site. **No extra events**: no second `page_view` per navigation,
   no `scroll`, `click`, `file_download`, `view_search_results`, `form_start`/`form_submit`, `video_*`. (Automatic
   `session_start`/`first_visit`/`user_engagement` are expected; their `page_location` must also be a template.)
   In Network, every `/g/collect` request's `dl`/`dr`/`dt` parameters must match the same rules.
6. Register a synthetic account: exactly one `sign_up` with `method = email`; a failed attempt (duplicate email) and a
   login show none. No user ID, email or name in any parameter or user property.
7. Withdraw in `/privacy`: the page reloads once, `_ga`/`_ga_*` cookies are gone, no `gtag/js` in the new document,
   no further events in DebugView or Network. Repeat in a profile with DNT or GPC on: no banner, no Google requests.
8. Console: no CSP violations. If a CSP refusal names another GA collection host, add it exactly via
   `PUBLIC_EXTRA_CONNECT_ORIGINS` and record it here.
