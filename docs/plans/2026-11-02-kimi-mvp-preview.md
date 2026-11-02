# HI CO MVP preview plan — 2026-11-02

## Request and boundaries

Martin asked for the repository and prototype to be taken as far as possible toward a human-testable MVP using GitHub and Cloudflare, with a Goose Desktop handoff for local-only work. This plan covers that request on `cloud/kimi-mvp-preview`; it does not add a decision row or resolve an open decision.

Approved scope used here:

- Work only on a `cloud/` branch (D-41); CI validates every push (D-42).
- Prepare a gated, placeholder-content preview, not production (D-21, D-22, D-25).
- Use only `hico-preview`; never touch `hico`, `hico-prod`, `mec-trails`, `lume`, or `lume-city`.
- Do not attach a custom domain or DNS, create production resources, or put a secret in GitHub, chat, or a tracked file.
- Keep O-25 open: no privacy-contact editor is included. Keep the visible missing-contact placeholder.
- Do not invent property content. Templates contain replacement markers, not usable hostel facts.

## Verified starting point

Read on 2026-11-02 from GitHub `main` at `46b363de9234d62eec45931870a5a573d58b4a23`:

- `docs/01-project-instructions.md`, `docs/02-STATE.md`, `docs/03-DECISIONS.md`.
- Topic owners: `docs/05-ARCHITECTURE.md`, `docs/09-CONTENT-AND-ONBOARDING.md`, `docs/10-BUILD-PLAN.md`, `docs/11-DEPLOY.md`, `docs/13-MISSING-ITEMS.md`, `docs/14-CLOUD-BUILD.md`.
- `wrangler.jsonc`, application routes and repositories, staff schemas, seed, tests, and CI.

The state document reports Phase 1, 1b, and 2 complete. Those reports remain claims until this branch's raw CI validate output is seen. No `content/downtown` or `content/jericho` directory exists, so real-property onboarding cannot be completed.

Cloudflare read-only checks on 2026-11-02 found the active `builderworkshop.ca` zone and no `hico-preview` Worker or D1 database. The account and existing resources were not changed.

## Work slices

1. **Independent verification and inputs.** Add `verifier/` acceptance checks and clearly marked content templates. Record every verifier run, including failures.
2. **Phase 3 delivery tooling, test-first where code permits.** Add admin-only bulk import with dry-run before explicit apply, aggregate daily counters, `launch-check.ps1`, and `verify-deploy.ps1`. Extend tenant-isolation, role-matrix, audit, anonymous-surface, and browser coverage. No schema migration is planned.
3. **Preview configuration.** Replace the preview database placeholder only after a real preview database exists. Configure passkey origin and host mappings for the actual preview hostname. Keep production configuration inert.
4. **CI/CD.** Keep GitHub validation independent of Cloudflare credentials. If the Cloudflare GitHub integration and token are available, connect only this branch to `hico-preview` through Workers Builds. Do not connect `main` or `hico-prod`.
5. **Remote verification.** Use raw Cloudflare API and HTTP responses to verify the deployed gate, security headers, absence of third-party beacons, tenant behaviour, and build status. Never print a secret.
6. **Goose handoff.** Supply complete PowerShell-only prompts for secrets, any local-only validation, real content import, human device/accessibility/French review, security re-review, and production gates that remain open.

## Acceptance criteria

- `npm run validate` passes on the final branch in GitHub Actions; raw run identifiers and output are linked or saved.
- The independent verifier passes and its complete run history is preserved.
- Every new staff mutation is admin-scoped where required, tenant-scoped, audited, covered by tests, and dry-run before apply.
- No placeholder is presented as verified property content; no real privacy contact, offer, rating, or partnership is invented.
- Cloudflare changes, if authorised and possible, affect only new `hico-preview` resources and are individually reported.
- No secret value appears in the repository or response. No production deploy, DNS change, or open-decision implementation occurs.
- The Goose prompts are complete, ordered, paste-ready, and distinguish required local steps from human-only gates.

## Stop conditions

Stop the affected step on an unexpected existing resource, a request for an unmade decision, a failed tenant-isolation or security check, missing Cloudflare GitHub integration/token permission, or any requirement to expose a secret. A failed remote step does not justify weakening tests or switching to production.
