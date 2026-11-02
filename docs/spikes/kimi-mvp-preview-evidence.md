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

`[V]` On 2026-11-02 the complete validation script ran with Node 24.22.2 in a clean Linux directory and exited 0. The exact invocation was `npx -y -p node@24 node scripts/validate.ts`; this runs the same steps as `npm run validate` while selecting the required Node version. Raw output, including all produced values, is in `docs\spikes\kimi-mvp-preview-validate.txt`.

- 39 unit/isolation test files passed: 587 tests passed, 2 skipped.
- 43 browser tests passed, including the automated axe, 360-pixel, keyboard, offline, and staff/guest flows.
- Type checking, lint, contrast, build, Worker-name checks, bundle budgets, built-output checks, and Lighthouse all passed.
- Contrast: 24 measured pairs, 0 below the configured WCAG minima.
- Initial JavaScript: 22,112 bytes gzip against the 61,440-byte budget. Staff chunk: 31,795 bytes gzip against the 92,160-byte budget.
- Lighthouse mobile, simulated slow 4G and 4× CPU, median of three runs:
  - What's On: LCP 2,057 ms; TBT 30 ms; CLS 0.000.
  - Explore: LCP 2,147 ms; TBT 5 ms; CLS 0.035.

The first full run failed because the pinned Playwright browser was absent. The browser was installed and the complete suite was rerun. A later invocation exceeded the command wait window during Lighthouse; the final uninterrupted background run above is the passing record. No test was skipped or weakened to obtain it.

## Dependency evidence

`[V]` A clean `npm ci` installed 416 packages and reported 16 findings: 13 moderate and 3 high. Automatic fixes were not applied. `[U]` Whether each finding is exploitable in HI CO, and which are development-only, requires the dependency tracing assigned in Goose Prompt 1. An audit total alone is not a security conclusion.

## What has not been proved

- `[U]` Final GitHub Actions status for the exact final branch head. It must be checked after the final push; an intermediate commit's result does not establish the final result.
- `[U]` A deployed `hico-preview` Worker or preview D1. No Cloudflare resource was created or changed in this session.
- `[U]` Real Cloudflare hostname, WebAuthn relying-party configuration, secret setup, remote migrations, and deployed gate behavior.
- `[U]` Real Downtown or Jericho Beach content and property approval. No such content was invented.
- `[U]` Real-device installation, QR scanning with a reader, physical passkeys, screen-reader review, native French review, and human guest/staff usability.
- `[U]` Independent security review. A same-model review is not independent. Production requires the separate reviewer and all other project gates.
- `[U]` Workers Builds access and prerequisites. No GitHub-to-Cloudflare connection was configured.

## Boundaries preserved

No production deployment, DNS or custom-domain change, live database migration, secret generation in chat, tracked secret, production Worker change, privacy-contact editor, social feature, or new decision row was made. `hico`, `hico-prod`, `mec-trails`, `lume`, and `lume-city` were not deployed or altered. O-25 remains open.

## Handoff

`docs\goose\MVP-HANDOFF.md` contains ordered, whole prompts for local validation, explicitly approved preview resource creation/deployment, deployed verification, sourced content onboarding, human testing, independent security review, and final evidence closure. Each prompt states its completion condition and when to stop for Martin.
