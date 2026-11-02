# HI CO MVP preview — evidence and remaining gates

**Evidence session:** 2026-11-02. This file records the cloud preview work; it is not a release approval.

## Documents used

`docs\01-project-instructions.md`, `docs\02-STATE.md`, `docs\03-DECISIONS.md`, `docs\10-BUILD-PLAN.md`, `docs\11-DEPLOY.md`, `docs\plans\2026-11-02-kimi-mvp-preview.md`, and the source and tests named below. The historical state and validation totals in older documents remain reported claims until independently reproduced.

## Implemented on the cloud branch

- `[V]` New-content-only staff import with replacement-marker JSON templates, dry-run validation, exact confirmation, repeat checks on apply, tenant-scoped writes, and per-row plus summary audit records.
- `[V]` Admin-only aggregate counts limited to property/day/event/count rows. No guest, device, session, IP address, or user-agent field is returned.
- `[V]` Admin-only content health covering activities, places, offers, and zones. It reports missing, unverified, stale, and sample content using D-33's existing check-limit constants. Zones have no verification stamp and therefore report only total/missing state.
- `[V]` English and first-draft French staff strings for the new screens. Native Québécois review remains `[U]` under D-19.
- `[V]` `scripts\launch-check.ps1` checks local prerequisites and preview configuration and runs complete validation. It does not deploy or change a remote resource.
- `[V]` `scripts\verify-deploy.ps1` sends unauthenticated requests only and checks the closed preview gate. It accepts no secret.
- `[V]` Operator SQL uses a unique temporary file and removes it after success or failure. Remote execution remains refused in the library.

## Local raw validation

`[V]` On 2026-11-02 the complete validation script ran with Node 24.22.2 in a clean Linux directory and exited 0. The exact invocation was `npx -y -p node@24 node scripts/validate.ts`; this runs the same steps as `npm run validate` while selecting the required Node version. The captured output, including every step result, test total, and produced value, is in `docs\spikes\kimi-mvp-preview-validate.txt`; its header discloses that repetitive per-request JSON and per-test stdout context were omitted.

- 39 unit/isolation test files passed: 587 tests passed, 2 skipped.
- 43 browser tests passed, including the automated axe, 360-pixel, keyboard, offline, and staff/guest flows.
- Type checking, lint, contrast, build, Worker-name checks, bundle budgets, built-output checks, and Lighthouse all passed.
- Contrast: 24 measured pairs, 0 below the configured WCAG minima.
- Initial JavaScript: 22,112 bytes gzip against the 61,440-byte budget. Staff chunk: 31,795 bytes gzip against the 92,160-byte budget.
- Lighthouse mobile, simulated slow 4G and 4× CPU, median of three runs:
  - What's On: LCP 2,057 ms; TBT 30 ms; CLS 0.000.
  - Explore: LCP 2,147 ms; TBT 5 ms; CLS 0.035.

The first full run failed because the pinned Playwright browser was absent. The browser was installed and the complete suite was rerun. A later invocation exceeded the command wait window during Lighthouse; the final uninterrupted background run above is the passing record. No test was skipped or weakened to obtain it.

## Preview/offline follow-up validation

`[V]` Review found that the preview gate marked every authorised response `private, no-store`, while the service worker rejected every `private` response. This made guest offline storage impossible behind the gate. The fix in `worker\preview-gate\index.ts` and `web\sw\logic.ts` now preserves upstream `no-store` for staff and other forbidden responses while allowing origin-private guest pages, public reads, and assets to remain in this browser's Cache Storage. Shared caches remain excluded.

`[V]` The new regression first failed against the old behavior: two tests detected the guest-header and cache-predicate conflict. An intermediate implementation still failed the staff-header assertion because Hono merged the previous headers during response assignment. Setting the final gate headers after that assignment fixed it. Focused result: 3 files and 32 tests passed. The cross-layer test uses actual gate responses with the actual service-worker predicate.

`[V]` The complete follow-up validation exited 0 with Node 24.22.2. Its separate condensed raw output is `docs\spikes\kimi-mvp-preview-offline-validate.txt`; the earlier evidence file is unchanged.

- 39 unit/isolation files passed: 587 tests passed, 2 skipped.
- 43 browser tests passed, including offline, staff-storage exclusion, accessibility, keyboard, and tenant/role flows.
- Type checking, lint, 24 contrast pairs, build, Worker names, bundle budgets, built-output checks, and Lighthouse passed.
- Initial JavaScript remained 22,112 bytes gzip against the 61,440-byte budget; the staff chunk remained 31,795 bytes gzip against the 92,160-byte budget.
- Lighthouse mobile, simulated slow 4G and 4× CPU, median of three runs:
  - What's On: LCP 2,059 ms; TBT 6 ms; CLS 0.000.
  - Explore: LCP 2,174 ms; TBT 6 ms; CLS 0.035.

One full-run supervising shell expired during Lighthouse and left no valid exit result. A rerun then failed before application tests because that root-owned attempt left an inaccessible temporary Vite cache. The cache was cleared and the complete command rerun under one consistent user; the uninterrupted exit-0 run above is the accepted result. No test was removed or weakened.

## Dependency evidence

