# BUILD PLAN — HI CO

The route from the prototype to a production application, one Claude Code session per
phase. Every prompt below is whole and ready to paste. Labels as in `00-README.md`.

## How to use this file

1. Start each phase in a fresh session in the Claude Code desktop app, with the folder
   `C:\Users\User\dev\hico` open. There is no launch command: the app starts the session,
   and the session runs its own commands in PowerShell `[V]`
   (`docs\spikes\preflight-rerun.md`).
2. Paste that phase's prompt. `CLAUDE.md` is loaded automatically, so prompts do not
   repeat its rules; they restate only what the phase needs.
3. Anything larger than a one-file change starts with a written plan in
   `docs\plans\` and waits for your GO. That is in `CLAUDE.md` and each prompt says
   so again where it matters.
4. After each phase, upload the changed `02-STATE.md` and `03-DECISIONS.md` to the
   Claude.ai Project.
5. After any phase you may run the **review prompt** at the end of this file in a new
   session. It is the check by an agent that did not do the work.

## Order and gates

| Phase | What | Needs before it starts | Blocked until you call |
| --- | --- | --- | --- |
| 0 | Repository bootstrap | The package zip in `Downloads` | nothing |
| 0.2 | Framework spike, gate G0 | **Waived (D-12).** Not run for the demo | nothing |
| 1 | Foundation | D-12 recorded (done) and `docs\spikes\G0-framework-report.md` | your GO on its plan, which settles the D-15 data model |
| 1b-1 | Staff-auth spike | Phase 1 | nothing |
| 1b-2 | Staff auth and console (in the demo, D-22) | 1b-1 report | O-02 |
| 2 | Guest Stage 0 | 1b-2 | nothing (O-13 and O-14 are D-17 and D-18) |
| 3 | Downtown and Jericho Beach onboarding and gated preview | 2; content from both hostels | nothing for the demo (O-03, O-09, O-10 are D-21, D-20, D-19) |
| 3b | Stage 0 to production | 3; HI Canada's answers to `06` §7 items 1 to 6; Workers Paid | O-05, O-07, O-11 (the baseline has to exist before launch) |
| 4 | Stage 1: Unlock your savings (declared membership) | 3b live and the Stage 0 gate met | the HI Canada offer terms |
| 4b | Membership verification | Answers from Cobber via HI Canada | O-08 |
| 5 | Stage 2: RSVP counts, Common Room and guest sessions | Stage 1 gate met; answers to `06` §7 items 7 to 9 | O-01, O-06 |
| 6 | Stage 3: Connect and Nearby (Tier 1) | Stage 2 gate met; answer to `06` §7 item 10 | O-04 |
| 7 | Wallet pass spikes, then build | Stage 3 running | O-15 |
| 8 | Tenant two and hardening | Any stage live | nothing new |

**The demo path (D-22) is Phases 1, 1b-1, 1b-2, 2 and 3,** with Phase 3 covering both
Vancouver hostels. Phase 0 is done and Phase 0.2 is waived. Phase 3b onward is not part
of the demo. Every phase waits for your GO. O-12 (a private remote repository and CI)
blocks nothing; local git works until you decide.

## What only HI Canada can supply

The build cannot proceed past these without answers from outside the project. You ask;
Claude can draft the request when you tell it to. Nothing in the package says any of
them has been asked.

| Input | Needed before | If the answer is no, or never comes |
| --- | --- | --- |
| HI Canada's and Downtown's agreement to take part (D-02 records only your decision) | Showing the preview to the property | No tenant; the demo stays internal |
| Permission to use the "HI" name and logo (O-03) | Phase 3b | HI CO gets a neutral name and look, or does not launch under the mark |
| Content for Downtown and Jericho Beach; the owner of updates is Fawzie (D-20) | Phase 3 | Demo content only; no launch |
| The Stage 0 measure, baseline and threshold (O-11) | Phase 3b | Stages cannot be promoted by evidence; promotion becomes your judgment call |
| HI Canada's privacy officer, and answers to `06` §7 items 1 to 6 | Phase 3b | Production stays at the gated preview |
| Answers to `06` §7 items 7 to 9; HI Canada's policy on minors (O-06) | Phase 5 | Stages 2 and 3 are not built |
| Answer to `06` §7 item 10 (item 11 only if distance bands between guests are ever proposed) | Phase 6 | Stage 3 is not built |
| Exact membership offer terms | Phase 4 | Offers appear with no membership claim |
| Answers to the four questions to Cobber (`07` §6) | Phase 4b | Membership stays self-declared |
| A domain on your Cloudflare account, and who pays for Workers Paid (O-03, O-07) | Phase 3b | No production |
| `builderworkshop.ca` as a zone on the Cloudflare account Wrangler logs in to, for the demo domain (D-21) | Attaching the demo domain in Phase 3 | The demo stays on its `workers.dev` address |
| A native Québécois French reviewer | Any Quebec-facing deployment | English and French drafts only; no Quebec launch |


---

## Phase 0 — Bootstrap the repository

Claude Code prompt (run in `C:\Users\User\dev\hico`):

```text
Objective: create the HI CO repository at C:\Users\User\dev\hico from the project
package already unpacked into C:\Users\User\dev\hico\_package. Nothing is installed or
deployed yet and nothing is to be.

Until CLAUDE.md is in place these rules apply: PowerShell only (no bash, no &&, no
heredocs, no forward-slash paths), copy never move, no deploy, no remote anything.

Do:
1. Copy (never move) 00-README.md and every numbered document from 01 to 12 in
   _package into docs\. Copy CLAUDE.md from _package to the repo root. Create
   reference\, docs\plans, docs\spikes and docs\external.
2. Preflight. Run each of these in PowerShell on this machine and show the raw output
   of each. If a command is missing, say so and carry on. Install nothing.
   a. $PSVersionTable.PSVersion and $PSVersionTable.PSEdition; node --version;
      npm --version; git --version; claude --version; Get-Command wrangler,pwsh
      -ErrorAction SilentlyContinue (this shows whether Wrangler is installed and
      whether PowerShell 7 sits beside Windows PowerShell 5.1).
   b. The key recipe in docs\11-DEPLOY.md section 2, without its Set-Clipboard and
      wrangler lines. Print only the key's length, whether it matches
      ^[A-Za-z0-9_-]+$, and whether two runs differ. Never print the key.
   c. The timestamp line in section 4, and the backup-folder line using a folder named
      hico-preflight-test under $HOME\dev instead. Show that the folder exists, then
      remove it.
   d. Build a zip of the 14 files in _package inside $env:TEMP, extract it twice into a
      temporary folder, and show that the second extract stops with an error and
      leaves an edited file untouched. Remove the temporary files.
   e. Get-Command Set-Clipboard, Expand-Archive and Get-FileHash, showing that each
      exists.
   Run b to e under every PowerShell found in a (powershell.exe and, if present,
   pwsh). Save the outputs, with today's date and the version each ran under, in
   docs\spikes\preflight.md.
