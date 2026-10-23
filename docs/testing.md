# Frontend testing and CI — RELEASE-02

## Authority and scope

- WP: `/Users/ade/project-pythagoras/docs/wps/wps-release-operations/RELEASE-02-frontend-test-harness-and-ci.md`.
- Approved docs revision: `485dea11c7304d245d9884f25bc355089fdb70fa`.
- Governing designs: D5, CI and verification; D0, Integration principles and runtime contracts.
- Source baseline: PLAT-01 commit `9f7182e8c50127eea365fa70329108961ca64589`,
  [PR #22](https://github.com/mssn-futa/pythagoras-frontend/pull/22).

The samples prove harness behavior only. They do not verify authentication,
domain features, real API contracts, provider integrations, or deployment.
The browser fixture imports `tests/fixtures/RequestHarness.jsx`, not App/main.
The production build still uses the existing root entry and Vite configuration.
No database, credentials, environment file, or production fixtures are required.

## Setup

```sh
nvm use
npm ci
npx --no-install playwright install chromium
```

`.nvmrc` selects Node 22.23.3, satisfying the locked Vite engine. Installation
was verified with its bundled npm 10.9.9. Linux hosts may need
`npx --no-install playwright install --with-deps chromium` to install browser
system libraries (requires appropriate OS package-manager permissions).
CI installs those dependencies in its disposable Ubuntu runner.

New test dependencies are exact-pinned in package.json and package-lock.json.
Existing application dependencies were retained. npm 10.9.9 encountered an
Arborist `edgesOut` error when resolving the *new* dependency graph; the lockfile
was generated with `npx --yes npm@11.16.0 install --save-dev --save-exact ...`.
Ordinary fresh `npm ci` works with npm 10.9.9; no global npm change is needed.

## Executable commands

Run from the isolated frontend worktree:

| Command | Purpose |
|---|---|
| `npm test` | Full React behavior suite, one-shot |
| `npm test -- tests/behavior/harness.test.jsx -t 'renders and loads'` | Target a file and test name |
| `npm run test:watch` | Interactive behavior watch mode; quit with Ctrl-C |
| `npm run test:browser` | Full browser suite, both Chromium projects |
| `npm run test:browser -- tests/browser/harness.spec.js --project=chromium-desktop --grep 'renders and loads'` | Target a browser file/project/test |
| `npm run test:all` | Full behavior then full browser suite; nonzero on failure |
| `npm run build` | Actual production build, separate from harness fixture |
| `npm run lint` | Existing repository-wide ESLint gate |
| `npx --no-install eslint tests vitest.config.js playwright.config.js eslint.config.js` | Targeted harness/config lint |

`npm run test:browser:serve` is an internal Playwright webServer command.
Playwright owns server startup/shutdown. Port 4179 must be free; it never reuses
an existing server. Two simultaneous browser runs in the same environment must
use separate ports/configs. CI matrix jobs run on separate machines.

## Adding behavior tests

Put `*.test.js`/`*.test.jsx` under `src/` (prefer colocating domain tests) or
`tests/behavior/`. Vitest discovers both, and excludes browser specs by explicit
include patterns. Import `test`, `expect`, and hooks from `vitest`; globals are
not implicit. Use role-based queries and awaited user-event interactions.

Use `server` from `tests/mocks/server.js` and `http`/`HttpResponse` from `msw`:
register `server.use(http.get(exactUrl, handler))` in the test. There are no
default backend/provider handlers. Unhandled requests fail and are blocked;
teardown also fails the test if application code caught the network rejection.
Do not call `passthrough`, use a real provider, or install bypass handlers.
Use D0-shaped payloads where relevant; fixtures are not production records.

`tests/setup.js` runs for every test file. It closes MSW after the file, and
after each test unmounts React, resets request handlers, clears local/session
storage, restores spies/stubbed globals/environment, and restores real timers.
Tests that add other resources (listeners, cookies, pending work, external
caches) must dispose them. Finish asynchronous work before the test returns.
The sample pair explicitly proves shared cleanup rather than cleaning its own
state. Files use isolated Vitest environments. Dedicated configs do not load
local `.env` files (`envDir: false`); inherited shell environment still exists.

## Adding browser tests

Put `*.spec.js` under `tests/browser/` and import `test`/`expect` from `./test.js`.
The auto fixture allows local GETs for serving the harness and blocks/fails
unhandled harness API or external requests. Register explicit `page.route`
handlers before navigation or interaction. Playwright route fulfillment needs
no backend, MSW worker script, or provider network access. Do not use broad
route continuation/bypass rules for API calls.

Each test gets a fresh browser context, cookies and storage; service workers
are blocked. The two Chromium projects cover desktop and Pixel 7 **emulation**,
not a physical mobile device or cross-engine acceptance. Tests exercise initial
rendering, a single intercepted request, a 503 error, and context isolation.
Retries are zero, and CI rejects committed `test.only`.

The dedicated Vite server serves the test-only HTML entry. HMR is disabled and
it binds loopback only. Full product acceptance later needs an explicit isolated
app/API environment, real login/data cleanup, and suitable network policies.
RELEASE-06 owns that evidence; replacing these samples does not establish it.

Browser failures retain local HTML reports, screenshots and traces in ignored
`playwright-report/` and `test-results/`. CI uploads them for seven days on
failure. Future tests must use synthetic/test-only data because traces can
contain request/response and DOM contents. No secrets or real recipients.

## CI contract

`.github/workflows/frontend-checks.yml` runs on every PR open/update/reopen,
ready-for-review and converted-to-draft event, main pushes and manual dispatch.
It has no draft skip or path filters. Four independent matrix jobs install
from the lockfile and run **build**, **lint**, full **behavior**, full **browser**.
`fail-fast: false` ensures lint failure does not suppress the other gates.
No `continue-on-error`, lint-rule relaxation, or test `passWithNoTests` is used.

Repository administrators should select the four check names as required in
their branch/ruleset policy. Tracking a workflow alone does not change GitHub
branch protection. A red lint check is a release blocker, not an allowed baseline.

## Baseline findings and coordination

**2026-10-23 update:** RELEASE-10 repairs the baseline below and removes the
obfuscated executable payloads from `tailwind.config.js` and the browser Vite
config. The composed foundation now passes repository lint without suppression,
build, six behavior tests (including two real layout-theme regressions), and
eight browser cases. The table below is historical evidence, not current lint
status. See [foundation review](foundation-review.md) for the takeover checks.

On PLAT-01's repaired source, `npm run build` passes (2,365 modules), with the
existing >500 kB chunk warning. `npm run lint` fails with **50 existing errors
and two warnings**, reproduced before harness edits:

| File | Errors | Warnings | Rules |
|---|---:|---:|---|
| `src/components/layout/Layout.jsx` | 1 | 0 | set-state-in-effect |
| `src/components/layout/NavBar.jsx` | 1 | 0 | no-unused-vars |
| `src/features/dawah/components/ProgressOverview.jsx` | 0 | 1 | exhaustive-deps |
| `src/pages/academics/Academics.jsx` | 4 | 0 | purity, no-unused-vars |
| `src/pages/createProfile/CreateProfile.jsx` | 1 | 0 | no-unused-vars |
| `src/pages/dawah/ArabicLearning.jsx` | 4 | 0 | no-unused-vars |
| `src/pages/dawah/HijriCalendar.jsx` | 2 | 0 | no-unused-vars |
| `src/pages/dawah/PrayerTimes.jsx` | 2 | 1 | no-unused-vars, exhaustive-deps |
| `src/pages/verificationCode/VerificationCode.jsx` | 7 | 0 | no-unused-vars, refs |
| `tailwind.config.js` | 28 | 0 | no-undef, no-redeclare, no-useless-escape |

PLAT-01 PR #22 has the full location inventory. These source corrections require
lead/owner coordination outside RELEASE-02's bounded harness proposition.
The CI lint gate remains active; final green acceptance is blocked until the
corrections integrate. npm installation also reports the existing 20 dependency
advisories (1 low, 4 moderate, 15 high); this WP does not upgrade application
dependencies.

## Verification record

Local: macOS, Node 22.23.3/npm 10.9.9. Fresh `npm ci`, full behavior suite
(4 tests), full browser suite (8 cases across two projects), both targeted
commands above, and targeted ESLint passed. `npm run test:watch` completed its
initial four tests, stayed in watch mode, and was terminated with SIGINT; the
script uses explicit `--watch` so non-TTY use does not silently become one-shot.

Controlled failure proof used two temporary, uncommitted files and the actual
configured setup/fixtures:

- `npm test -- tests/behavior/controlled-failure.test.js`: exit 1, two expected
  failures (wrong assertion; a caught fetch to
  `https://release-02-unhandled.invalid/` still failed the MSW teardown guard).
- `npm run test:browser -- tests/browser/controlled-failure.spec.js --project=chromium-desktop`:
  exit 1, two expected failures (wrong assertion; a caught external fetch still
  failed the browser teardown guard). Screenshots/traces were generated.

Both files were removed after the probes. To reproduce, temporarily add a test
under the matching discovery path containing
`expect('observed').toBe('deliberately wrong')`. For the network probe, behavior
tests can await `fetch('https://release-02-unhandled.invalid/').catch(() => {})`;
browser tests first navigate to the fixture and run that fetch in
`page.evaluate`. Each must exit nonzero, even though the rejection is caught.
Remove the temporary tests and rerun `npm run test:all` afterward.

The first draft-PR [Actions run](https://github.com/mssn-futa/pythagoras-frontend/actions/runs/38956629253)
executed all four jobs on Linux: build, behavior and browser passed; lint failed
on the baseline inventory above. No all-green CI or completed WP acceptance is
claimed. Follow-up documentation commits also run the full suite.

RELEASE-02 exposes executable commands for PLAT-04, RELEASE-04 and RELEASE-06.
Command availability is distinct from green baseline acceptance and from real
product/browser integration evidence. No migrations or provider changes.
