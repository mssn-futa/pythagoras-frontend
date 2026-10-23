# Frontend foundation review — 2026-10-23

## Scope and authority

PLAT-01 import repair, RELEASE-02 harness/CI, and RELEASE-10 integrity/lint repair.
Root docs: `/Users/ade/project-pythagoras`; governing D0/D1/D5 and takeover
amendment; RELEASE-10 dispatch revision `48e8b2e085ebd9756a943b7538627533c9f10cd2`.
Implementation worktree: `/Users/ade/project-pythagoras-worktrees/RELEASE-10-frontend`.
Feature integration: `feat/platform-foundation` → `dev`, held for human testing.

## Review

What this change does: restores readable declarative build/test configs, repairs
source lint failures without disabling rules, and composes the existing import
repairs with executable behavior/browser verification.

- Removed the hidden executable tail in both configs and their `createRequire`
  shims. Retained all original declared Tailwind settings and Vite test isolation.
- Reviewed root package scripts, Vite/Tailwind/ESLint configs, Vitest/Playwright
  configs, test setup, MSW and browser request guards, and the Actions workflow.
  Inspected the application entry/asset repairs and connected layout/navbar code.
- Theme state now reads storage at initialization. The effect alone synchronizes
  the root class/storage. Its functional state updater has no side effects.
  Regression tests exercise saved dark/light state, remount, a stale root class,
  and user toggles under Strict Mode.
- Ref initialization no longer reads/writes `.current` during rendering.
  Prototype callbacks and hook dependencies pass the existing React rules.
- Assumed load: a single browser session for these local state changes; isolated
  test processes/contexts for the harness. No backend concurrency claim.

Verdict for the reviewed repository change: ship into the feature integration
branch after green CI. Product acceptance and host/credential incident remediation
are separate and are not certified by these checks.

## Verification

macOS, Node 22.23.3 / npm 10.9.9, new worktree/dependency installation:

| Command | Result |
|---|---|
| `npm ci --ignore-scripts` | Pass; no dependency lifecycle scripts executed |
| `npm run lint` | Pass; zero findings, no rule suppression |
| `npm run build` | Pass; 2,365 modules |
| `npm test` | Pass; 6 tests |
| `npm run test:browser` | Pass; 8 cases, Chromium desktop/mobile |
| `git diff --check` | Pass |

Controlled-failure proof was rerun with temporary uncommitted test files:

- `npm test -- tests/behavior/controlled-failure.test.js`: exit 1; both a wrong
  assertion and a caught unhandled external fetch failed, the latter in teardown.
- `npm run test:browser -- tests/browser/controlled-failure.spec.js --project=chromium-desktop`:
  exit 1; both deliberate failures detected; failure traces/screenshot produced.
- Both files were removed, then the normal suite rerun. Reproduction procedure:
  [testing notes](testing.md#verification-record).

CI runs the complete four-job Linux matrix on the PR. See PR #25 and subsequent
feature/WP PR runs for the exact head SHA and CI outcomes; local success alone is
not a CI claim. No migrations, application data writes, or provider tests.

## Remaining limits

- Harness samples prove infrastructure, not live accounts/content/assessments.
  PLAT-04 and domain WPs still replace historical timer/sample-data behavior.
- The existing bundle-size warning and 20 dependency advisories remain. No
  package version changes were made as part of this repair.
- Historical commits retain the removed payload as audit evidence. Do not run
  old checkout configurations. Removing these two payloads is not proof that the
  host or previously exposed credentials have been remediated.
- Full user journeys, deployment/provider checks, and human acceptance remain
  required under their assigned WPs. No production readiness is claimed.
