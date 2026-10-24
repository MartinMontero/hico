# Staff sign-in spike report (Phase 1b-1, evidence for O-02)

Date: 2026-10-24. Plan: `docs\plans\2026-10-24-phase-1b-1-staff-auth-spike.md` (GO given in chat).
**This report recommends; it does not decide.** O-02 stays open and no decision row was written.

Labels: `[V]` verified, with what I ran; `[R]` reported by a source I name (page read 2026-10-24);
`[I]` inferred; `[U]` unknown. The spike code is in `spike\auth\` (throwaway, never imported by
`worker\`, `web\` or `shared\`; a test enforces that). Run output is in `spike\auth\logs\`.

## 1. Result in one table

| | Route 1: Cloudflare Access | Route 2: Better Auth 1.7.12 + passkey plugin | Route 3: own WebAuthn (SimpleWebAuthn 14) + D1 sessions |
| --- | --- | --- | --- |
| Did it run here? | **Could not test Access itself** (needs a Cloudflare login, a Zero Trust organisation and a zone). The Worker half ran against a local stand-in: 2 tests pass `[V]` | **Works** on workerd with local D1: 11 of 11 browser tests pass `[V]` | **Works**: 14 of 14 browser tests pass `[V]` |
| Passkey-capable | Not by itself. Access logs people in through an identity provider; a passkey works only if that provider offers it `[I]` | Yes `[V]` | Yes `[V]` |
| Recovery without asking Martin | Cloudflare sends a one-time PIN by email, if the PIN method is added (it is no longer on by default) `[R]` | Not provided; we wrote it (token as registration context) and it works `[V]` | We wrote it; works `[V]` |
| Sessions revocable at once | Our side: removing the staff row cuts access at once `[V]` stand-in. Access's own session revocation: page not found `[U]` | Library lists and revokes sessions `[V]`; our role lookup stops a disabled person at once `[V]` | Yes `[V]` |
| Code we would own (spike) | 58 lines + the staff mapping | 228 lines worker + 33 client + 22 SQL `[V]` | 381 lines worker + 45 client + 53 SQL `[V]` |
| Dependencies | `jose`: 1 package, 0.2 MB `[V]` | 46 packages, 17.9 MB `[V]` | 26 packages, 3.4 MB `[V]` |
| Worker bundle (`wrangler deploy --dry-run`) | not built | 2,569 KiB, 471 KiB gzip `[V]` | 789 KiB, 148 KiB gzip `[V]` |
| Browser JavaScript for the sign-in page | none (Access's own page) | 45.6 KB minified `[V]` | 9.8 KB minified `[V]` |
| Cost | Free: 50 users, $0, logs up to 24 hours. Pay-as-you-go: no user limit, $7 per user per month, logs up to 30 days `[R]` | $0 | $0 |
| Needs a remote resource to adopt | Yes: a Zero Trust organisation, an Access application, a zone for a custom domain `[R]` | No | No |
| Main risk | Staff identity and logins live outside our database and our tests; cannot be tested locally; login methods depend on the identity provider | Writes into the library's tables; 500s with no message; fast-moving library (1.7.12 published 2026-10-22) | We own the security-critical parts: sessions, tokens, recovery, rate limiting |

## 2. Requirements, route by route

The nine requirements in the plan §4. `✔` = shown by a test, `doc` = from documentation only, `—` = not applicable or not shown.

| # | Requirement | Route 1 | Route 2 | Route 3 |
| --- | --- | --- | --- | --- |
| 1 | Passkey-capable | doc: only through an identity provider | ✔ | ✔ |
| 2 | Recovery without Martin | doc: one-time PIN email | ✔ (our code) | ✔ (our code) |
| 3 | Sessions revocable at once | partial (our side ✔, Access's side `[U]`) | ✔ | ✔ |
| 4 | Sign-in and invite audited | not by Access for our log; Access has its own log (24 h on Free) `[R]` | ✔ for invite accepted, sign-in, sign-out, recovery (via our wrappers and hooks) | ✔ for every action tested |
| 5 | No shared logins | doc: one email per person | ✔ one passkey set per person | ✔ |
| 6 | Roles per property, read from the database on every request | ✔ (stand-in: the Worker maps the email and reads the role) | ✔ | ✔ |
| 7 | Origin and replay protection | Access token: signature, issuer, audience, expiry all checked and refused when wrong ✔ (stand-in) | ✔ wrong origin refused (403, no person created); replay not separately tested | ✔ wrong origin refused; replayed assertion refused; backwards counter refused; challenge single-use |
| 8 | Cross-site safety on writes | — | ✔ (Origin check in front of the library) | ✔ Origin and JSON checks |
| 9 | Nothing identifying in logs | — | ✔ no email, token or cookie in the server logs | ✔ same, plus no credential id |

## 3. Route 3: our own WebAuthn (`spike\auth\own\`)

What I ran `[V]`: SimpleWebAuthn server 14.0.3 and browser 14.0.0 on a Worker under `wrangler dev` with
local D1, driven by Playwright with Chromium's virtual authenticator (`WebAuthn.addVirtualAuthenticator`,
Chromium 156 headless shell). 14 tests, output in `spike\auth\logs\own-playwright-run.txt`.

Shown: invite token (hash stored, 30 minutes, single use, kept in the URL fragment and removed from the
address bar) then first passkey; sign-in with no username; sign-out; sign-out everywhere; list and revoke a
session; a role changed or removed between two requests takes effect at once; a disabled person stops at once;
an editor cannot invite, an admin of A cannot invite into B; a second passkey can be added and a passkey can
be revoked, and the last one cannot be removed; a credential counter that goes backwards is refused; an
assertion cannot be replayed; an expired invite and a reused invite are refused; recovery on a new device
(old sessions and old passkeys stop working; the recovery answer is the same for known and unknown
addresses); every action left an audit row under the right property and none under the other; writes need a
matching Origin and JSON; a server that expects another origin refuses registration and sign-in; the server
logs hold no email, token, credential id or cookie.

What the library did for us: parsed and verified the registration and sign-in responses, checked the origin,
the relying-party id, user verification and the counter. What we wrote: challenge storage (single use, five
minutes), session tokens (random token in an `HttpOnly; Secure; SameSite=Lax` cookie, only an HMAC of it in the
database), invites and recovery tokens, revocation, the audit calls, and the rule that a person can never remove
their last passkey.

Not built, and needed before production `[U]`: rate limiting of the sign-in, invite and recovery endpoints (the
`rate_limits` table is planned for Phase 5); a passkey management page; conditional-UI sign-in; a review by someone
who is not me.

## 4. Route 2: Better Auth with the passkey plugin (`spike\auth\better\`)

What I ran `[V]`: `better-auth` 1.7.12 and `@better-auth/passkey` 1.7.12 on workerd with local D1, same virtual
authenticator. 11 tests, output in `spike\auth\logs\better-playwright-run.txt`.

It works, with these facts:

- **D1.** `betterAuth({ database: env.DB })` works as it is: version 1.7.12 ships its own D1 dialect `[V]` (its
  adapter package contains `d1-sqlite-dialect`). The Kysely page I read in advance did not mention D1 `[V]`, so
  the documentation lags the package. `kysely-d1` (last published 2025-04) was installed, not needed, and not
  used. The CLI cannot reach D1; the documented route is a programmatic migration endpoint (`getMigrations`),
  which created `user`, `session`, `account`, `verification` and `passkey` on D1 `[V]`. D1 has no interactive
  transactions, and the library's D1 dialect says so in its source `[V]`.
- **Workers.** It needs the `nodejs_compat` flag (its documentation says it uses `AsyncLocalStorage`) `[R]`
  `[V]`. One instance is built per request, because the D1 binding exists only inside a request.
- **Passkey-first sign-up.** `registration.requireSession: false` with `resolveUser` and `afterVerification`
  accepts our single-use token as its `context`, so our invites work as the way in `[V]`.
  **Finding:** that path does not create the library's own `user` row. Its table needs a unique email, so our
  hook has to insert it. We also chose the id so that our `staff_users.id` equals the library's `user.id` `[V]`.
- **Roles stay ours.** The library knows nothing about per-property roles. The seam is the same as Route 3: its
  session becomes the `StaffResolver` and `roleAtSlug` reads our `staff_memberships` on every request `[V]`.
- **Sessions.** `list-sessions`, `revoke-session`, `revoke-sessions` and `sign-out` exist and work `[V]`.
- **Recovery.** None is provided. We reused our token as the registration context and removed the old sessions
  and passkeys from its tables in our hook; it works `[V]`.
- **Lock-out.** Deleting a person's only passkey is allowed (status 200, none left) `[V]`; a guard is ours to write.
- **Audit.** Its passkey authentication hook carries no user (read from its type definitions `[V]`), so the
  sign-in audit is written by a wrapper around its route.
- **Cookie.** `better-auth.session_token` is `HttpOnly` and `SameSite=Lax`; `Secure` was **false** over
  `http://localhost` `[V]`. Whether it is set over https is `[I]` (not tested here).
