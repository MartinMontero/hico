# Plan — Phase 1b-2: staff authentication and console (Stage 0)

Date: 2026-10-24. Status: **written, waiting for Martin's GO. Nothing in this plan has been built.**
Labels as in `00-README.md`: `[V]` verified, `[I]` inferred, `[A]` assumption, `[U]` unknown.

Decisions this plan builds on: D-26 (our own WebAuthn, SimpleWebAuthn 14, passkey-first), D-27 (person-level
audit events written once per property the person holds a role in), D-28 (invite and recovery links handed
over by an admin, no email), D-23 (shared activities), D-24 (`/p/<slug>`), D-22 (staff sign-in is in the demo).
Brief: `10-BUILD-PLAN.md` Phase 1b-2. Evidence: `docs\spikes\staff-auth-report.md`.

## 0. What I need from you at GO

| # | Question | My recommendation |
| --- | --- | --- |
| 1 | What guests see of "who checked it" | Guests see only "Checked by staff on 12 October". The staff member's name is kept for staff and the audit log and is **removed from the public projections**. Today the guest app prints it in brackets; that stops |
| 2 | Who an owner-admin may add to a shared activity's offered-at list (D-23) | Only a property in which that admin **also holds a role**. Otherwise the console would have to list other tenants' names, which is the leak `05` §4 exists to prevent. Anything else goes through the operator script |
| 3 | QR codes in Stage 0 | The console creates, lists, retires and prints **labelled links** (`#l=desk`). "Rotate" and "revoke sessions" appear as "from Stage 2" and do nothing yet, because no entry tokens or sessions exist before Phase 5 |
| 4 | Audit log visibility | Admins only (editors cannot read it) |
| 5 | Session length | 12 hours from sign-in, no sliding window `[A]` |
| 6 | Hashing of staff tokens | Plain SHA-256 of a random 256-bit token, not a keyed hash, so the operator scripts can issue an invite without the Worker's secret. Guest session tokens (Phase 5) keep the keyed hash in `05` §7 |
| 7 | Rate limiting | Build a small D1 limiter now for the sign-in, invite and recovery endpoints (the Phase 5 `rate_limits` table, in a first form) |
| 8 | Downloads | One npm package for QR drawing, chosen in the build from small, dependency-free, permissively licensed candidates and recorded like D-13. Nothing else is installed |
| 9 | API paths | Console pages at `/staff/p/<slug>/...`, API at `/api/staff/p/<slug>/...` (the stub `GET /staff/p/:slug/me` moves). `05` §4 rule 1 and §16 are updated |
| 10 | Build in four slices, each committed only when `npm run validate` passes (§6) | Yes |

If you accept all ten as written, say "GO, accept the recommendations". Say which one to change otherwise.

## 1. Scope

In: staff authentication promoted from the spike (invite, passkey registration, sign-in, sign-out, sign-out
everywhere, sessions, extra passkeys, recovery by admin-issued link); the console screens in `04` §4.8 that
belong to Stage 0 (Board, Places, Offers, Zones, Translations, QR codes, Feature switches, People, Audit log,
Export); server-side verification stamping; optimistic concurrency; console accessibility; operator scripts;
tests.

Out (stated so nobody assumes otherwise): guest sessions and entry tokens (Phase 5), the Reports queue (Stage 2),
shared counts and capacity shown to guests (D-18), email of any kind (D-28), images, a second tenant's real content
(Phase 3), deployment, any remote resource, any secret in Cloudflare, `wrangler login`.

## 2. How staff authentication is promoted from the spike