3. Copy C:\Users\User\dev\Serendipty\apps\hico\src\App.jsx to
   reference\hi-co-prototype.jsx. Expected: 913 lines, 60,370 bytes, SHA-256
   e83863ddec504cb188c8525e7fa2c361aa45395d387b52fe291f5b1480dee456. If any of the
   three differs, stop and show me the three values. Do not choose between versions.
4. Use Get-FileHash to confirm every copied file matches its source. Show the table.
5. In docs\02-STATE.md section 4, replace the sentence saying nothing is built with the
   true state after this step: repository exists, documents and reference prototype in
   place. Do not write the commit hash into the file; you will report it.
6. git init, local only, no remote. Add a .gitignore covering node_modules, dist,
   .wrangler, .dev.vars, .env, .env.*, _package, *.log, *.pem, *.p12, *.key, *.cer.
   Commit with the message "Bootstrap: project documents and reference prototype".

Do not: run npm install, create a package.json, modify anything under
C:\Users\User\dev\Serendipty, or contact Cloudflare.

Done when you have shown: (a) the directory tree two levels deep, (b) the hash table,
(c) the git log line, (d) line count, byte count and SHA-256 of
reference\hi-co-prototype.jsx, (e) the preflight output, saved in
docs\spikes\preflight.md.

Stop and ask if: _package is missing or holds fewer than 14 files (00 to 12 plus
CLAUDE.md), any hash differs, git is not available, or git has no user name and email
configured.

Finish by reporting: what changed, decisions I still owe, what you could not verify,
and which documents are now stale.
```

---

## Phase 0.2 — Framework spike (gate G0)

**Waived on 2026-10-23 (D-12). Do not run this phase for the demo.** The report that says
what the sandbox benchmark did and did not cover is `docs\spikes\G0-framework-report.md`.
The prompt below is kept in case measurements on the real screens are wanted later.

Claude Code prompt:

```text
Objective: run gate G0 as defined in docs\05-ARCHITECTURE.md section 2.4. Produce
measurements, not opinions, so that I can choose the front-end framework.

Read first: docs\05-ARCHITECTURE.md section 2, docs\04-PRODUCT-SPEC.md sections 4.1
and 6, docs\02-STATE.md section 2 (row 13 has the contrast pairs), and the
WhatsOnView component and its data in reference\hi-co-prototype.jsx.

Optional input: if $HOME\Downloads\hico-framework-benchmark.zip exists, extract it to
spike\sandbox-benchmark without overwriting anything, and read its README.md. It holds
a measurement made in a Linux sandbox: four plain screens, a Python and Playwright
harness, and the raw results. Use its method as the starting point for measurement 4
and compare your numbers with its results. It does not replace measuring here. Do not
edit it. If Python is not installed on this machine, write the harness in Node with
Playwright instead of installing Python.

Build, in spike\ with its own package.json (nothing else exists yet):
- Four implementations of the What's On screen with the same markup semantics, same
  CSS and same data: React (the baseline, ported from the prototype), Preact, Svelte 5
  and Solid. If docs\03-DECISIONS.md records that React is excluded under O-16, still
  build it, as a measuring baseline only. Data: the prototype's 10 activities repeated
  with new ids to make 40 items across the seven days.
- Each must meet the accessibility rules in 04 section 6 as far as one screen goes:
  real buttons for the day strip and filters with aria-pressed, visible focus, 44 px
  targets, 4.5:1 text contrast using the AA-safe pairs in 02 section 2 row 13, no
  text under 12 px, and prefers-reduced-motion respected. All four implement the
  same accessibility behaviour. Do not give one framework help the others lack.
- Use the Cloudflare Vite plugin so each variant serves its assets and a minimal
  /api/health route from a Worker, with a local D1 binding and one trivial query.
  Check the plugin's current documentation for its configuration. Treat anything you
  remember about its API as stale. Do not deploy. Do not create remote resources.

Measure, with each measurement scripted under spike\measure\ and its raw output saved
under docs\spikes\G0-raw\:
1. Gzip size (level 9) of all JavaScript and CSS in the production build; brotli too
   if Node's zlib provides it.
2. Lighthouse, default mobile settings, against the built app: median of five runs;
   record LCP, TBT, CLS and the performance score.
3. axe-core through Playwright on the rendered screen; list every violation with its
   impact.
4. Load and update cost in Chromium through Playwright, CPU throttled 4x via the
   DevTools protocol, a fresh browser for every run, cache off, 11 runs per framework
   in shuffled order. Load: first content rendered, script time and blocking time (work
   beyond 50 ms per stretch), from the browser's own metrics. Update cost: the average
   time per tap over a burst of 50 taps each of day, filter and Join, each followed by a
   forced layout. Do it with 40 activities in the data and again with 280. Report median
   and quartiles. Do not use time-to-next-frame: it is fixed by the frame interval and
   cannot tell the frameworks apart.
5. Developer experience, as facts: how many correction rounds you needed per variant
   before it built, type-checked and passed its unit test; every compiler or linter
   warning produced (run Svelte's compiler for the Svelte variant, and
   eslint-plugin-jsx-a11y or oxlint for the JSX variants, on the same markup); whether
   the unit test passes; lines of code.

Report in docs\spikes\G0-framework-report.md: the commands to reproduce at the top,
one table of numbers, where each raw output is, what each framework did well and
badly, anything unexpected, and which candidates meet the qualification rule in 05
section 2.4. Give your recommendation and the strongest argument against it.

Do NOT record a framework decision in docs\03-DECISIONS.md. I decide, and then D-12
is written. Add "G0 report ready" to docs\02-STATE.md section 4.

Done when: the report exists; every number in it appears in a raw output file; the
spike builds and runs from a clean checkout using only the commands at the top of the
report.

Stop and ask if: Playwright cannot launch Chromium on this machine (report size and
Lighthouse only, and say what is missing); the Cloudflare Vite plugin does not work
with a candidate (record it as a G0 finding; do not swap build tools to get around
it); any step needs a Cloudflare login or a remote resource.

Finish by reporting: what changed, decisions I still owe, what you could not verify,
and which documents are now stale.
```

---

## Phase 1 — Foundation

Claude Code prompt (D-12 exists: Preact 11, gate G0 waived):

```text
Objective: build the multi-tenant foundation of HI CO with no guest features yet: the
project scaffold, database schema, tenant isolation, shell, language and theme
layers, and the preview gate. This is the base of the demo for HI Canada's head office
(D-22). Use the framework recorded as D-12 in docs\03-DECISIONS.md (Preact 11). If there
is no D-12, stop and tell me.