- **Diagnosis.** A failure inside a hook returned a bare 500 with no message until I added a logger `[V]`.
- **Weight.** 46 packages and 17.9 MB installed; the Worker bundle is 3.2 times the size of Route 3's; the client
  is 4.7 times larger; and the plugin depends on SimpleWebAuthn 13 while 14 is current, so two copies are
  installed if both are present `[V]`. Worker size limits for the plan were not re-checked `[U]`.
- **Not measured:** per-request cost of building the instance `[U]`.

## 5. Route 1: Cloudflare Access (documents plus a local stand-in)

Could not test Access: it needs a login, a Zero Trust organisation and a zone, which the brief forbids and the
Wrangler login is unchecked.

From Cloudflare's pages `[R]`:

- **Plan.** Free: 50 users, $0, logs up to 24 hours. Pay-as-you-go: no user limit, $7 per user per month, logs up to 30
  days (`cloudflare.com/plans/sase-zero-trust.md`). The account-limits page gives no seat limit, so the free
  figure comes only from the plan page. What counts as a seat is `[U]`.
- **Login methods.** New Zero Trust organisations default to Cloudflare as the identity provider (users sign in with
  a Cloudflare account); the one-time PIN is **no longer added automatically** and has to be added by hand
  (changelog 2026-05-19, one-time-PIN page). A PIN is emailed only if a policy allows the address, lasts 10
  minutes and is single use. Passkeys appear only if the upstream identity provider offers them `[I]`; I found no
  page saying Access takes a passkey itself `[U]`.
