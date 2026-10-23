# CLAUDE.md — HI CO

Rules for Claude Code in this repository. The product rules live in
`docs\01-project-instructions.md`; read it first. This file covers how to work here.

## Read before any task

1. `docs\02-STATE.md` (what exists now) and `docs\03-DECISIONS.md` (what is settled
   and what is open).
2. The document that owns the area you are touching (see `docs\00-README.md`).
3. If a document is stale relative to the code, say so and stop short of guessing.

## Working method

Research, Plan, Implement. For anything larger than a one-file fix, write the plan
to `docs\plans\<date>-<slug>.md` and wait for my GO before implementing. Announce
any destructive or irreversible action in advance and wait for approval: deploys,
schema changes on a live database, secret rotation, deleting files.

When I call a decision, including "accept O-01 as recommended", append a row to the
Decided table in docs\03-DECISIONS.md with the next D number and the date, and mark
the open item "Resolved by D-nn". A decision that is not in that file has not been
made, and you do not build on it.

## Shell

Windows, PowerShell only. No bash, no `&&` chaining, no heredocs, no forward-slash
paths, no `~/`. Use `$HOME\dev\hico` style paths. Node, wrangler and Claude Code are
installed and authenticated; never write install or login steps.

## Files

- Copy, never move. Never edit `reference\hi-co-prototype.jsx`.
- The original prototype and the shared gate live in `C:\Users\User\dev\Serendipty`.
  Read them if needed. Do not modify that repository.
- Git is local. No remote and no push unless I say so.
- Secrets never go in tracked files. `.dev.vars` is gitignored.

## Deploying

HI CO deploys as `hico-preview` and `hico-prod`. Never deploy, upload versions,
bind secrets or change routes under `hico`, `mec-trails`, `lume` or `lume-city`:
those are live apps. Never run `wrangler d1 create`, `wrangler secret put`,
`wrangler deploy`, a remote migration, a restore or a DNS change without my GO in
the current session, announced in advance. Procedures are in `docs\11-DEPLOY.md`.

## Code rules

- TypeScript, strict. No `any` without a comment saying why.
- Every SQL statement touching tenant data includes `property_id`. A guest session
  belongs to one property. A staff member may hold roles in several, so each staff
  request names the property in its path and the server checks that staff member's
  role in that property on every request; naming a property gives no access by
  itself. Public content reads, before any session exists, take the property from the
  server-side hostname lookup, which is safe because that content is public. The
  property never comes from the request body, the query string, a client-set header
  or any other client-supplied id. Data access goes through the repository layer
  only; raw `env.DB.prepare` outside it fails the lint rule and the review.
- Secrets are read with whitespace trimmed. A secret piped in from PowerShell can
  carry a trailing newline.
- Every response that returns another person's data goes through a named public
  projection function that lists the allowed fields. No `SELECT *` to a client.
- Every user-supplied string has a length limit in the shared schema and a matching
  `CHECK` in the migration.
- No `localStorage` for anything that must persist reliably; it is allowed for
  per-device conveniences only, wrapped in try/catch.
- No third-party scripts, analytics beacons or trackers. Fonts are self-hosted.
- All user-facing strings go through the i18n layer with English and French present.
- Accessibility: semantic elements first; `role`/`aria-*` only where semantics are
  not enough; every interactive element reachable and operable by keyboard; dialogs
  trap and restore focus and close on Escape; text contrast at least 4.5:1 (3:1 for
  large text); touch targets at least 44 CSS px.
- Dates and times are stored in UTC and displayed in the **property's** timezone,
  never the device's.

## Definition of done for any change

`npm run validate` passes (typecheck, lint, tests, build) and prints raw output in
your report. New behaviour has a test. Tenant-scoped behaviour has a cross-tenant
test. UI changes were checked at 360 px width and with keyboard only.

## Ending a session

Final step, always: update `docs\02-STATE.md` and append to `docs\03-DECISIONS.md`
(decisions made, decisions owed to me). Then report: what changed, decisions I still
owe, what you could not verify, which documents are now stale.

Commit when `npm run validate` passes, with a plain message naming the phase, so the
next review can compare against it. Never commit a failing tree. If git has no user
name or email set, stop and ask.