Read first: docs\03-DECISIONS.md (all; D-12, D-14, D-15, D-21 and D-22 shape this phase),
docs\05-ARCHITECTURE.md (all), docs\06-PRIVACY-AND-COMPLIANCE.md sections 2 and 4,
docs\04-PRODUCT-SPEC.md sections 5 to 7, docs\09-CONTENT-AND-ONBOARDING.md section 1,
docs\spikes\G0-framework-report.md (the spike was waived; the report says what was and
was not measured), and docs\external\jericho-2026-10-23\jericho-transcription.md sections
1 and 3 (what the two Vancouver boards share and where they differ).

Before the plan, commit the documentation changes already in the working tree. Run
git status first; if anything other than the files below is modified, or anything is
staged, stop and tell me. Add these files by name (never git add . or -A) and leave
docs\external\ untracked: docs\00-README.md, docs\01-project-instructions.md,
docs\02-STATE.md, docs\03-DECISIONS.md, docs\04-PRODUCT-SPEC.md, docs\05-ARCHITECTURE.md,
docs\09-CONTENT-AND-ONBOARDING.md, docs\10-BUILD-PLAN.md, docs\11-DEPLOY.md,
docs\12-EVIDENCE-REGISTER.md and docs\spikes\G0-framework-report.md. Message: "Record demo
decisions D-12 and D-17 to D-22, waive G0, plan both Vancouver hostels". Show the
git log -1 --stat line.

Then write the plan to docs\plans\<today>-phase-1-foundation.md and stop for my GO.
The plan must answer these two questions, each with a recommendation, what each option
costs and how it will be tested, because I decide them at GO:
- D-15: how the schema carries an activity that one or two properties offer, as one
  record edited once, while keeping every rule in 05 section 4. Say plainly whether D-02
  (each property is a tenant) has to change, and how.
- D-21: how the domain hico.builderworkshop.ca serves two hostels when public content is
  looked up by hostname (05 section 4, rule 1). The options I know of are one host with
  the property in the link (a QR parameter, a path segment or a picker) and a subdomain
  for each hostel.
Then build:

1. Scaffold per 05 sections 2.5 and 16: TypeScript strict, Vite with the Cloudflare
   Vite plugin, a Hono Worker, the framework from D-12, one validation library shared
   by browser and Worker (choose it, and record the choice in 03-DECISIONS.md as
   D-13 with reasons). wrangler.jsonc: the top-level name is hico-preview; an
   explicit "prod" environment sets name hico-prod and its own D1 binding. A test
   fails the build if any resolved Worker name equals hico, mec-trails, lume or
   lume-city. Assets are served with SPA fallback. Local D1 only: do not run
   wrangler d1 create, do not deploy, do not set secrets. Confirm, and report what you
   saw, that Vitest and Playwright with Chromium run on this machine and that the
   Cloudflare Vite plugin runs the Worker, static assets and a local D1 binding with
   Preact.
2. Migration 0001 for: platform_flags, properties, property_hosts, property_features,
   zones, staff_users, staff_memberships, entry_codes (token hash empty until Stage 2),
   activities, activity_exceptions, places, offers, audit_log, event_counts (05 section
   5), shaped by the D-15 answer I approve. Every child table has a composite foreign key
   to (parent id, property_id); every parent has UNIQUE (id, property_id); every text
   column has a length CHECK that equals the limit in the shared schema, with a test
   proving the two agree; enumerations have CHECKs; instants are UTC epoch seconds; ids
   are random 128-bit. Prove with a test that D1 actually enforces the foreign keys and
   CHECKs before relying on them. If it does not, stop and tell me.
3. Tenant middleware and repository layer exactly as 05 section 4: property from the
   session or, for public content reads, from the hostname lookup; never from client
   input. Named public projections for every type with exact field allow-lists.
   Implement the read side for activities, places and offers and the write side for
   audit_log and event_counts only.
4. A lint rule or equivalent static test that fails on env.DB.prepare or any raw
   database access outside worker\repositories, and on SELECT * anywhere.
5. Isolation suite: create two properties; for every repository function and API route,
   act as property A and try to read, list, update and delete property B's rows by id;
   all must find nothing. Include the D-15 case (an activity offered by both properties)
   using the edit rule your plan states. A meta-test fails if any exported repository
   function has no isolation test. Anonymous-surface test: call every route with no
   cookie and compare each response's field names with an allow-list.
6. i18n: English and French catalogs, the lookup rule in 05 section 13 (the guest's
   language if present, else English with a visible marker, never blank or a key), and
   a build test that fails if any key lacks French.
7. Theme: CSS custom properties from the tokens in 02 section 1 with AA-safe pairings
   (dark text on the green and ember buttons; no coral text on dark surfaces; secondary
   text that passes on the ridge surface). Print a table of every text/background pair
   with its computed ratio and fail the build if one is under 4.5:1 (3:1 for large
   text). Self-host DM Sans (check and record its licence); no request to Google.
