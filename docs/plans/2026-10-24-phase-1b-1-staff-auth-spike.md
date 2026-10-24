# Plan — Phase 1b-1: staff sign-in spike (evidence for O-02)

Date: 2026-10-24. Status: **written, waiting for Martin's GO. Nothing in this plan has been
run.** Labels as in `00-README.md`: `[V]` verified (what I ran or read, and when), `[R]`
reported by a source I name, `[I]` inferred, `[A]` assumption, `[U]` unknown.

The brief is in `10-BUILD-PLAN.md` Phase 1b-1. This plan says how I will carry it out, what I
already know, what each route will cost to test, and what I need from you before I start.
The spike **recommends; it does not decide.** You call O-02. No decision row is written.

## 0. What I need from you at GO

| # | Question | My recommendation |
| --- | --- | --- |
| 1 | Approve `npm install` from the npm registry, in a separate folder `spike\auth\` that has its own `package.json` and `node_modules` (never the root lockfile) | Yes. Packages in §3 |
| 2 | Approve reading public documentation and package READMEs on the web (Cloudflare, Better Auth, SimpleWebAuthn, email options) | Yes. Read only, no account, no form |
| 3 | Accept that Route 1 (Cloudflare Access) cannot be run: it needs a Cloudflare login and a zone, which the brief forbids. Its row in the report will say "could not test" for everything that needs a live Access application | Yes |
| 4 | Accept that Route 2 may end as "does not work on Workers with D1", with the reason | Yes. A clean "no" is a result |
| 5 | Third-party email providers: the report may *describe* them from their public pages, but nothing is signed up for and nothing is sent. Whether a third-party mail provider is acceptable at all is a privacy question I list, not answer | Yes |

Nothing else is outstanding: the O-19 time-zone question (BC clocks) is yours and does not
block this.

## 1. What I already know (read today, 2026-10-24)

Facts that shape the plan. Each is a starting point; the spike re-checks the ones it relies on.

| Fact | Label |
| --- | --- |
| `better-auth` 1.7.12 and `@better-auth/passkey` 1.7.12 are on npm (modified 2026-10-22). The passkey plugin depends on `@simplewebauthn/server ^13.3.1` and `@simplewebauthn/browser ^13.3.0`, on `zod ^4.5.4`, and has peers `better-call 1.4.4` and `@better-fetch/fetch 1.3.2` | `[V]` npm registry |
| `@simplewebauthn/server` 14.0.3 (2026-09-25) and `@simplewebauthn/browser` 14.0.0 (2026-09-02) are the current releases; so the plugin pins the previous major `[V]`. `@oslojs/webauthn` 1.0.0 (2026-07-29) is another WebAuthn library | `[V]` npm registry |
| Better Auth's SQLite page covers `better-sqlite3`, `node:sqlite` and `bun:sqlite`, says SQLite goes through its Kysely adapter, and does not mention D1 or Workers | `[V]` page read 2026-10-24; whether D1 works is `[U]` |
| Cloudflare's Zero Trust account-limits page lists 50 Access identity providers, 500 applications and 50 service tokens, and gives **no seat (user) limit** for the Free plan | `[V]` page read 2026-10-24. The free seat limit is `[U]`; I must not quote the figure I half remember |
| Cloudflare Email Service: Workers can send through a binding, the REST API or SMTP. **Email Sending is labelled Beta.** Sending to arbitrary recipients needs **Workers Paid**; sending to verified destination addresses in your own account is free on both plans. No free quota numbers on that page | `[V]` page read 2026-10-24 |
| The deployed Worker and tests already have: `staff_users` (email unique), `staff_memberships` (role per property), `audit_log` (append-only), `entry_codes`, the staff route `GET /staff/p/:slug/me` with an injected sign-in resolver, and `roleAtSlug` reading the role from D1 on every request | `[V]` in this repository, `02` §4 |
| Phase 1's `StaffResolver` is the seam: a route plugs in by returning `{ staffUserId }` from the request, and the tenant layer does the rest | `[V]` `worker\middleware\tenant.ts` |

## 2. What "done" looks like

`docs\spikes\staff-auth-report.md` with:

1. A comparison table for the three routes: **works / does not work / could not test**, code
   we would own (lines, files, dependencies), recovery story, cost, risks.
2. My recommendation and the strongest argument against it.
3. Every claim labelled `[V]` (with what I ran, and the output kept under `spike\auth\logs\`),
   `[R]` (with the source URL) or `[U]`.
4. The email-sending findings.
5. Answers to the nine requirements in §4, route by route.

Plus `docs\02-STATE.md` updated (what exists, what is not verified) and **O-02 left open**.
The `spike\` code is throwaway: it is not imported by `worker\`, `web\` or `shared\` (a test
asserts that), it is not part of `npm run validate`'s typecheck or lint, and it is deleted or
kept only as a reference folder, as you decide at the end.

## 3. The three routes: what I will do

Order: **Route 3 first** (the baseline we would own), then Route 2, then Route 1 (documents
only), then email. Reason: Route 3 produces the shared test harness (virtual authenticator,
local D1, audit assertions) that Route 2 reuses, and it fixes what "meets the requirements"
means in code before the library routes are judged against it.

### Route 3 — our own WebAuthn with D1 sessions (`spike\auth\own\`)

- **Libraries:** `@simplewebauthn/server` 14.0.3 and `@simplewebauthn/browser` 14.0.0 (current,
  `[V]` above), Hono, the existing D1 schema.
- **Tables added in the spike only:** `staff_credentials` (credential id, public key, counter,
  transports, label, created, last used, revoked), `staff_sessions` (id as an HMAC hash, staff
  user, created, expires, revoked, user-agent label? **no**: nothing identifying beyond need),
  `staff_invites` (hash of token, email, property, role, expires, used), `webauthn_challenges`
  (short-lived, single-use). Each has the length CHECKs and composite keys the project already
  requires.
- **Build:** invite accept (first passkey), sign-in, sign-out, sign-out everywhere, revoke one
  session, revoke a credential, add a second passkey while signed in, recovery by a second
  passkey and by a single-use email link (the email goes to a local capture file, never sent),
  every event written to `audit_log` through the existing repository layer.
- **Resolver:** returns `{ staffUserId }` from the session cookie (`HttpOnly`, `Secure`,
  `SameSite=Lax`); the role still comes from `roleAtSlug` on every request.
- **Proof in Playwright** with Chromium's virtual authenticator (`WebAuthn.addVirtualAuthenticator`
  over the DevTools protocol; I confirm it is available in the installed Chromium 156 headless
  shell, and say so if it is not): register, sign in, sign out, wrong origin refused, replayed
  assertion refused (counter), expired and reused invite refused, revoked session refused on the
  next request, revoked credential cannot sign in, a second property's role does not leak, and
  every action has an audit row.
- **Reported:** lines of code and files we would own, dependency count and size, what the
  library does and does not check for us (origin, RP ID, counter, user verification), what the
  recovery flow needs that the library does not provide.

### Route 2 — Better Auth with the passkey plugin (`spike\auth\better-auth\`)

- **Try, in this order:** (a) Better Auth with a D1-capable Kysely dialect; (b) with its Drizzle
  adapter over D1; (c) whatever its current documentation names for Workers. For each I report
  whether it starts in workerd with a local D1, what extra packages it needed, and the exact
  error if it does not. If none runs, that is the finding, with the reason.
- **If it runs:** register a passkey, sign in, sign out, list and revoke sessions, and test the
  same Playwright cases as Route 3 where the plugin allows. Then answer the hard questions the
  library raises: its own `user`, `session`, `account`, `passkey` and `verification` tables
  against our `staff_users`; whether `staff_memberships` stay ours (they must: roles are per
  property and read from our database every request); how invites, audit rows and
  per-property roles are written (hooks, or our own code around it); how recovery works; what
  the plugin's SimpleWebAuthn 13 dependency means for us beside 14.
- **Reported:** same rows as Route 3, plus "what we would still have to write ourselves", and
  its dependency tree size compared with Route 3.

### Route 1 — Cloudflare Access in front of the staff path (documents only)

I cannot run it: it needs a Cloudflare login, a Zero Trust organisation and a zone (the brief
forbids all three, and Wrangler's login is unchecked). So this route is answered **from
Cloudflare's current documentation, quoted by URL and date**, and every item is labelled `[R]`
or `[U]`, never `[V]`:

- the free-plan seat limit (not on the limits page; I look for the pricing and plans pages and
  say plainly if a number cannot be found), cost beyond it, and what counts as a seat;
- login methods available (one-time PIN by email, identity providers, passkeys through an
  identity provider or not), and whether a staff member with no Google or Microsoft account can
  sign in;
- how an Access login maps to a property and a role: Access proves an email address; the Worker
  maps it to `staff_users` and `staff_memberships` itself (inferred; confirmed from the docs
  where possible);
- what the Worker must verify on each request: the signed Access token header, its signature
  against the team's published keys, the audience tag, the expiry, and the email claim; and
  that nothing may trust the header's presence alone;
- whether Access can protect the `workers.dev` preview address or only a custom domain, which
  matters because D-21's demo domain's zone is unchecked `[U]`;
- recovery, revocation (revoking an Access session versus our membership row), audit (Access has
  its own logs; ours still need an entry), and local development (the Worker needs a stand-in
  for the token when run locally);
- **what I can build and test without Cloudflare:** the Worker's token-verification middleware
  against a locally generated key pair and a made-up team domain, so the *Worker half* of
  Route 1 is proven in code (valid, expired, wrong audience, wrong signature, missing header
  all refused). This is labelled "local stand-in, not Access itself".

### Email for invites and recovery (documents plus a local capture)

- From current documentation, report how a Worker sends transactional email today: Cloudflare
  Email Service (Workers binding, REST, SMTP), Email Routing's send to verified destinations,
  and the main third-party providers' public pricing pages, with free limits and what each
  needs (domain verification, plan). Facts already known: Email Sending is Beta, and sending to
  arbitrary addresses needs Workers Paid `[V]` above.
- **Implement only a local capture** (a function that writes the message to a gitignored file),
  used by Routes 2 and 3. **No email is sent, no account created, no remote resource.**
- List the privacy facts for each option (what is sent and to whom; staff email addresses are
  the only directly identifying data the app stores, `06` §2) without choosing: a third-party
  mail provider is a data flow that needs your decision, and D-11's exclusion list applies.

## 4. The nine requirements, tested route by route

From the brief and `05` §11. The report has one row per requirement per route.

| # | Requirement | How it is tested |
| --- | --- | --- |
| 1 | Passkey-capable | Virtual authenticator registers and signs in (Routes 2 and 3); documented for Route 1 |
| 2 | A staff member recovers access without asking Martin | A recovery path is run end to end with the local email capture (Routes 2 and 3); documented for Route 1 |
| 3 | Sessions are revocable, at once | Revoke, then the next request is refused (Routes 2 and 3; Route 1 stand-in) |
| 4 | Every sign-in and invite is written to the audit log | After each action an `audit_log` row exists under the right property |
| 5 | No shared logins | One credential and one email per person; two people cannot sign in as one |
| 6 | Roles are per property and read from the database on every request | Change a role or delete a membership between two requests; the second request reflects it. A person with no membership in property B gets a 404 from B |
| 7 | Origin and replay protection | Wrong origin refused; an assertion replayed is refused (the counter) |
| 8 | Cross-site safety | `SameSite=Lax`, Origin check and JSON-only writes (`05` §4 rule 9) still hold for staff writes |
| 9 | Nothing identifying is logged | Request logs contain no cookie, token, email or credential id (checked by capturing logs, as in the gate tests) |

## 5. Constraints I will keep

- Local only. No `wrangler login`, `d1 create`, `deploy`, `secret put`, no Cloudflare API call.
  Local D1 only, under `spike\auth\.wrangler\` (gitignored). Wrangler metrics stay off.
- No credential, key or token in any tracked file. Test keys are generated at run time.
- Registry installs only in `spike\auth\`. The root `package.json`, lockfile and production
  dependencies do not change. `spike\` is added to the static test's scan exclusions with its
  reason, and a test fails if anything under `worker\`, `web\` or `shared\` imports from `spike\`.
- No account, no form, no signup, no email sent. Reading public pages only.
- `npm run validate` stays green throughout; I run it at the end and paste the raw output.
- Time-box: if a route cannot be made to run after a reasonable, recorded effort, the report
  says "does not work" with the error, and I move on.

## 6. Risks and what happens if they bite

| Risk | If it happens |
| --- | --- |
| Better Auth has no working D1 route | Report "does not work on Workers + D1 as tested", with the error and the nearest alternative it names; no workaround that makes us own its internals |
| Chromium's virtual authenticator is not usable in the headless shell | Say so; test with the full Chromium channel if installed, or fall back to server-side verification of recorded fixtures and mark browser proof `[U]` |
| SimpleWebAuthn 14 changes API from 13 | Use 14 for Route 3 (current); note the version split against Route 2 |
| A source page is out of date, contradictory or unreachable | Report `[U]` with the URL; never fill a gap from memory |
| Any route turns out to need a login, a paid plan or a remote resource to test | **Stop and ask you**, as the brief says |
| The spike tempts me to pick a winner by the work already done | The report lists what each route would cost to *adopt*, not what it cost to try; the recommendation is argued against itself |

## 7. What this plan does not settle

- O-02 itself, and whether HI Canada wants single sign-on for staff (that would change the
  answer; `[U]`, `03` O-02).
- Which mail path is acceptable, and the staff-recovery wording; both come out of the report.
- The real staff console (Phase 1b-2), which has its own plan and GO.
- O-19, BC clocks: yours; the audit log and sessions store UTC instants and are unaffected.

## 8. Documents this spike will touch

`docs\spikes\staff-auth-report.md` (new), `docs\02-STATE.md` (what exists and what is not
verified), `docs\plans\` (this file stays as the record). `03-DECISIONS.md` is **not** changed
except that the build may append an open item if the report finds a new question for you.
