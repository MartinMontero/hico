# Goose Desktop handoff — HI CO MVP preview

## Purpose and limits

These prompts finish the work that needs Martin's Windows computer, Cloudflare login, real property content, physical devices, or independent human reviewers. They do not approve production. They do not decide any open item in `docs\03-DECISIONS.md`.

Use one prompt at a time, in order, in a fresh Goose Desktop session with `$HOME\dev\hico` open. Goose must read `docs\01-project-instructions.md`, `docs\02-STATE.md`, `docs\03-DECISIONS.md`, `docs\10-BUILD-PLAN.md`, `docs\11-DEPLOY.md`, this file, and the current preview plan before acting. Only a numbered row in Decisions is decided. Martin makes every product and deployment call.

Evidence labels: `[V]` verified from raw output, `[R]` reported with its source named, `[I]` inferred, `[A]` assumed, `[U]` unknown. Never invent a result. Preserve raw output in a new evidence file under `docs\spikes\`; do not overwrite an earlier run. Secrets, preview links containing the key, staff invite or recovery links, and guest data never go into chat, Git, screenshots, or evidence files.

The only deployment target in these prompts is `hico-preview` on its `workers.dev` address. Never deploy or alter `hico`, `hico-prod`, `mec-trails`, `lume`, or `lume-city`. Do not attach DNS or a custom domain. Do not migrate a production database. Every Cloudflare write needs Martin's explicit GO immediately before that write.

## Prompt 1 — synchronize and prove the branch locally

This is a Goose Desktop prompt.

```text
Work in $HOME\dev\hico on Windows. Use PowerShell only for commands you give me. Read the project rules and documents listed in docs\goose\MVP-HANDOFF.md before changing anything.

Task: synchronize the cloud branch and establish a clean local baseline. Do not deploy, create a remote resource, change DNS, or handle a secret.

1. Show the current branch, working-tree status, and remotes. Preserve any uncommitted work; do not reset, clean, stash, or overwrite it without showing it to Martin and receiving instructions.
2. Fetch origin. Check out cloud/kimi-mvp-preview and make it exactly match origin/cloud/kimi-mvp-preview only if the working tree is clean. Never commit to main.
3. Confirm that node --version is 24 or newer. Run npm ci. Do not run npm audit fix or npm audit fix --force.
4. Run npm run validate. Save the complete raw command output, including the exit code and produced performance values, as a new file under docs\spikes\. If anything fails, diagnose and fix the cause without weakening or deleting a test. Rerun the complete validation after every fix.
5. Run npm audit --json and save a dependency review that separates runtime dependencies from development-only tooling. Do not treat a development-only finding as harmless without tracing whether its code reaches the Worker or browser bundle.
6. Review the actual branch diff against main for accidental files, secrets, personal information, changed workflow files, weakened tests, unsourced guest- or staff-facing numbers, and unannounced decisions. Report findings; do not silently change product scope.
7. Update docs\02-STATE.md and docs\spikes\kimi-mvp-preview-evidence.md with only results supported by the raw output. Do not claim a deployed preview, real content, native French review, independent security review, or human-device testing.

Done when: the exact branch head is recorded, npm run validate exits 0 on Martin's machine, raw output is saved, the dependency and diff reviews are written, and no remote Cloudflare resource changed.

Stop and ask: if the working tree is not clean, Node 24 is unavailable, validation cannot be made green without weakening a check, a secret is found, or a product/deployment decision is needed.
```

## Prompt 2 — create and deploy the gated preview, only after Martin's GO

This is a Goose Desktop prompt.

```text
Work in $HOME\dev\hico on Windows. Use PowerShell only for commands you give me. Read the project rules and documents listed in docs\goose\MVP-HANDOFF.md. Prompt 1 must be complete and npm run validate must be green.

Task: prepare and, only after the explicit approvals below, create and deploy the gated hico-preview Worker. This is not production and not the existing hico prototype.

Before any write, show Martin this exact list of Cloudflare changes: create one D1 database named hico-preview; apply the repository migrations to that new empty preview database; set ACCESS_KEY, SESSION_PEPPER, and RATE_LIMIT_SECRET on hico-preview; deploy hico-preview to workers.dev. Ask for one explicit GO covering that list. Do not proceed without it. Any additional change needs a separate GO.