8. App shell: header showing the property name from tenant config as text (no HI logo
   or other HI mark anywhere, D-21; the plan says what stands in for the brand mark, 02
   row 18), four-tab navigation (What's On, Explore, Common Room, Connect) with routing,
   Common Room and Connect showing "Not turned on for this property" until their switch
   is on. An accessible Dialog/Sheet component (role dialog, labelled, focus moves in
   and returns on close, focus trapped, Escape closes) and a Toast with a live region.
   Unit tests for the dialog behaviour.
9. Seed: demo-whistler built from the prototype's data. Drop ratings, drop invented
   guest names, mark every row is_placeholder, leave verification fields empty, and
   render the "Sample content" band. Spell the Whistler cafe Cheaky's Cafe (D-14); the
   prototype source spells it Cheekye's and is wrong. The seed must refuse to run
   against anything but a local database.
10. Preview gate: copy (do not import across repositories)
    C:\Users\User\dev\Serendipty\packages\gate\index.js into worker\preview-gate\ and
    adapt it as middleware active only when the PREVIEW_GATE variable is "on". Keep its
    behaviour: constant-time comparison, HttpOnly Secure SameSite=Lax cookie holding a
    hash, flat 404 for everything else, fail closed with no key. It must cover the API
    as well as assets. Cookie name hc_preview. Tests: gate on and no key gives 404 on
    every path including /api/* except /robots.txt, which answers Disallow as the
    original gate does; correct key passes; the key never appears in a log, a response
    body or a redirect URL after the first redirect.
11. A global read-only switch: when the platform_flags row "read_only" is "on", every
    state-changing route returns 503 with a plain message in the guest's language and
    reads keep working. Read the flag on each request (a few seconds of caching is
    fine). Test it. docs\11-DEPLOY.md section 9 uses it to stop writes in an incident.
12. npm run validate runs typecheck, lint, all tests (including an axe-core check of the
    rendered shell at 360 px width that fails on any serious or critical violation) and
    the build, and fails on any failure.

Do not: deploy, create any remote resource, set any secret, run any wrangler command
that contacts Cloudflare (its login is unchecked), put the preview key in a file, add
any third-party script, or change framework without asking me.

Done when: npm run validate passes and you have pasted its raw output; the isolation
suite and anonymous-surface test pass; the contrast table is shown; what you found for
the Cloudflare plugin with Preact, Vitest and Playwright on this machine is stated; the
app runs locally with wrangler dev or the Vite dev server and you have shown the shell at
360 px width and navigated it by keyboard only; docs\02-STATE.md describes the real
layout.

Stop and ask if: D1 does not enforce a constraint the design relies on; the Cloudflare
Vite plugin cannot do something 05 assumes; Preact, its build plugin or axe fails in a way
that points at the framework (do not switch framework and do not use React: tell me what
failed and what moving to Svelte 5, the alternative in 05 section 2.3, would cost); any
decision I have not made is needed.

Finish by reporting: what changed, decisions I still owe, what you could not verify,
and which documents are now stale.
```

---

## Phase 1b-1 — Staff-auth spike

Claude Code prompt:

```text
Objective: give me what I need to make decision O-02 (staff authentication) with
evidence. Build nothing permanent.

Read first: docs\05-ARCHITECTURE.md section 11, docs\03-DECISIONS.md O-02,
docs\04-PRODUCT-SPEC.md section 4.8.

Requirements any route must meet: passkey-capable; a staff member can recover access
without asking me; sessions are revocable; every sign-in and invite is written to the
audit log; no shared logins; roles are per property and read from the database on
every request.

Investigate three routes. For each, work from current documentation and working code,
not memory, and say what you ran:
1. Cloudflare Access in front of the staff path, with the Worker validating the Access
   token. Find and report: the current free-plan seat limit, the login methods
   available, how a login is mapped to a property and role, the cost beyond the free
   limit, and what the Worker must verify on each request. This route cannot be run
   locally; say what you could and could not confirm.
2. Better Auth with its passkey plugin. In spike\auth\better-auth\, try to run it on a
   Worker with a local D1 database. Report whether it works, with what adapter, and
   what it needed.
3. A WebAuthn library (the SimpleWebAuthn family or a current equivalent) with D1
   sessions written by us. In spike\auth\own\, implement register and sign-in with a
   passkey and prove it in Playwright using Chromium's virtual authenticator.

Also report how a Worker can send a transactional email today (for invites and
recovery), with current options and their free limits. Do not send any email. Do not
create any account or remote resource.

Write docs\spikes\staff-auth-report.md: a comparison table (works / does not work /
could not test, code you would own, recovery story, cost, risks), your recommendation,
and the strongest argument against it. Do NOT record a decision. I call O-02.

Done when: the report exists and every claim in it is labelled verified (with what you
ran), reported (with the source), or unknown.

Stop and ask if: any route needs a login, a paid plan or a remote resource to test.

Finish by reporting: what changed, decisions I still owe, what you could not verify,
and which documents are now stale.
```

---

## Phase 1b-2 — Staff authentication and console

Claude Code prompt (start only after O-02 is decided in `docs\03-DECISIONS.md`):

```text
Objective: build staff authentication and the staff console for Stage 0, using the
route recorded for O-02 in docs\03-DECISIONS.md. If O-02 has no decision, stop and
tell me.

Read first: docs\04-PRODUCT-SPEC.md sections 2, 4.8 and 5 to 6, docs\05-ARCHITECTURE.md
sections 4, 5 and 11, docs\06-PRIVACY-AND-COMPLIANCE.md sections 2 and 4,
docs\09-CONTENT-AND-ONBOARDING.md sections 1 and 2, docs\spikes\staff-auth-report.md.

First write the plan to docs\plans\<today>-phase-1b-staff.md and stop for my GO.
Then build:

1. Staff authentication per the O-02 decision: sign-in, sign-out, invite, recovery,
   session revocation. The role (editor or admin) is read from staff_memberships on
   every request. A staff member with no membership in a property gets nothing from it.
   Every sign-in, sign-out, invite, role change and revocation writes to audit_log.
2. Staff console (the path and screens in 04 section 4.8, Stage 0 subset): Board
   (create, edit, cancel one date, cancel a series, duplicate, weekly recurrence in the
   property's timezone), Places and Offers (create, edit, re-verify, sort by oldest
   check, hide-if-expired logic), Translations (English and French side by side with
   missing markers), QR codes (view, print with location label, rotate, revoke
   sessions), Feature switches (default off, audit-logged), Audit log (read only),
   Export (the property's content as one file).
3. Verification stamping: saving a place, offer or activity sets verified_on and
   verified_by from the authenticated user; a re-verify action sets them without
   changing text; the client can never supply them.
4. Optimistic concurrency: two editors editing the same record cannot silently overwrite
   each other; the second save is told and shown the difference.
5. Console accessibility to the same standard as the guest app (04 section 6),
   including keyboard-only operation of every form.
6. Operator scripts in scripts\ (PowerShell) for: create-property, add-hostname,
   invite-first-admin, load-zones. Each defaults to the local database. Remote use needs
   an explicit -Remote switch and prints what it is about to do and waits for me to
   type the property slug to confirm. Neither the scripts nor you run anything against
   a remote database in this phase.
7. Tests: role matrix (editor cannot do admin things; admin of A cannot touch B);
   isolation suite extended to every new route; an audit entry exists for every
   state-changing staff action (a meta-test that fails when a mutation route has no
   audit test); XSS payloads in every staff-entered field render as text.

Do not: deploy, create remote resources, send real email (use a local capture), or
store any credential in a tracked file.

Done when: npm run validate passes with raw output pasted; the role matrix and
isolation tests pass; you have walked the console at 360 px and by keyboard only and
described what you saw; docs\02-STATE.md is current.

Stop and ask if: the chosen auth route cannot meet a requirement; a decision I have
not made is needed.

Finish by reporting: what changed, decisions I still owe, what you could not verify,
and which documents are now stale.
```

---

## Phase 2 — Guest app, Stage 0

Claude Code prompt (start after O-13 and O-14 are decided, or after you have accepted
the recommendations in `docs\03-DECISIONS.md`):

```text
Objective: build the Stage 0 guest app: What's On, Explore, Settings and privacy,
labelled QR links, French, offline, and the accessibility and performance work the
prototype lacks. No guest data is stored on the server in this stage. Use the
decisions recorded for O-13 and O-14 in docs\03-DECISIONS.md. If either is missing,
stop and tell me.

Read first: docs\04-PRODUCT-SPEC.md (all), docs\05-ARCHITECTURE.md sections 4, 7, 12,
13 and 14, docs\06-PRIVACY-AND-COMPLIANCE.md sections 1, 2 and 5, docs\09 section 2,
and reference\hi-co-prototype.jsx for the look and the interactions to keep.

First write the plan to docs\plans\<today>-phase-2-guest-stage-0.md and stop for my GO.
Then build:

1. What's On per 04 section 4.1: seven-day strip from today in the property's
   timezone, category filter, activity cards, cancelled and changed states, recurring
   activities across daylight-saving changes, "Last updated" with the staleness
   message, "I'm In" per the O-14 decision.
2. Explore per 04 section 4.2: grouped places, staff pick as a label, staff note,
   verification stamp in words, "Open in Maps" as a plain link that loads nothing until
   tapped, offers with terms and dates, hidden when expired or unchecked past the
   limit, search in the guest's language.
3. QR links per 04 section 3 and 05 section 7 (Stage 0): a labelled link whose
   fragment carries the location label; the page adds one to the aggregate count for
   that label (only labels the property has created count), removes the fragment, sets
   no cookie and stores nothing about the guest. No guest sessions exist in this phase;
   they arrive in Phase 5. Social routes answer "Not turned on for this property".
4. Settings and privacy per 04 section 4.3 and the matrix in 06 section 1: every
   feature listed, every switch off, the property's privacy contact, the consent screen pattern in 06
   section 5 built
   as a reusable component (consent rows are written once sessions exist, in Phase 5),
   "Delete my data" that clears everything this site stored on the device. In Stage 0
   every switch is disabled with "Not available at this property yet".
5. The retention purge job (a scheduled Worker per 06 section 2) with a fake-clock
   test for every row type that exists so far.
6. Aggregate counters per 05 section 10, with a test proving the counter table can hold
   no session id and no user agent.
7. PWA per 05 section 12: manifest, service worker, network-first content with timeout
   then cache, offline state, no caching of any response carrying a session cookie.
8. Complete French for every interface string, drafted by you and flagged "needs
   review" in the catalog. Do not mark any French as reviewed.
9. Accessibility per 04 section 6, including a dialog for every sheet, emoji with text
   alternatives, reduced motion with no decorative particles, 200% text zoom with no
   horizontal scroll, and live regions. axe runs in CI through Playwright at 360 px for
   every screen and state; zero serious or critical violations.
10. Performance budget per 04 section 7 enforced in validate: fail the build if the
    initial JavaScript exceeds the budget; run Lighthouse mobile in the pipeline and
    print LCP, INP proxy (TBT), CLS.
11. Security headers and the content policy in 05 section 14, as middleware, with tests
    on the exact header values; a test that no response contains a third-party host.
12. End-to-end tests at 360 px for: first visit, a labelled QR link (the count is
    recorded and nothing is stored about the guest), language switch, offline reload,
    delete my data.

Do not: deploy, create remote resources, add a third-party script or font request,
invent content (use the demo-whistler placeholders, which carry the Sample band), or
mark French as reviewed.

Done when: npm run validate passes with raw output pasted; axe is clean; Lighthouse
numbers are printed; you have run the app and described each screen at 360 px and with
keyboard only; docs\02-STATE.md is current.

Stop and ask if: a requirement here conflicts with a document; any decision I have not
made is needed.

Finish by reporting: what changed, decisions I still owe, what you could not verify,
and which documents are now stale.
```

---

## Phase 3 — HI Vancouver Downtown and Jericho Beach onboarding and preview launch

Before this phase: put the content for HI Vancouver Downtown in
`C:\Users\User\dev\hico\content\downtown\` and the content for HI Vancouver Jericho Beach in
`C:\Users\User\dev\hico\content\jericho\`, as files, per the inputs list in `09` §3. An
activity both hostels offer is one record with both properties in its "offered at" field
(D-15); the Phase 1 plan says which file holds it. Do not let Claude Code invent any
content. If you do not yet have the file format, run the prompt as it is: with no content
it writes templates and stops, and you fill them in.

Claude Code prompt:

```text
Objective: onboard HI Vancouver Downtown and HI Vancouver Jericho Beach with their own
real content, activities they both offer kept as one shared record (D-15), and take the
Stage 0 app to a gated preview. Decisions D-19, D-20 and D-21 (O-10, O-09 and O-03 for
the demo) must be recorded in docs\03-DECISIONS.md; if any is missing, stop and tell me.

Read first: docs\09-CONTENT-AND-ONBOARDING.md (all), docs\11-DEPLOY.md, docs\04
section 4.8, docs\06 section 7.

Content is in content\downtown\ and content\jericho\. If either folder is missing or
empty, write one clearly marked SAMPLE template file per content type into
docs\content-templates\ (derived from the shared schema, in the format the import will
accept), tell me where they are, and stop. Never write content for a property
yourself. Anything you cannot find in the files, list as missing.

First write the plan to docs\plans\<today>-phase-3-vancouver.md and stop for my GO.
Then build:

1. A bulk import in the staff console for admins: accepts the content files, validates
   every field against the shared schema, shows a dry-run preview of exactly what will
   be created or changed, and applies only after confirmation. Imports set verified-by
   to the importing user and leave verified-on empty until staff re-verify each item.
2. The operator scripts run against the LOCAL database to create the Downtown and
   Jericho Beach properties, each with its timezone, languages, zones and first admin
   invite, served from the demo domain in D-21 (the Phase 1 plan says how a request
   selects a property).
   Show me the exact commands for the remote equivalents, as in 11-DEPLOY.md, but do
   not run any remote command.
3. scripts\launch-check.ps1 implementing the list in 09 section 8. It prints a pass or
   fail line per check with its evidence and exits non-zero on any failure.
4. A property admin view of the aggregate counters (counts per day, per event) with no
   per-person data.
5. A written list of everything in Downtown's content that is missing, stale-looking
   or unverified, for the property to resolve.
6. Prepare, but do not apply, the demo's configuration on hico-preview: the
   custom-domain route or routes for the demo domain in D-21 (attaching one is a DNS
   change and needs its own GO from me; whether builderworkshop.ca is a zone on this Cloudflare account is
   unchecked), and the secrets the app needs by name (not value). Do not prepare
   hico-prod: production is not part of the demo (D-22).
7. scripts\verify-deploy.ps1 as specified in docs\11-DEPLOY.md section 7. Run it against
   the local server on this machine, print the PowerShell version it ran under, and
   show that it fails when it should (for example against a page with an injected
   third-party script).

Do not: invent content, put an HI logo anywhere in the app (D-21), deploy, create
remote resources, run remote commands, or set secrets. Deploying to preview is a
separate step I will authorise using docs\11-DEPLOY.md.

Done when: npm run validate passes with raw output pasted; launch-check.ps1 runs
locally and its output is shown (it is expected to flag whatever is missing); the
import dry-run output for Downtown's real files is shown; docs\02-STATE.md is current.

Stop and ask if: content files conflict with the schema; a fact in them contradicts
another document.

Finish by reporting: what changed, decisions I still owe, what you could not verify,
and which documents are now stale.
```

Then deploy to preview using `11-DEPLOY.md` §5, with your GO.

---

## Phase 3b — Stage 0 to production

Start only when Phase 3 has run, the property has checked the preview, HI Canada has
answered `06` §7 items 1 to 6 in writing (save them as `docs\external\privacy-answers.md`),
O-05, O-07 and O-11 are decided, and you have upgraded the account to Workers Paid.

Claude Code prompt:

```text
Objective: take Stage 0 from the gated preview to production at the custom domain from
O-03, checking every step, and change nothing remote until I say GO for that step.

Read first: docs\11-DEPLOY.md (all), docs\09-CONTENT-AND-ONBOARDING.md section 8,
docs\06-PRIVACY-AND-COMPLIANCE.md sections 2 and 7, docs\03-DECISIONS.md (O-03, O-05,
O-07, O-11).

Do:
1. Confirm from docs\03-DECISIONS.md that O-03, O-05, O-07 and O-11 are recorded, and from
   docs\external\privacy-answers.md that items 1 to 6 of 06 section 7 are answered. If
   either is missing, stop and list exactly what is missing.
2. Write docs\plans\<today>-phase-3b-production.md: the exact commands in order
   (database creation with the location hint, secrets, migrations with a backup first,
   creating the Downtown property and its first admin invite, deploy dry run, deploy,
   route, content import, post-deploy check), what each one changes, and how to undo
   it. Stop for my GO.
3. After my GO, run them one at a time. Announce each remote step before running it
   and show the raw output. A GO covers only the step it was given for, in this
   session. Stop at the first surprise.
4. After the content import (dry run first, then apply), stop and tell me. Downtown's
   staff must re-verify each item in the console, and launch-check fails until they
   have. Continue only when I say they have.
5. Run scripts\launch-check.ps1 and scripts\verify-deploy.ps1 against production and
   show their output.
6. Update docs\02-STATE.md with what is live, at what address, which version, and what
   is not yet verified.

Do not: create the production database, set secrets, run a remote migration, deploy or
change a route or DNS without my GO for that specific step; reuse a GO from an earlier
session; load any content marked placeholder.

Done when: launch-check and verify-deploy pass against production and their output is
shown; the production page contains no third-party host and no analytics beacon (show
the check); docs\02-STATE.md is current.

Stop and ask if: any check fails; the zone's Web Analytics automatic injection is on;
the domain is not a zone on this Cloudflare account; any output differs from what the
plan predicted.

Finish by reporting: what changed, decisions I still owe, what you could not verify,
and which documents are now stale.
```

---

## Phase 4 — Stage 1: Unlock your savings

Start only when Stage 0 is in production (Phase 3b) and has met the gate you agreed
with HI Canada, and HI Canada has given you the exact terms of the membership offer.

Claude Code prompt:

```text
Objective: build Stage 1 per docs\04-PRODUCT-SPEC.md section 4.4: "Unlock your
savings", with membership as a guest's own statement. The app must never claim it has
verified a membership.

Read first: docs\04 section 4.4, docs\08-ADOPTION-STRATEGY.md sections 3 and 5,
docs\07-LOCATION-AND-WALLET.md section 6, docs\06 section 1.

The offer's exact terms must be in docs\external\membership-terms.md (written by me,
copied from HI Canada). If it does not exist, stop. Do not state any membership offer
on a screen from memory.

First write the plan to docs\plans\<today>-phase-4-stage-1.md and stop for my GO.
Then build:

1. The "Unlock your savings" screen: what the membership is, in the exact words and
   terms from membership-terms.md, and the offers that need it. English and French.
2. A "I have a membership" statement stored only on the device. Nothing about it is
   sent to the server.
3. A full-screen offer view for each member offer: partner, offer, terms, validity,
   the verification stamp, and the property's name. Large text, high contrast.
4. An optional "I used this" tap that adds 1 to an anonymous per-property, per-day,
   per-offer count. No session id is stored with it.
5. A MembershipVerifier interface with one implementation, DeclaredMembership, that
   makes no network call. Phase 4b adds another implementation behind the same
   interface.
6. Tests: nothing about membership appears in any request; the offer view passes axe at
   360 px and with the keyboard; hidden-if-expired logic applies to member offers; an
   offer with no verification stamp does not appear to guests.

Do not: deploy, state any claim about HI Canada's systems, or call any external
service.

Done when: npm run validate passes with raw output pasted; a network test proves no
request carries membership data; docs\02-STATE.md is current.

Stop and ask if: the terms file is missing or ambiguous.

Finish by reporting: what changed, decisions I still owe, what you could not verify,
and which documents are now stale.
```

---

## Phase 4b — Membership verification

Start only when HI Canada has sent answers to the four questions in `07` §6.

Claude Code prompt:

```text
Objective: add real membership verification behind the MembershipVerifier interface,
exactly as far as the answers from HI Canada's platform provider allow.

Read first: docs\07-LOCATION-AND-WALLET.md section 6 and docs\external\cobber-answers.md
(the answers, which I put there). If that file is missing or leaves a question
unanswered, implement only what the answers cover and list the rest as blocked. If it
is missing entirely, stop.

First write the plan to docs\plans\<today>-phase-4b-verification.md and stop for my
GO. The plan must state: what data is sent to the provider, what comes back, where
each credential lives, what happens when the provider is down or slow, and the
data-residency terms from the answers.

Then build: a second MembershipVerifier implementation; credentials only as Worker
secrets, never in a file; a hard timeout; fallback to the declared statement with a
plain message when the provider fails; no membership number stored by HI CO; no
membership data in logs; tests with a mocked provider including timeouts, malformed
replies and a hostile reply; a privacy review of the flow against docs\06.

Do not: call the real provider from tests, deploy, or store a credential in a tracked
file.

Done when: npm run validate passes with raw output pasted; docs\06 and docs\02-STATE.md
are updated to match what was built.

Stop and ask if: the answers contradict docs\06 or would require sending more data than
the plan lists.

Finish by reporting: what changed, decisions I still owe, what you could not verify,
and which documents are now stale.
```

---

## Phase 5 — Stage 2: shared counts and Common Room

Start only when the Stage 1 gate is met, HI Canada's privacy officer has answered
`06` §7 items 7 to 9, and O-01 and O-06 are decided.

Claude Code prompt:

```text
Objective: build Stage 2 per docs\04-PRODUCT-SPEC.md sections 3, 4.5 and 4.8 (reports):
guest sessions, shared RSVP counts, Common Room, the 18+ attestation, reports and the
staff queue. Use the decisions recorded for O-01 and O-06 in docs\03-DECISIONS.md; if
either is missing, stop.

Read first: docs\04 sections 4.5 and 4.8, docs\06 (all), docs\05 sections 4 and 5.

First write the plan to docs\plans\<today>-phase-5-stage-2.md and stop for my GO.
Then build:

1. Migration for guest_sessions, consents, rate_limits, rsvps, gatherings,
   gathering_interest and reports with composite foreign keys, length CHECKs and the
   status enumerations in 05 section 5. Then guest sessions per 05 section 7 and the
   O-01 decision: the entry token travels in the URL fragment, is posted once and is
   removed from the address bar; only hashes are stored (keyed with SESSION_PEPPER);
   the cookie is HttpOnly Secure SameSite=Lax; expiry per 04 section 3; revocation by
   code; rate-limit keys use the daily key derived from RATE_LIMIT_SECRET; the Stage 0
   labelled links gain the entry token. Social routes without a session answer "scan
   the code in the hostel" with no data.
2. RSVP: counts only; capacity enforced on the server; "spots left" shown only on
   activities where staff have capacity set; the guest's own state stored on the
   server only if they turned the feature on.
3. The 18+ attestation and the Common Room switch as consent flows (06 section 5
   pattern). Without both, no write route works and no read route returns data.
4. Common Room: post, list, interest counts, author ends their own post, expiry per
   04 section 4.5. Free text is refused when it contains a link, an email address or a
   phone number, with a plain explanation. Display names per 06 section 6.
5. Limits per 04 section 4.5 enforced by session and by keyed hash of network address
   (06 section 2), returning a clear message, not a silent failure.
6. Report: hides the post from everyone but its author immediately and shows the author
   "under review"; per-session report limit; staff queue with restore and remove;
   report counts per session visible to staff; audit entries for every staff action.
7. Property switch: an admin can turn Common Room off at once, and posts vanish from
   guest views.
8. Purge job extended with fake-clock tests for gatherings, interest, RSVPs, reports.
9. Abuse test suite: script and HTML payloads in every field, link and phone patterns
   including common evasions (spaces, words for digits, look-alike characters), flood,
   repeat reports, cross-property access by id, enumeration, expired and removed posts
   still reachable by id, a guest reading the author's session id from any response.
10. Isolation and anonymous-surface suites extended to every new route and projection.
11. "Download my data" in Settings: a JSON file of every row tied to the guest's
    session (session, consents, RSVPs, their posts, interest and reports), with a test
    that it contains nothing tied to any other session.

Do not: deploy, store the author's session id in any public projection, add image
upload, or add any link rendering in guest content.

Done when: npm run validate passes with raw output pasted; the abuse suite passes and
its list of cases is shown; accessibility checks pass at 360 px and by keyboard;
docs\02-STATE.md and docs\06 are current.

Stop and ask if: a requirement here conflicts with 06; any decision I have not made is
needed.

Finish by reporting: what changed, decisions I still owe, what you could not verify,
and which documents are now stale.
```

---

## Phase 6 — Stage 3: Connect and the Nearby view (Tier 1)

Start only when the Stage 2 gate is met, `06` §7 item 10 is answered, and you
have confirmed O-04 (Tier 1).

Claude Code prompt:

```text
Objective: build Stage 3 per docs\04-PRODUCT-SPEC.md sections 4.6 and 4.7: signals,
replies, the Nearby view as a Tier 1 radar, the property room object, and the
on-device "Check I'm here". Tier 1 only: no person-to-person distance of any kind.

Read first: docs\04 sections 4.6 and 4.7, docs\05 section 9, docs\06 (all),
docs\07-LOCATION-AND-WALLET.md section 4, and the RadarView and ConnectView components
in reference\hi-co-prototype.jsx so you know exactly what not to carry over (random
positions, the one-second timer that redraws them, dorm names, the client-side
countdown, and the promise that someone "will know you're coming").

First write the plan to docs\plans\<today>-phase-6-stage-3.md and stop for my GO.
Then build:

1. Migration for signals and signal_responses with composite foreign keys, length
   CHECKs and server-set expires_at.
2. Sending and seeing signals as two separate consents (06 section 1), each needing the
   18+ attestation. One live signal per session; the guest can end it early. A place
   from the property's zones only. No dorm, room or bed data exists anywhere.
3. Replies: the sender sees a responder's display name only if the responder chose to
   share it on that reply; otherwise "someone is interested" and a count. No text on
   any screen promises a notification that is not sent.
4. PropertyRoom Durable Object, one per property, with WebSocket hibernation and an
   alarm for expiry (05 section 9). D1 is authoritative and every read filters by
   expires_at. If the socket cannot connect the client polls. The room holds nothing
   that cannot be rebuilt from D1. Check the current Cloudflare documentation for the
   Durable Object and hibernation APIs; treat remembered shapes as stale.
5. The Nearby view as a Tier 1 radar: rings mean "In the hostel", "A short walk away",
   "Further out", decided by the ring assigned to the zone the sender chose (zones.ring in
   05 section 5). Dot placement around a ring
   carries no meaning, is deterministic per signal and stable between refreshes, and
   the screen says in one line that rings show what people said, not measured
   positions. The same signals appear as an ordered list and the list is what screen
   readers get. No decorative motion under prefers-reduced-motion.
6. "Check I'm here" exactly as docs\07 section 4: one request on tap, accuracy rule,
   compare on the device, discard, announce the result to screen readers, gate nothing.
7. Tests: a network test that no request body or URL anywhere in the app contains
   latitude or longitude; unit tests for the distance function; expiry tests including
   a late alarm; the abuse suite from Phase 5 extended to signals; room isolation
   (a client of property A cannot subscribe to B's room); reconnect and polling
   fallback; reports hide a signal at once.
8. A script that opens 200 simulated clients on one room locally and prints message
   counts and any dropped updates, so cost and behaviour at the largest property's
   scale can be estimated from data.

Do not: deploy, send or store any coordinates, add any distance between two guests,
add push notifications, or add any gamification.

Done when: npm run validate passes with raw output pasted; the no-coordinates network
test and the abuse suite pass; the load-script output is shown; accessibility checks
pass; docs\02-STATE.md and docs\06 are current.

Stop and ask if: anything here would require sending a position to the server or
computing a distance between guests.

Finish by reporting: what changed, decisions I still owe, what you could not verify,
and which documents are now stale.
```

---

## Phase 7 — Wallet pass

Two prompts. Run the spike first. Start only when O-15 is decided and the issuing
account exists. Creating the Apple Pass Type ID, its certificate, and the Google issuer
account needs a person signed in to those accounts; Claude Code cannot do it for you.

### Phase 7a — Spikes

Claude Code prompt:

```text
Objective: find out, by running code, what can and cannot be done from Cloudflare
Workers for a Wallet pass. Build nothing permanent.

Read first: docs\07-LOCATION-AND-WALLET.md section 5 and docs\03-DECISIONS.md O-15.

Test, each in its own folder under spike\wallet\, recording exactly what you ran:
S-W1: generate and sign an Apple .pkpass file (manifest, signature) inside a Worker or
      a Worker-compatible build, using a test certificate you generate yourself.
      Check the current Apple pass format documentation first.
S-W2: send an empty push to the Apple Push Notification service from a Worker using a
      client certificate (Workers mTLS binding). Find out from the current Cloudflare
      and Apple documentation, then by test, whether it works and on which port and
      host. If I have put a real certificate at the path in docs\external\wallet-cert.md
      you may use Apple's sandbox; otherwise test only what a test certificate allows
      and say where it stops.
S-W3: create a Google Wallet class and object using a service account from a Worker.
S-W4: if S-W2 fails, the smallest relay that could send the push (what it is, where it
      runs, what it holds, what it costs to run), described and sketched but not
      deployed.

Report in docs\spikes\wallet-report.md: for each test, works / does not work / could
not test and why, what the numbers and ports were, the cost and operational weight of
each viable route, and your recommendation with its strongest counter-argument. Do not
record a decision.

Do not: deploy, create remote resources, or store any certificate or key in a tracked
file.

Done when: docs\spikes\wallet-report.md exists, every test says works, does not work or
could not test (with the reason), and the raw outputs are saved.

Stop and ask if: a step needs a real certificate, an account or a remote resource that
I have not provided.

Finish by reporting: what changed, decisions I still owe, what you could not verify,
and which documents are now stale.
```

### Phase 7b — Build

Claude Code prompt (after you have chosen a route from the report):

```text
Objective: build the Wallet pass feature per docs\07-LOCATION-AND-WALLET.md section 5
using the route I recorded in docs\03-DECISIONS.md after reading
docs\spikes\wallet-report.md. If no decision is recorded, stop.

Read first: docs\07 section 5, docs\06 section 1 (Wallet row), docs\spikes\wallet-report.md.

First write the plan to docs\plans\<today>-phase-7-wallet.md and stop for my GO. The
plan must state where each certificate and key lives (Worker secrets only), what the
pass contains, and what registering a pass tells Apple or Google.

Then build: an opt-in sheet in the 06 section 5 pattern that says plainly the phone
registers with Apple or Google for pass updates; a pass containing the property's name,
a link to today's board, and up to nine partner-venue locations with offer text, and
no personal or membership data; a random serial unrelated to any session; the
registration, fetch and update endpoints with the ApplePass authentication header and a
change tag that only moves forward; the Google equivalent; tests with mocked platforms;
wording on every screen that says "may", never "will", about nearby alerts.

Do not: deploy, store any key in a tracked file, link a pass to a guest session, or
describe the pass as a reliable alert.

Done when: npm run validate passes with raw output pasted; docs\06, docs\07 and
docs\02-STATE.md match what was built.

Stop and ask if: the chosen route fails in testing, or needs a key stored anywhere
except Worker secrets.

Finish by reporting: what changed, decisions I still owe, what you could not verify,
and which documents are now stale.
```

---

## Phase 8 — Second tenant and hardening

Start when any stage is live and O-07 (ownership, licence, hosting) is decided.

Claude Code prompt:

```text
Objective: prove that HI CO is multi-tenant in practice by onboarding a second
property with its own real content, and complete the hardening that should precede
wider use.

Read first: docs\09 (all), docs\05 sections 4, 8 and 15, docs\06 (all), docs\11-DEPLOY.md.

Whistler's content is in content\whistler\ if it exists. Never use the demo-whistler
seed as real content, and never write content yourself. If the folder is missing,
do the hardening items and list the onboarding as blocked.

First write the plan to docs\plans\<today>-phase-8-hardening.md and stop for my GO.
Then:

1. Onboard the second property through the same import and scripts as Downtown, with
   no code changes except genuine defects, which you list. Show the isolation suite and
   anonymous-surface test passing with both real tenants' data in a local database.
2. Load test: a script that simulates a busy evening at the largest property (232
   guests, mixed reads, a handful of posts and signals) against local wrangler dev, and
   prints request counts, rows read and written, latency percentiles and any errors.
   Use the output to restate 05 section 8's volume paragraph with measured numbers.
3. Restore drill, written as a PowerShell procedure in docs\11 and run against a
   throwaway local database first. Running it against a remote database needs my GO.
4. Secret rotation drill: rotate the session pepper and the preview key in a way that
   keeps staff signed in or tells them clearly; written down and run locally.
5. Dependency review: npm audit output, a list of every runtime dependency with its
   licence and why it exists, and anything to remove.
6. Security self-review as an attacker: attempt cross-tenant reads and writes, ID
   enumeration, session fixation, cookie flag checks, header checks, cache poisoning of
   the service worker, XSS in every field, and rate-limit evasion. Report each attempt
   and its result in docs\spikes\security-self-review.md.
7. Prepare, for people to do: the script for the human screen-reader accessibility
   audit (pages, tasks, devices), the list of French strings still flagged "needs
   review", and the questions for counsel and the privacy officer from 06 section 7.
   These are my gates; you cannot close them.
8. Refresh every document to match the code. List any claim you changed and why.

Do not: deploy, run any remote command, or mark French as reviewed.

Done when: npm run validate passes with raw output pasted; each item above has its
output shown; docs are current.

Stop and ask if: the second property's content conflicts with the schema, or any
isolation test fails.

Finish by reporting: what changed, decisions I still owe, what you could not verify,
and which documents are now stale.
```

---

## Review prompt — run after any phase, in a new session

Claude Code prompt:

```text
You did not build this. Review the work of the most recent phase as an independent
reader who wants to find what is wrong.

Read docs\02-STATE.md and docs\03-DECISIONS.md, then the plan in docs\plans\ for the
latest phase, then the code and tests it touched. Then, without taking the report's
word for anything:

1. Run npm run validate and paste the raw output.
2. Pick five claims from docs\02-STATE.md about the latest phase and check each
   against the code or by running something. Show the evidence.
3. Try to break tenant isolation: write and run three new cross-tenant tests the
   existing suite does not already contain, in new files under tests\review\.
4. Look for any place where something privacy-sensitive is on by default, any
   third-party request, any place a client can supply a property, a verification stamp
   or an author id, and any string shown to a guest that has no French.
5. Check the interface at 360 px and with the keyboard alone and describe what you see.
6. List anything in the docs that no longer matches the code.

Do not change application code, existing tests or documents; the only files you may
add are those in tests\review\. Report findings ranked by severity, each with the
file, what you ran and what happened, and say what you could not check. If you find
nothing in a category, say what you tried.

Done when: validate output is pasted, five claims are checked with evidence, three new
tests have been run, and every category above has a finding or a statement of what you
tried.

Stop and ask if: npm run validate cannot run.
```