The spike (`spike\auth\own\`) stays as a reference and is not imported. The real code is written in `worker\`
with the project's rules: SQL only in `worker\repositories`, named projections, length limits in
`shared\limits.ts`, strings through i18n.

- **Migration `0002_staff_auth.sql`:** `staff_credentials`, `staff_sessions`, `staff_tokens` (purpose `invite` or
  `recovery`), `webauthn_challenges`, `rate_limits`; a `version` integer on `activities`, `places`, `offers`
  and `zones` for optimistic concurrency; composite keys and length CHECKs as before; D1 enforcement proven by a
  test, as in Phase 1.
- **Configuration:** `RP_ID` and `ALLOWED_ORIGINS` are Worker variables (local defaults for `vite dev`,
  `vite preview` and tests; the real values are set at deploy time with Martin's GO). Never taken from the
  request. **Fact to plan around:** a passkey is bound to its relying-party id, so staff who register on
  `localhost`, on `workers.dev` and on `hico.builderworkshop.ca` hold three unrelated sets of passkeys. If the
  production hostname changes (O-03), staff register again. I will say so in the console's help text.
- **Sessions:** random token in an `HttpOnly; Secure; SameSite=Lax` cookie; the database holds only a hash of it;
  12 hours; a revoked or expired session, or a disabled person, is refused on the next request.
- **Roles:** read from `staff_memberships` on every request (the Phase 1 `roleAtSlug`). Naming a property gives
  nothing.
- **Invites and recovery (D-28):** an admin creates a link for a person and a role; it is shown once, with a copy
  button and a QR code, and only a hash is stored (30 minutes, single use, kept in the URL fragment and removed
  from the address bar). A recovery link is the same, issued by another admin, and replaces access: old sessions
  and old passkeys stop working at once. There is **no public "recover by email" endpoint**, so there is nothing to
  enumerate. The sign-in screen says "Lost your device? Ask another admin of your hostel for a link."
- **Guards, in code:** a person cannot remove their own last passkey; an admin cannot remove or demote the last
  admin of a property; an editor cannot issue links or change roles; an admin cannot touch another property.
- **Passkey nudge:** after the first sign-in the console asks the person to add a second passkey, and the People
  screen marks anyone who has only one.
- **Audit (D-27):** every sign-in, sign-out, sign-out everywhere, session revoked, passkey added or revoked, invite
  created or accepted, role changed, person removed, recovery issued or completed writes one `audit_log` row per
  property the person holds a role in. Failed sign-ins are rate limited, not logged per person (no person is
  known).
- **Rate limiting:** a keyed hash of the network address and the endpoint, in a fixed window, rows removed on write
  after 24 hours; applies to sign-in options and verify, invite acceptance and recovery acceptance. It needs
  `RATE_LIMIT_SECRET`, a local value for now; the Cloudflare secret is part of a later deploy GO.

## 3. Roles and what each can do

| Action | Editor | Admin | Another property's staff |
| --- | --- | --- | --- |
| Read the board, places, offers, zones for the property | yes | yes | no |
| Create and edit activities, places, offers (content), cancel a date or a series, duplicate | yes | yes | no |
| Re-verify a place, offer or activity | yes | yes | no |
| Delete a record | no | yes | no |
| Change a shared activity's offered-at list or delete it (D-23) | no | owner's admin only, and only to properties where they hold a role | no |
| Edit a shared activity's content | yes, at any property that offers it | yes | not in the list: no |
| Create, rename, retire QR labels | no | yes | no |
| Change feature switches | no | yes | no |
| Invite people, change roles, remove people, issue recovery links, revoke a person's sessions | no | yes | no |
| Read the audit log | no | yes | no |
| Export the property's content | no | yes | no |
| Manage their own passkeys and sessions | yes | yes | n/a |

The guard functions already exist (`canEditActivity`, `canChangeOfferedAt`); the write functions must call them and
a meta-test fails if one does not.

## 4. The console

One Preact application. The staff screens are **lazy-loaded** so a guest never downloads them and the guest's
initial JavaScript stays under 60 KB gzip (`04` §7); the staff chunk gets its own budget of 90 KB gzip `[A]` and
`scripts\bundle-size.ts` reports both. Strings go through the i18n layer with English and French (French first
drafts, D-19).

| Screen | What it does | Notes |
| --- | --- | --- |
| Sign in | Passkey button, no username; "Lost your device?" help text | Accept-invite and accept-recovery pages read the link from the fragment |
| Board | List by weekday; create, edit, duplicate, cancel one date (exception), cancel a series; weekly recurrence in the property's time zone; one-off date and time; zone; host label; category; shown with its stamp. A shared activity shows its offered-at list | Time inputs are converted in the property's zone, never the device's. O-19 (BC clocks) affects only the display of one-offs |
| Places | Create, edit, staff pick, note, walk time, hours, phone; list sorted by oldest check; "re-verify" | The 90-day rule: past it, the guest app shows "Check at the desk" and the console lists it as overdue |
| Offers | Create, edit, validity dates, requires-membership flag, how-we-know note; "re-verify" | Guest app already hides expired or unchecked offers (Phase 1) |
| Zones | Name in English and French, ring | Used by the board |
| Translations | Every text field in English and French side by side, with a marker where French is missing, editable in place | A view over the same records, using the same forms and the same stamping |
| QR codes | List, create, retire and print labelled links (`#l=<label>`) as a QR code with the label as text | Per decision 3. The guest side that counts a scan is Phase 2 |
| Feature switches | Common Room and Connect, default off, audit-logged | Admin only |
| People | Invite, change role, remove, issue a recovery link, see passkey count and last sign-in | Admin only; last-admin guard |
| My account | Sessions (revoke one, sign out everywhere), passkeys (add, rename, revoke) | Everyone |
| Audit log | Read-only, newest first, filter by action, paged | Admin only; no free text, no personal data beyond the actor's name |
| Export | The property's content as one JSON file: property, zones, activities (owned and offered), places, offers, switches, QR labels. No staff list, no emails | Admin only; the download itself is audited |

**Verification stamping (server-side only).** Saving a place, offer or activity sets `verified_on` to now and
`verified_by` to the signed-in person's display name; a re-verify sets them without touching the text. The request
schemas have no such fields: a test sends `verified_on` and `verified_by` in every create and update body and
checks they are ignored. The guest projections lose `verifiedBy` (decision 1); the guest still sees the date.

**Optimistic concurrency.** Each record has a `version`. An update sends the version it was based on; if it no longer
matches, the server answers 409 with the current record, and the console shows both versions side by side and lets the
editor choose to keep theirs (a new save against the new version) or take the current one. Nothing is overwritten
silently. Deleting also needs the version.

**Accessibility (`04` §6) and responsiveness.** Semantic form controls with visible labels, errors tied to fields
with `aria-describedby` and an error summary that takes focus, every action reachable and operable by keyboard,
dialogs from the Phase 1 component (focus in, trapped, restored, Escape), 44 px targets, 4.5:1 contrast with the
existing token pairs (any new pairing goes through the contrast gate), 360 px width without sideways scroll, 200%
text. Tables become stacked lists at 360 px.

## 5. Operator scripts (`scripts\*.ps1`, PowerShell only)

`create-property`, `add-hostname`, `invite-first-admin`, `load-zones`, and one more the plan adds because D-28
makes it necessary: `issue-recovery-link` (for a property whose only admin lost their only device). Each is a thin
wrapper around one Node command (`scripts\operator.ts`) that uses the same shared schemas, limits and id rules as the
app, so a script cannot write what the app would refuse.

- **Local by default**, against the local D1 state, with no Cloudflare contact.
- **`-Remote`** is an explicit switch; it prints exactly what it is about to do (database, statements, property),
  and waits for you to type the property slug. **Neither the scripts nor I run anything against a remote database in
  this phase.** A test proves `-Remote` refuses without the typed slug and refuses when run non-interactively.
- Invite and recovery links print once to the terminal, are never written to a file, and carry only a hash into
  the database.
- Tests run the scripts against a throwaway local database and check the result and the audit rows.

## 6. Build order (four slices; each ends with `npm run validate` green and a commit)

1. **Auth and schema.** Migration 0002 and its D1-enforcement tests; the staff repositories and routes; invite,
   register, sign-in, sign-out, sessions, passkeys, recovery link, guards, audit fan-out, rate limiting; the
   Playwright virtual-authenticator suite promoted from the spike; static and meta tests extended.
2. **Content write API.** Write-side repositories for activities (with exceptions and the offered-at list), places,
   offers, zones, QR labels, switches, people; the guard calls; stamping; versions and 409s; audit for every
   mutation; export; the role matrix and the isolation suite extended; XSS payload tests; the anonymous surface and
   staff surface allow-lists.
3. **Console UI.** The lazy staff chunk, forms, the screens in §4, concurrency diff, i18n (English and French),
   a11y tests (axe at 360 px on every screen, keyboard-only walk of every form), bundle budgets.
4. **Operator scripts and finish.** The five scripts and their tests; the console walkthrough at 360 px and by keyboard
   only (described, with screenshots); `02-STATE.md`, `05` (§4 rule 1 path, §11 final design, §16), `06` §2 and
   `09` §1 updated; final `npm run validate` output pasted.

## 7. Tests (what "done" means)

- **Role matrix:** every route, every role (editor, admin, other-property admin, signed-out, disabled): the table in §3 as
  code, one assertion per cell.
- **Isolation suite extended** to every new repository function and route; the meta-test still fails if a function is
  not covered. Includes D-23: edit through any listed property, list changes only by the owner's admin and only to a
  property where they hold a role.
- **Audit meta-test:** every mutating route has a test asserting the right `audit_log` rows under the right properties
  (and none under another); the build fails if a mutation route has none.
- **Stamping:** client-supplied `verified_*` ignored on create, update and re-verify.
- **Concurrency:** two editors on one record; the second gets 409 and the current record; no silent overwrite.
- **XSS:** a payload in every staff-entered field renders as text in the console and in the guest app; the strict CSP
  is unchanged.
- **Auth negatives** carried over from the spike (wrong origin, replay, backwards counter, expired and reused links,
  revoked credential, last-passkey guard, last-admin guard, no enumeration, logs free of emails, tokens and
  credential ids) plus rate-limit tests.
- **Surface:** the staff routes return 401 with no cookie and field names against an allow-list; the guest projections no
  longer carry `verifiedBy`.
- **Browser:** axe at 360 px on every console screen (no serious or critical), keyboard-only operation of every form,
  no sideways scroll, French shell.
- **Operator scripts:** local default; `-Remote` refusals; throwaway database.
- **Budgets:** guest initial JavaScript under 60 KB; staff chunk under its own budget.

## 8. Risks and what happens if they bite

| Risk | If it happens |
| --- | --- |
| A passkey is tied to the hostname, so hostname changes force re-registration | Stated in the console; the production hostname is O-03. Staff register on the final hostname before launch |
| Real phones and real authenticators were never tested; all browser proof uses Chromium's virtual authenticator | Reported as `[U]`; a manual check on a real phone is on the launch checklist |
| Our session, token and recovery code is unreviewed (D-26's recorded risk) | Tests carry the spike's negatives forward; an outside review before production is `[U]` and goes on `12` |
| One-admin property, device lost | Needs the operator script; the plan makes it a script and a documented step, and the nudge asks for two passkeys |
| The staff chunk grows past its budget | Split by screen; if it still does not fit, stop and report |
| The BC clock question (O-19) changes how one-off times display | Only display and tests of one-offs are affected; recurrence stores wall-clock time and the zone |
| Time: this is the largest phase so far | Four slices, each shippable and committed; if one stalls, the earlier ones stand |

## 9. What this plan does not settle

Email of any kind, HI Canada single sign-on (`03` O-02 note, `[U]`), real content for Downtown and Jericho (Phase 3), the
production hostname and who owns it (O-03), guest sessions and the Reports queue (later stages), and who at each
hostel will be the first admin (D-20 names Fawzie for content `[R]`; the first admin's identity is still
Martin's to supply).

## 10. Documents this phase will touch

`02-STATE.md`, `05-ARCHITECTURE.md` (§4 rule 1 path and §11 final design, §16 layout), `06-PRIVACY-AND-COMPLIANCE.md` (§2
retention of staff data, the guest projection without staff names), `09-CONTENT-AND-ONBOARDING.md` (§2 stamping rule
text), `10-BUILD-PLAN.md` (Phase 1b-2 tasks marked done), `03-DECISIONS.md` (the QR library choice as D-29, and any
new open item), `CLAUDE.md` only if a rule changes.