- **Validation the Worker must do** (the "Validate JWTs" page): read `Cf-Access-Jwt-Assertion` (not the cookie), fetch
  keys from `https://<team>.cloudflareaccess.com/cdn-cgi/access/certs`, select by `kid`, verify RS256, the issuer
  (the team domain), the audience (the application's AUD tag) and expiry, and take the email from the payload.
  Keys rotate every 6 weeks and the old key stays valid for 7 days.
- **workers.dev.** Access can protect the production `workers.dev` address and preview URLs (Workers routing page).
  Whether it can protect the demo's custom domain depends on that zone being on the account `[U]`, as in D-21.
- **Mapping to a property and a role.** Access proves an email; mapping it to a property and role is ours `[I]`.
- **Session revocation.** The session-duration page returned 404; the policies page says nothing about revoking
  sessions when a policy changes `[U]`.
- **Cost beyond free, local development, audit:** Access keeps its own log (24 hours on Free); our `audit_log`
  would still need an entry per sign-in `[I]`. A local run needs a stand-in for the token.

What I built and ran `[V]` (`spike\auth\access\`, 2 tests, `node --test`): the Worker half against a generated key
pair and a made-up team domain. It accepts a valid token and refuses: a missing header, an expired token, the
wrong audience, the wrong issuer, a signature from a different key, an unknown `kid`, garbage, an HS256 token
(algorithm confusion), an unsigned `alg: none` token and a token with no email. A key set holding both the new and
the previous key accepts both; once the old key is gone its tokens stop working. A valid Access login for an
address that is not a `staff_users` row gets nothing, and deleting the row cuts access at once. This proves the
Worker half only; it says nothing about how Access behaves.

## 6. Email for invites and recovery

From current public pages `[R]`:

| Option | Free | Paid | Needs | Notes |
| --- | --- | --- | --- | --- |
| Cloudflare Email Service (Workers `send_email` binding, REST, SMTP) | Sends to verified destination addresses in your own account are free on any plan | Arbitrary recipients need **Workers Paid**: 3,000 included per month, then $0.35 per 1,000 | Onboard a sending domain: adds MX, SPF, DKIM and DMARC records under `cf-bounce` and `_dmarc` (domain must use Cloudflare DNS; a DNS change) | The overview labels Email Sending **Beta**; the pricing page does not say. The binding is `remote = true`, so `wrangler dev` sends **real** email: a local capture seam is mandatory |
| Resend | 3,000 emails per month, 100 per day, 3 domains | Pro $20 per month, 50,000 | A verified domain | Third-party data flow |
| Postmark | 100 emails per month | Basic $15 per month, 10,000 | A verified sender | Third-party data flow |

Privacy facts, not a choice: staff email addresses are the only directly identifying data the app stores (`06` §2);
an emailed link is as safe as the mailbox. Any third-party provider is a new data flow that needs Martin's
decision; none of the three is on the D-11 exclusion list, and I did not check who owns them `[U]`.

**An alternative that needs no email at all** `[I]`: the admin is shown a one-time link or QR code and hands it
over in person. Recovery is the same: another admin of that property issues a link, or the person uses their second
passkey. This fits two hostels with a handful of staff. A property with a single admin who loses their only device
still needs email or an operator step, so staff should register two passkeys.

In the spike, email is a local capture only; nothing was sent and no account was created `[V]`.

## 7. Cross-cutting findings

1. **`audit_log` is per property, sign-in is per person `[V]`.** I wrote one row per membership. A person with no
   membership produces no row (and cannot sign in anyway). A platform-level audit table, or one `audit_log`
   row with a nullable property, is a schema choice for Phase 1b-2 (O-20).
2. **A second `wrangler` project inside the repository collides with the Vite plugin's generated deploy config `[V]`.**
   Running `wrangler` in `spike\auth\own` failed with "Found both a user configuration file ... and a deploy
   configuration file" until I passed `-c wrangler.jsonc`. Anyone adding a second Worker folder needs the same flag.
3. **`wrangler deploy --dry-run` was run twice, locally, to measure bundle sizes `[V]`.** It uploaded nothing and
   needed no login; I did not run `deploy` without the flag. I mention it because `CLAUDE.md` forbids deploys.
4. **Chromium's virtual authenticator works here, with one limit `[V]`:** Chrome allows one internal authenticator at
   a time, so a second device in a test is a USB security key.
5. **SimpleWebAuthn refuses to register the same authenticator twice for one person (`excludeCredentials`) `[V]`.**
   Correct behaviour; a person adds a second device, not the same one again.
6. **Rate limiting is needed on `recover`, `login/options` and invites for every route `[U]`**, because none of the
   spike code limits them.

## 8. Recommendation (mine; Martin decides O-02)

**Route 3: our own WebAuthn with SimpleWebAuthn 14 and D1 sessions**, with invite and recovery links handed over by
an admin for the demo, and email as a later add-on through Cloudflare Email Service if Martin wants it.

Why: it is the only route that met every requirement in a test, it keeps staff identity, roles, sessions and the
audit trail in our database under our isolation tests, it needs no remote resource, and it is the smallest to ship
(148 KiB gzip Worker, 9.8 KB client, 26 packages). Route 2 saves roughly 150 lines but adds 17.9 MB, a larger Worker and
client, writes into another schema, and still needed our own recovery, audit wrappers and lock-out guard. Route 1 is the
least code but cannot be tested here, does not itself give passkeys, ties sign-in to a Zero Trust organisation, and
depends on the staff having a Cloudflare account or on the PIN method being added.

**The strongest argument against it:** we would own security-critical code (sessions, tokens, recovery, rate limiting)
that a maintained library or Cloudflare would otherwise own. A flaw in our recovery or session code is our flaw, and
nobody independent has reviewed it. Route 2 has a larger user base and ships session management and passkey management
pages; Route 1 puts the hardest part on Cloudflare's infrastructure and is the least code for us to get wrong. The
spike's 14 negative tests lower that risk; they do not remove it, and an outside review before production is `[U]`.
If Martin weighs "never write auth ourselves" above size and control, Route 2 is the honest alternative.

## 9. Decisions this leaves for Martin

- **O-02:** the route. Recommended: Route 3, passkey-first.
- **O-20:** where person-level audit events go (§7.1).
- **O-21:** how invite and recovery links are delivered: admin-issued link, or email (and which sender and plan).
- Whether HI Canada wants single sign-on for staff (`03` O-02, still `[U]`); that would change this answer.

## 10. What I could not verify

Access itself (login, policy, session revocation, passkeys through an identity provider); whether Better Auth's
cookie is `Secure` over https; per-request cost of Better Auth's instance; Worker size limits for the plan; the
free seat definition for Access; email deliverability of any option (nothing was sent); and anything about
real phones or real authenticators (all browser proof used Chromium's virtual authenticator).