`[V]` A clean `npm ci` installed 416 packages and reported 16 vulnerable package entries: 13 moderate and 3 high. `[V]` Dependency tracing found 10 direct advisories in `minimatch`, `undici`, and `zod`, all reached through development/build/test tooling; the production dependency query was empty and no application-source import was found. `[R]` This supports a development-tooling classification, not a claim that the findings are harmless. Automatic fixes were not applied. Full chains, advisories, and remediation constraints are in `docs\spikes\kimi-mvp-preview-dependencies.md`.

## Exact-head review of the previously published tree

- `[V]` Commit `2fa16f222bbeeca26085f39b23a4e00c9ce85383` was downloaded as a fresh GitHub archive. `diff -qr --exclude=.wrangler` against the validated local tree produced no differences.
- `[V]` GitHub Actions run `41509225065`, job `125497166788`, completed successfully for that exact commit on `cloud/kimi-mvp-preview`. Run 33, attempt 1, completed at `2026-11-02T19:30:36Z`: https://github.com/MartinMontero/hico/actions/runs/41509225065
- `[V]` Independent verifier v2 ran against that downloaded archive with `node verifier/v2/check.mjs`, exited 0, and produced 52 passed checks with 0 failures. The run is recorded in `verifier\runs\2026-11-02T19-31-56Z-v2-remote-pass.md`.

## Exact-head review of the preview/offline code

- `[V]` Commit `5138d00c4b2faa075015a6206ec55f999903712c` was downloaded as a fresh GitHub archive. After aligning two local end-of-file newlines with the published bytes, `diff -qr --exclude=.wrangler` against the validated local tree produced no differences. No application content differed.
- `[V]` GitHub Actions run `41520202549`, job `125534567778`, completed successfully for that exact commit. Run 36, attempt 1, completed at `2026-11-02T20:39:11Z`: https://github.com/MartinMontero/hico/actions/runs/41520202549
- `[V]` Independent verifier v3 ran against that downloaded archive with `node verifier/v3/check.mjs`, exited 0, and produced 98 passed checks with 0 failures. The run is recorded in `verifier\runs\2026-11-02T20-34-42Z-v3-remote-5138-pass.md`.

The following evidence-only commit adds this exact-head record and the read-only Workers Builds result. It changes no application code. Its own Actions result is checked after publication rather than being asserted inside the commit before that run can exist.

## Security and architecture review

`[V]` The same-model OWASP A01–A10 review is in `docs\spikes\kimi-mvp-preview-security-review.md`. It leaves medium findings open for last-admin/last-passkey races, non-atomic account recovery, non-atomic content/audit writes, and development-tool advisories. `[U]` It is not an independent human security review.

`[V]` Three architecture-deepening candidates are recorded in `docs\spikes\kimi-mvp-preview-architecture.md`. None has been selected or implemented; no refactor issue was created.

## Workers Builds read-only feasibility check

`[V]` Cloudflare documentation says the repository connection requires the Cloudflare GitHub App, GitHub account/repository IDs, a build token UUID, and a Worker name matching the Wrangler configuration: https://developers.cloudflare.com/workers/ci-cd/builds/api-reference/ and https://developers.cloudflare.com/workers/ci-cd/builds/ . `[V]` Read-only API calls confirmed access to one Cloudflare account, reported that its build-minute limit had not been reached, and listed nine build-token metadata entries. No token value was read or exposed.

`[U]` Repository configuration autofill returned `authorization required`, and a subsequent specification lookup failed the same way. GitHub App authorization, the exact preview Worker build configuration, and a deployed `hico-preview` therefore remain unconfirmed. No Cloudflare write was attempted.

## What has not been proved

- `[U]` GitHub Actions status for the final evidence-only commit after code commit `5138d00`. It must be checked after that push; the code commit's successful run does not by itself establish the evidence commit's result.
- `[U]` A deployed `hico-preview` Worker or preview D1. No Cloudflare resource was created or changed in this session.
- `[U]` Real Cloudflare hostname, WebAuthn relying-party configuration, secret setup, remote migrations, and deployed gate behavior.
- `[U]` Real Downtown or Jericho Beach content and property approval. No such content was invented.
- `[U]` Real-device installation, QR scanning with a reader, physical passkeys, screen-reader review, native French review, and human guest/staff usability.
- `[U]` Independent security review. A same-model review is not independent. Production requires the separate reviewer and all other project gates.
- `[U]` GitHub App authorization for Workers Builds and the exact preview build configuration. Basic Builds API access was readable, but repository autofill was not authorized. No GitHub-to-Cloudflare connection was configured.

## Boundaries preserved

No production deployment, DNS or custom-domain change, live database migration, secret generation in chat, tracked secret, production Worker change, privacy-contact editor, social feature, or new decision row was made. `hico`, `hico-prod`, `mec-trails`, `lume`, and `lume-city` were not deployed or altered. O-25 remains open.

## Handoff

`docs\goose\MVP-HANDOFF.md` contains ordered, whole prompts for local validation, explicitly approved preview resource creation/deployment, deployed verification, sourced content onboarding, human testing, independent security review, and final evidence closure. Each prompt states its completion condition and when to stop for Martin.
