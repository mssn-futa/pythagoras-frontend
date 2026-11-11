# Frontend client, session and route slots — PLAT-04

Governing designs: D0 "Authentication and session policy", "API response and
error convention", "Frontend client and route convention"; D1 "Frontend Design"
and "API Contracts". Domain packages build on these imports and must not add
another token interceptor, auth provider or root route.

## Configuration

`VITE_API_URL` is the backend origin (see `.env.example`), without `/api/v1`.
It is read per request, so tests can stub it. Browser tests use the synthetic
origin `https://api.pythagoras.test`, set only on the Playwright web server.

## Shared API client

```js
import { api, apiClient, ApiError, isApiError } from '../services/api'
```

| Export | Purpose |
|---|---|
| `api.get/post/put/patch/delete(url, [data], config)` | Resolves to the envelope's `data` (unwrapped once); 204/empty → `null`. |
| `apiClient` | The underlying axios instance. `response.data` is already unwrapped; `response.message` holds the envelope message. |
| `ApiError` | Every rejection: `{ status, code, message, fields, retryAfter }`. `fields` is `{ name: [messages] }` from `data.fields`. Network failures are `status: 0`, `code: 'NETWORK_ERROR'` (or `'TIMEOUT'`). |
| `refreshSession()`, `onSessionEnded(fn)` | Session plumbing used by the auth provider; domain code normally never calls them. |

Domain services own their payload mapping and call the client:

```js
// src/features/dawah/api/eventsApi.js (endpoint paths illustrative; use D2's)
import { api } from '../../../services/api'

export const listPublishedEvents = (params) =>
  api.get('/dawah/events/', { params, public: true }) // no bearer, never refreshes

export const createEvent = (payload) =>
  api.post('/dawah/admin/events/', payload)          // bearer + refresh/retry once
```

Per-request options: `public: true` sends no `Authorization` header and never
refreshes (anonymous endpoints, login/register/refresh). `skipAuthRefresh: true`
sends the bearer header but does not refresh on 401 (logout uses this).

Authenticated 401 behaviour: concurrent 401s share one `POST /accounts/refresh/`;
each failed request is retried at most once with the new token (a request whose
401 arrives after another request already refreshed reuses that token). A second
401 or a missing refresh token clears the session and signals sign-out; guards
then redirect to `/sign-in?next=<current path>`. 403 never refreshes. Direct R2
signed PUTs must use a separate plain `fetch`/axios call with no bearer token,
never this client.

Refresh failure policy. D0 says "on refresh failure, clear session and redirect
to sign-in". PLAT-04 interprets this as a **definitive** refresh failure:

| `/accounts/refresh/` outcome | Session | Original request rejects with |
|---|---|---|
| 400 / 401 / 403 | Cleared, sign-out signalled | `401 SESSION_EXPIRED` |
| Network / timeout (`status: 0`), 429, 5xx | Kept (tokens untouched, no sign-out) | The normalized refresh error (`NETWORK_ERROR`, `TIMEOUT`, `THROTTLED`, `SERVER_ERROR`, ...) |

Session restoration on load follows the same rule: a definitive refresh
rejection, or 401/403 from `GET /accounts/me/`, clears the session and shows
sign-in; transient failures keep the stored session and show a "We couldn't
restore your session" screen with **Retry** and **Sign out**
(`useAuth().status === 'restore_failed'`, `retryRestore()`).

Session generations. `clearSession()` (logout, forced sign-out, a new login)
starts a new session generation. A refresh result or 401 retry that belongs to
an older generation is discarded: it never re-stores tokens and never retries
the request with the new session's credentials. Logout clears the session
first, then waits for any in-flight refresh so it revokes the newest rotated
refresh token.

Display errors with `error.message` and map `error.fields[name]` onto inputs.
`src/features/auth/formErrors.js` (`describeFormError`) does this for forms.

## Auth hooks and guards