1. Check out the validated cloud/kimi-mvp-preview commit from Prompt 1. Confirm the top-level Worker name in wrangler.jsonc is hico-preview and its D1 ID is still the zero placeholder. Confirm no custom domain or production environment is selected.
2. Run npx wrangler whoami. Report the account identity only to the extent needed to confirm the intended account; do not print tokens.
3. Announce the D1 write, then run: npx wrangler d1 create hico-preview --location wnam. Put the returned database ID only in the local top-level preview D1 entry in wrangler.jsonc. Do not put it in production.
4. Determine the exact workers.dev hostname Wrangler will use. Set top-level RP_ID to that hostname and ALLOWED_ORIGINS to its HTTPS origin. Keep PREVIEW_GATE on. Run scripts\launch-check.ps1 -PreviewHost <that-exact-hostname>. It must exit 0.
5. Announce the remote migration. List the migrations first, inspect that the target is hico-preview, then apply them to that preview D1 only. Save raw output with no guest or staff data.
6. Generate each secret locally with cryptographic randomness. Never print, log, commit, or paste a secret into the conversation. Put ACCESS_KEY in Martin's password manager through the clipboard, clear the clipboard afterward, and pipe it directly to wrangler secret put ACCESS_KEY --name hico-preview. Generate SESSION_PEPPER and RATE_LIMIT_SECRET locally and pipe each directly to its own wrangler secret put command without displaying it. Announce these three writes before running them.
7. Run npx wrangler deploy --dry-run and inspect the Worker name and configuration. Announce the deployment write, then run npx wrangler deploy with no --env flag. Stop if the target is not hico-preview.
8. Record the deployed version ID, branch commit, preview hostname, migration output, and command exit codes in a new evidence file. Record no secret or key-bearing URL.

Done when: only hico-preview was created or changed, all three secrets were set without exposure, the new preview D1 has the repository migrations, deployment exited 0, and the evidence identifies the exact code and Cloudflare version.

Stop and ask: before every unlisted Cloudflare write; if the account or Worker name is wrong; if a command would touch production, DNS, or an existing non-preview database; or if any check fails.
```

## Prompt 3 — verify the deployed gate and application

This is a Goose Desktop prompt.

```text
Work in $HOME\dev\hico on Windows. Use PowerShell only for commands you give me. Read the project rules and documents listed in docs\goose\MVP-HANDOFF.md. Prompt 2 must be complete. Do not redeploy or change a Cloudflare resource in this prompt.

Task: verify the existing hico-preview deployment and produce an honest human-test readiness report.

1. Run scripts\verify-deploy.ps1 -PreviewHost <the-exact-hico-preview-workers.dev-hostname>. Save the complete raw output and exit code. It sends unauthenticated requests only. A flat 404 for protected pages, assets, and APIs and a public Disallow robots response are required.
2. In a private browser session, redeem the preview link without putting its key in any file or transcript. Confirm the redirect removes the key from the address bar. Inspect the preview cookie and record only that HttpOnly, Secure, and SameSite=Lax are present; never record its value.
3. Verify the guest app, staff sign-in page, APIs, service worker, manifest, and icons are reachable only after authorization. Confirm no third-party request, analytics beacon, HI logo, unlabelled sample content, or privacy-contact editor appears. Keep O-25 open.
4. Exercise a labelled QR link and confirm that its aggregate count increases once for the intended property while no guest cookie or device identifier is created. Do not expose another property's count.
5. Create or use only disposable preview staff accounts and sample content. Verify admin/editor authorization, a deliberate cross-property request, import dry-run/apply, content health, aggregate counts, export, and audit records. Never use real guest data.
6. If any check fails, do not hand the link to testers. Write the failure and raw evidence. A fix or redeploy requires a new prompt and any required GO.

Done when: raw unauthenticated and authorized checks pass, cookie attributes are verified without recording the value, cross-property access fails, and the evidence clearly states what was and was not tested.

Stop and ask: if any protected route is public, a secret or personal datum appears, tenancy fails, a production resource is implicated, or a product decision is needed.
```

## Prompt 4 — onboard real property content without inventing anything

This is a Goose Desktop prompt.

```text
Work in $HOME\dev\hico on Windows. Use PowerShell only for commands you give me. Read the project rules and documents listed in docs\goose\MVP-HANDOFF.md, docs\09-CONTENT-AND-ONBOARDING.md, and the content templates. Do not deploy or change Cloudflare resources in this prompt.

Task: turn content supplied by the properties into validated import files. Do not invent, scrape, or infer Downtown or Jericho Beach facts. Martin or the property content owner must supply every fact.

1. Record the source and approval for each supplied item. If content for a property is absent, leave its file absent and report the gap.
2. Copy the appropriate template from docs\content-templates\ and replace every REPLACE_WITH_PROPERTY_CONTENT marker. Use one content type per JSON file, new records only, at most 100 items per file, and no update, delete, or cross-property-sharing instruction.
3. Validate English and French text, dates, times, capacity, zone references, partner terms, and map addresses against the supplied source. Do not create a numeric rating or an unsourced guest- or staff-facing figure.
4. Run each file through the staff importer's dry run on the gated preview using a disposable or authorized staff account. Save validation reports with personal data removed. Do not apply until Martin has reviewed the dry-run output and explicitly approves the content import.
5. After approval, apply once with the exact server-issued confirmation. Confirm per-row audit entries and the summary audit entry. Imported rows must remain unverified until staff explicitly re-check them.
6. Use content health to list missing, unverified, stale, and sample content. Property staff must perform the real verification; Goose must not click Still correct as a substitute for their review.

Done when: only sourced and approved content is imported, dry-run and apply evidence is saved, no replacement marker remains, and every imported item still requires genuine staff verification.

Stop and ask: for missing or contradictory source content, an update/delete requirement, shared-activity ownership ambiguity, a new visible number, or any approval that is not explicit.
```

## Prompt 5 — run the human preview test programme

This is a Goose Desktop prompt.

```text
Work in $HOME\dev\hico on Windows. Use PowerShell only for commands you give me. Read the project rules and documents listed in docs\goose\MVP-HANDOFF.md and docs\04-PRODUCT-SPEC.md. Do not change code, Cloudflare, or content unless Martin separately approves a fix.

Task: organize and record human testing; do not claim to have performed physical-device or human-assistive-technology checks yourself.

1. Prepare a small tester matrix covering current iOS Safari and Android Chrome, desktop keyboard-only use, a screen-reader user, a native Québécois French reviewer, a property admin, and a property editor. Names and personal details stay out of Git.
2. Give testers only sample or explicitly approved content. Record app version, preview version ID, device/browser, test date, and result. Never record preview keys, passkey material, invite/recovery links, guest identifiers, or free-text personal data.
3. Test installability, offline reload, Delete my data, English/French, 200% text, reduced motion, keyboard focus, screen-reader announcements, QR scanning with a real reader, aggregate counting, passkey creation/sign-in/recovery, editor/admin rights, import/export, audit, content health, and cross-property denial.
4. Require the native French reviewer to approve or correct the first-draft staff and guest strings, including content health. D-19 remains unsatisfied until that human review is recorded.
5. Classify each failure by severity and include exact reproduction steps and evidence that contains no secret or personal data. Do not lower a test's expected result to make it pass.
6. Produce a go/no-go report for further human preview testing only, not production.

Done when: every matrix row has a human result or an explicit untested gap, French and screen-reader reviews are recorded by their reviewers, and failures have actionable reports.

Stop and ask: before inviting testers if real property participation is not approved, if privacy-sensitive data would be collected, or if any failure exposes another property or a secret.
```

## Prompt 6 — obtain an independent security review

This is a Goose Desktop prompt.

```text
Work in $HOME\dev\hico on Windows. Use PowerShell only for commands you give me. Read the project rules and documents listed in docs\goose\MVP-HANDOFF.md and docs\05-ARCHITECTURE.md. Do not deploy or change Cloudflare resources.

Task: prepare a security review package and have a reviewer independent of the code author examine it. Goose's self-review is useful but is not independent.

1. Record the exact commit and deployed preview version. Review OWASP A01-A10 with emphasis on tenant resolution, property_hosts, staff roles loaded per request, WebAuthn, sessions, invite/recovery tokens, preview gating of APIs and assets, import confirmation, D1 batch atomicity, audit coverage, cache headers, browser storage, service-worker caching, QR counters, and log contents.
2. Run the repository's complete validation and secret/history scans. Trace the 16 reported npm findings to runtime or development use; do not automatically upgrade or dismiss them.
3. Test deliberate cross-property and cross-role attacks, signed-out access, expired/replayed tokens, duplicate imports, malformed host/path input, and cache behavior. Preserve raw results without secrets or personal data.
4. Give the independent reviewer the code, architecture, data flows, raw tests, dependency review, and threat model. Record their identity only with their permission; otherwise record the organization and review date. Their findings remain unchanged in the evidence.
5. Fix accepted findings only under Martin's instruction, add regression tests first where practical, and rerun complete validation. Any security-code change receives another independent review.

Done when: the independent written report is present, every finding has an owner and status, no high-risk finding is hidden, and production remains explicitly blocked unless Martin separately approves it after all other gates.

Stop and ask: for any confirmed tenant-data exposure, authentication bypass, secret exposure, unsafe remediation, or request to suppress a finding.
```

## Prompt 7 — close the preview handoff; do not launch production

This is a Goose Desktop prompt.

```text
Work in $HOME\dev\hico on Windows. Use PowerShell only for commands you give me. Read every document listed in docs\goose\MVP-HANDOFF.md and all evidence produced by Prompts 1-6.

Task: close the human-test preview handoff with an accurate state and a separate list of production gates. Do not deploy production, attach DNS, create production resources, or mark an open decision resolved.

1. Confirm that the code commit, local validation, GitHub Actions run, Cloudflare preview version, and test evidence all refer to the same code. If they do not, stop and identify the mismatch.
2. Update docs\02-STATE.md and docs\spikes\kimi-mvp-preview-evidence.md with verified results, reported human results, assumptions, unknowns, and every remaining gap. Keep raw run files append-only.
3. Run the latest independent verifier under verifier\ and append a run record containing the real timestamp, command, exit code, and produced values. Do not edit an earlier verifier version or run record.
4. Prepare Martin's review packet: branch diff, validation evidence, preview URL without its key, dependency findings, independent security report, content approval status, French/accessibility/device results, and open decisions.
5. State separately what is ready for gated human testing and what blocks production. Production still needs Martin's explicit decisions and the ownership, privacy, measurement, content, security, and operational evidence required by the project documents.

Done when: the verifier passes on the exact handoff tree, all evidence is consistent, no secret or personal datum is tracked, and the report does not claim production readiness.

Stop and ask: Martin must make every merge, production, DNS, ownership, privacy, measurement, and launch decision. Do not infer approval from a passing test or a successful preview.
```