```js
import {
  AuthProvider, useAuth, useSignOut,
  RequireAuth, RequireAdmin, RedirectIfAuthenticated,
  isAdmin, isStudent, hasRole, ROLES, getSafeReturnPath, buildSignInPath,
} from '../features/auth'

const { status, user, isAuthenticated, isAdmin, login, logout, updateProfile } = useAuth()
```

`status` is `restoring | restore_failed | authenticated | anonymous`; guards
render a loading state until restoration (refresh → `GET /accounts/me/`)
finishes, keeping the protected URL (no intermediate sign-in redirect), so
protected pages never render early. Admin authority is `role === 'admin'` on an
active user only; `is_staff`/`is_superuser` never grant it. `endReason` is `logout` or `expired` after a sign-out.
Return destinations accept only in-app paths; absolute, protocol-relative,
backslash, scheme, control-character, dot-segment (`.`/`..`, including `%2e`)
and sign-in/up values are dropped, and the normalized result is re-checked so it
can never start with `//`.

Registration observer (PLAT-08): `<AuthProvider onRegistered={fn}>` calls `fn()` with no arguments exactly once per
`register()` whose API request succeeded (never for failed/rejected attempts); its errors are swallowed. `AppRoot`
in `src/App.jsx` wires it to the analytics `sign_up` event (`docs/analytics.md`).

## Route slots

PLAT-04 owns `src/App.jsx`/`src/main.jsx`. Domain packages edit only their slot:

| Module | Export | Mounted at |
|---|---|---|
| `src/features/dawah/adminRoutes.jsx` | `dawahAdminRoutes` | `/admin/*`, `RequireAdmin`, `AdminLayout` |
| `src/features/dawah/studentRoutes.jsx` | `dawahStudentRoutes` | `/*`, `RequireAuth`, student `Layout` |
| `src/features/assessments/adminRoutes.jsx` | `assessmentAdminRoutes` | `/admin/*`, `RequireAdmin`, `AdminLayout` |
| `src/features/assessments/studentRoutes.jsx` | `assessmentStudentRoutes` | `/*`, `RequireAuth`, student `Layout` |
| `src/features/communication/routes.jsx` | `communicationRoutes` | `/admin/*`, `RequireAdmin`, `AdminLayout` |

Entries are react-router route objects with relative paths:

```jsx
import EventsPage from './pages/EventsPage.jsx'
export const dawahStudentRoutes = [
  { path: 'dawah', public: true, element: <EventsPage /> }, // A03 public content
  { path: 'dawah/events/:id', public: true, element: <EventDetail /> },
]
```

`public: true` (student slots only, top-level entries) mounts the page in the
student layout without `RequireAuth`; navigation then shows a Sign in link.
Slots ship empty and must import only pages that exist. Navigation menus list
only mounted destinations; PLAT-07 owns final navigation composition.

## Token storage policy and limitation

- Access token: module memory only (lost on reload, restored via refresh).
- Refresh token: `sessionStorage['pythagoras.refreshToken']`, per tab, cleared
  on logout, refresh failure, or when the tab closes. Passwords are never stored.
- This is the D0 release engineering choice, not an HttpOnly cookie. Any script
  running in the page (an XSS flaw or a compromised dependency) can read the
  refresh token and act as the user for up to its seven-day lifetime, until
  logout/rotation revokes it. Mitigations remain: no unsanitized HTML, a
  production CSP, refresh rotation/blacklisting, and short access lifetimes.
  Record this in the handover.

## Tests

`tests/behavior/api-client.test.js`, `auth-session.test.jsx`, `guards.test.jsx`,
`register-profile.test.jsx` (MSW), and `tests/browser/auth-journey.spec.js`
(Playwright route interception, desktop and mobile). Shared synthetic fixtures:
`tests/fixtures/auth.js`, `tests/fixtures/TestApp.jsx`. Run with `npm test`,
`npm run test:browser`, `npm run test:all`.
