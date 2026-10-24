# Plan — Phase 1: multi-tenant foundation (demo base)

Date: 2026-10-23. Status: **written, waiting for Martin's GO. Nothing in this plan has
been built.** Labels as in `00-README.md`: `[V]` verified, `[I]` inferred, `[A]`
assumption, `[U]` unknown.

Scope: D-22 Phase 1 only. Project scaffold, database schema, tenant isolation, shell,
language and theme layers, preview gate. No guest features, no staff sign-in (Phase 1b),
no deployment, no remote resource, no secret, no Wrangler command that contacts
Cloudflare. Framework: Preact 11 (D-12, present in `03-DECISIONS.md`).

## 0. What I need from you at GO

| # | Decision | My recommendation | Section |
| --- | --- | --- | --- |
| 1 | D-15: how one activity belongs to one or two properties | **Option A**: shared record plus an explicit "offered at" list; D-02 does not change | 1 |
| 2 | D-21: how one domain serves two hostels | **Option 1**: property chosen by a path segment, checked against a per-host list held in the database; needs a one-paragraph change to `05` §4 rule 1 | 2 |
| 3 | Downloads this plan needs (§5) | Approve the npm registry installs and the Chromium download | 5 |
| 4 | Displayed hostel names without the letters "HI" for the demo (D-21: no HI mark anywhere) | Yes: "Vancouver Downtown", "Vancouver Jericho Beach", "Whistler" | 3 |
| 5 | Header brand stand-in (`02` row 18) | Property name as text only, no glyph | 3 |
| 6 | Seed two extra, near-empty properties so the demo can show the hostel choice | Yes, but only if you want to see the choice in Phase 1; otherwise tests alone cover it | 2 |

D-13 (validation library) is mine to choose and record: **Valibot** (§4). Say so at GO
if you object.

## 1. D-15 — one activity, one or two properties

The board is shared: the Jericho and Downtown grids have the same 14 weekly titles in the
same slots, and a poster that names a hostel names Downtown (`jericho-transcription.md`
§3, points 1 and 2). Place lists differ per hostel (point 5). So only activities need
sharing; places, offers and zones stay per property.

### Option A (recommended): shared record plus an "offered at" list

- `activities.property_id` is the **owner**: the property whose staff created the record.
  The activity's zone (where it meets) belongs to the owner (`zones` composite foreign
  key on `(zone_id, property_id)`), which matches D-15: most activities meet at
  Downtown.
- New table `activity_offered_at (activity_id, owner_property_id, property_id)`, primary
  key `(activity_id, property_id)`. A composite foreign key
  `(activity_id, owner_property_id) → activities(id, property_id)` ties it to the
  activity; `property_id → properties(id)` says who may see it. **Every** activity, even
  a one-hostel one, has an owner row here, so reads have one code path.
- `activity_exceptions` hangs off `(activity_id, property_id=owner)`. Cancelling one date
  cancels it for every property that offers the activity (one record, edited once).
- **Read rule:** for context property P, an activity is visible if and only if a row
  `(activity, P)` exists. The statement carries `P` as `activity_offered_at.property_id`.
- **Edit rule (the one the isolation suite tests):** a staff member may change an
  activity's content (text, time, status, exceptions, verification stamps) if they hold
  `editor` or `admin` at **any** property that offers it; the property they act under is
  named in the path and its role is checked per request (`05` §4 rule 1, rule 8). Only an
  `admin` of the **owner** may change the offered-at list or delete the activity. An
  edit is written to `audit_log` under the property named in the path, with the activity
  id as target. A property not in the list can neither read nor edit it.
- Phase 1 has no activity write routes (the brief limits writes to `audit_log` and
  `event_counts`). It builds and tests the rule as `canEditActivity(ctx, id)` and
  `canChangeOfferedAt(ctx, id)` read-only guards, so the later write functions cannot
  skip them. A meta-test fails if a future repository write function for activities does
  not call a guard.
- **D-02 does not have to change.** Each property is still a tenant with its own staff
  login, features and content. The one exception to "a row belongs to exactly one
  property" is an activity, which is readable by the properties named in its list. That
  exception is stated in one added paragraph in `05` §4 (I will draft it; you approve it
  with this plan).
- **Costs:** one extra join on every activity read; a second rule (the edit rule) that
  must be tested for every future activity write; if the owner property is ever removed,
  the activity has to be handed to another property first (a guard refuses the removal
  otherwise); an activity cannot be cancelled at one hostel only (that would be a second
  record, against D-15). Cross-property joins are the thing `05` §4 is built to prevent,
  so this is the riskiest part of the schema.
- **Tests:** (a) P not in the list reads, lists, edits, deletes: finds nothing. (b) P in
  the list reads it; its projection has the same field allow-list as the owner's.
  (c) A property with a role elsewhere but not on this list cannot edit. (d) Removing P
  from the list at once removes it from P's reads. (e) The composite key rejects an
  `activity_offered_at` row whose `owner_property_id` is not the activity's real owner.
  (f) An exception row for an activity of another owner is rejected by the database.

### Option B: one tenant, two sites

The tenant is "the Vancouver hostels"; Downtown and Jericho become `sites` inside it, and
every row carries `property_id` of the tenant plus a `site_id`.

- **D-02 would have to change** from "each HI Canada property is a tenant" to "each
  content group is a tenant; a property is a site in a group". The privacy contact,
  timezone, hosts and features currently on `properties` would need to sit on the site.
- A shared activity is simply one row in the tenant with a site list, so the isolation
  rules need no exception.
- **Costs:** staff at either hostel get the rights over both hostels' places, offers and
  zones unless a second layer of site roles is added (`05` §4 rule 8 becomes per site
  inside per tenant); Whistler is not in the group, so a second tenant model is still
  needed; the schema, the docs and `09` §1 all change; the group must be agreed with HI
  Canada, which is not recorded `[U]`. It also bakes "Jericho and Downtown are one
  organisation" into the data, which is true of the people (Rhian, Fawzie) but is not
  something the boards state.
- **Tests:** same as A, plus staff of site X cannot edit site Y's places inside the same
  tenant.

### Option C (not recommended): two copies kept in step

Rejected by D-15 (one record, edited once) and already contradicted by the boards
(Pumpkin Carving, the crawls, Bingo For Life differ between them).

## 2. D-21 — one domain, two hostels

The rule today (`05` §4 rule 1, `CLAUDE.md`): public reads take the property from the
server-side hostname lookup; never from the body, the query string, a client-set header
or any other client-supplied id. Facts that shape the options:

- `hico-preview.<account>.workers.dev` is **one** host `[V]` (the Worker's workers.dev
  name). A hostname rule cannot tell two hostels apart there. A per-hostel subdomain on
  preview needs a custom domain per hostel on a zone in your account, which is `[U]`
  (`builderworkshop.ca` on the Cloudflare account Wrangler will use is unchecked, D-21).
- `hico.builderworkshop.ca` is one name. `downtown.hico.builderworkshop.ca` is a
  second-level name; Cloudflare's free universal certificate normally covers only one
  level of subdomain `[I]`, so it would need a paid certificate `[U]`. A one-level name
  such as `hico-downtown.builderworkshop.ca` avoids that but is not the domain D-21
  names. Every DNS or route change needs your GO.

### Option 1 (recommended): path segment, checked against a per-host list

- Pages: `/p/<slug>/whats-on`, `/p/<slug>/explore`, and so on. API: `/api/p/<slug>/...`.
  Staff routes keep the `05` form `/staff/p/<slug>/...` with the per-request role check.
- The slug is never trusted. A table `property_hosts (host, property_id, is_default)`
  already exists in `05` §5. The server finds the rows for the request's hostname and
  accepts the slug only if it names a property **in that host's own list**. A host with
  one row serves that property and treats a different slug as a flat 404. A host with
  several rows (the demo host) serves whichever the slug names, and `/` shows a picker
  built only from that host's list.
- The 404 for "unknown slug" and "slug not on this host" is identical, so the response
  does not reveal which properties exist.
- This changes `05` §4 rule 1 and the matching line in `CLAUDE.md`: the property for a
  public read comes from the hostname lookup, **narrowed by a path segment that must be
  one of that host's rows**. Staff and guest-session rules are untouched (a guest session
  still binds its property server-side when the QR code is scanned in Phase 5).
- **Works on:** local, `workers.dev` preview, `hico.builderworkshop.ca`, one DNS record
  and one certificate. A later production host with one property per hostname needs no
  code change, only `property_hosts` rows.
- **Costs:** a weakening of rule 1 that only you can approve; one more thing to test;
  QR codes carry the longer path (`/p/vancouver-jericho/...`).
- **Tests:** unknown host: 404; known host, unlisted slug: 404 identical to unknown
  slug; known host, listed slug: that property only; single-property host with another
  property's slug: 404; the slug of property B on a host whose list is only A returns
  nothing of B (checked with the isolation fixtures); query string `?p=` and header
  `X-Property` change nothing; response bodies of the API never contain a property id
  other than the public slug.

### Option 2: one hostname per hostel (keeps rule 1 as written)

`hico-downtown.builderworkshop.ca` and `hico-jericho.builderworkshop.ca` (or
second-level names), each in `property_hosts` with one row.

- **No rule change.** QR codes and links are short.
- **Costs:** preview on `workers.dev` can serve only one hostel unless custom domains
  are added to the preview Worker (a route change that needs your GO and a zone on the
  account `[U]`); the demo domain in D-21 would no longer be `hico.builderworkshop.ca`
  alone; a second-level name may need a paid certificate `[U]`; two DNS records.
- **Tests:** unknown host: 404; each host returns only its own property; a request with
  `Host: jericho` and a slug or query naming Downtown still returns Jericho only.

### Option 3 (not recommended): the choice travels in a query parameter, a cookie or a
picker value stored on the device

Breaks rule 1 outright (the query string and client-set values are named as forbidden),
and gives a guest a way to ask for any property. Rejected.

## 3. Brand mark and names (`02` row 18, D-21)

D-21 says no HI logo and no other HI mark anywhere. **Recommended:** the header shows the
property name as text only, no glyph. The prototype's mountain glyph is original, but
whether HI Canada permits marks near its name is `[U]`, so it stays out until O-03 is
answered. Displayed names for the demo drop the letters "HI": "Vancouver Downtown",
"Vancouver Jericho Beach", "Whistler" (French: the same names; "HI Vancouver Downtown"
is the official hostel name and is not mine to alter in records, but D-21 is about the
app's marks). The document title is the property name followed by the tab name. The
product's working name "HI CO" is **not** shown in the UI.

## 4. Build

### 4.1 Tool choices and the checks that shaped them (read from the npm registry,
2026-10-23 `[V]`; nothing installed yet)

| Part | Version | Note |
| --- | --- | --- |
| preact | 11.0.2 | D-12 |
| @preact/preset-vite | 2.10.6 | peer range includes Vite 8 |
| vite | 8.3.5 | the version the benchmark used |
| @cloudflare/vite-plugin | 1.65.0 | peer Vite `^6.1 \|\| ^7 \|\| ^8`, Wrangler `^4.152.0` (the installed 4.152.0 satisfies it) |
| hono | 4.13.13 | |
| wrangler | 4.152.0 (project dev dependency; the global one stays) | only local commands |
| vitest | **pin 4.x** (latest is 5.0.5) | `@cloudflare/vitest-pool-workers` 0.23.0 requires `vitest ^4.1` |
| @cloudflare/vitest-pool-workers | 0.23.0 | runs API and repository tests against a real local D1 |
| typescript | **pin 6.0.x** (latest is 7.0.2) | `typescript-eslint` 8.72.0 requires `<6.1.0`; the 6.0.x release is checked at install |
| eslint / typescript-eslint | 10.13.0 / 8.72.0 | peer ranges match |
| oxlint | 1.89.0 | jsx-a11y rules without the ESLint 10 peer conflict found in `05` §2.1 |
| @playwright/test, @axe-core/playwright, axe-core | 1.64.1, 4.14.0, 4.14.0 | |
| @fontsource/dm-sans | 5.3.0, licence OFL-1.1 `[V]` npm | self-hosted from the package, no Google request; the licence text is copied into the repo |
| valibot | 1.5.0 | D-13 |
| jsdom | 30.1.3 | unit tests of the dialog |

**D-13 — Valibot (recommended; recorded when built).** Zod 4.6.7 is the other serious
choice. Valibot is modular, so the browser bundle carries only the validators the shell
uses, which matters against the 60 KB initial-JavaScript budget (`04` §7) `[I]`. Cost:
a smaller ecosystem than Zod `[I]`; error messages need our own i18n mapping either way.
Both are used from `shared\` by browser and Worker, and every length limit is declared
once in `shared\limits.ts`.

If a pin above cannot be satisfied (for example TypeScript 6.0.x is missing), I stop and
report rather than relaxing a peer check.

### 4.2 Layout (adjusts `05` §16; the real one goes into `02-STATE.md`)

```text
hico\
  package.json  tsconfig*.json  eslint.config.js  vite.config.ts  vitest.config.ts
  playwright.config.ts  wrangler.jsonc  .dev.vars.example
  worker\            index.ts (Hono app), middleware\ (gate, host, tenant, read-only,
                     security headers, origin), routes\, repositories\, projections\,
                     preview-gate\
  web\               index.html, src\ (app, router, pages, components, i18n, theme)
  shared\            limits.ts, schemas.ts, types.ts, i18n catalogs, tokens
  migrations\        0001_foundation.sql
  seed\              demo-whistler.ts, run.ts (refuses non-local)
  scripts\           validate pieces (contrast table, bundle size, static checks)
  tests\             unit, isolation, anonymous-surface, static, e2e
```

### 4.3 What gets built, in order (each step ends green before the next)

1. **Scaffold and the three tool checks.** Vite + Cloudflare plugin + Hono Worker + Preact
   shell; `wrangler.jsonc` top-level name `hico-preview`, `env.prod` name `hico-prod`
   with its own D1 binding; assets with `not_found_handling:
   "single-page-application"` and `run_worker_first: true` so the gate and API see every
   request. Local D1 only (`wrangler dev` / the plugin's local state). A build test fails
   if any resolved Worker name is `hico`, `mec-trails`, `lume` or `lume-city`. **I then
   report what I saw** for: the plugin running Worker + assets + local D1 with Preact;
   Vitest (workers pool) on Windows; Playwright with Chromium on Windows. If any fails
   in a way that points at Preact, I stop and give you the Svelte 5 cost (§6).
2. **Migration 0001** for the 14 tables in the brief plus `activity_offered_at` (§1).
   Ids: random 128-bit as 32 lowercase hex characters (`CHECK` length and hex glob).
   Instants: UTC epoch seconds integers. Enumerations: `CHECK ... IN (...)`. Every text
   column: `CHECK (length(col) <= N)` where N comes from `shared\limits.ts`; a test parses
   the migration and fails if any text column lacks a `CHECK` or its number differs from
   the shared limit. Every parent: `UNIQUE (id, property_id)`; every child: composite
   foreign key `(parent_id, property_id)`. **First test, before anything relies on it:**
   in the workers pool, turn nothing on or off, insert a child pointing at another
   property's parent, and a text value one character too long, and an invalid
   enumeration; each must be rejected by D1. If D1 does not enforce them, **stop and
   tell you.**
3. **Tenant middleware and repositories** per `05` §4. A request context object carries
   `propertyId` and is the first parameter of every repository function; there is no
   overload without it. Property comes from the host lookup plus the §2 slug rule for
   public reads, from a verified session for guests (none yet), or from the staff path
   with a per-request role check (an injected resolver; Phase 1b supplies the real one,
   tests use a fake). Read side: activities, places, offers. Write side: `audit_log`
   (append) and `event_counts` (increment) only. Named projections `PublicActivity`,
   `PublicPlace`, `PublicOffer`, `PublicProperty`, `StaffActivity` list their fields
   explicitly; none returns `property_id`, owner ids or `is_placeholder` as anything but
   the public flag the band needs.
4. **Static rule.** A test (and an ESLint `no-restricted-syntax` rule for editor
   feedback) fails on `.prepare(`, `.exec(`, `.batch(`, `D1Database` use, or an `env.DB`
   reference outside `worker\repositories\`, with `seed\` and `tests\support\` allowed
   by name, and on `SELECT *` anywhere in `.ts`, `.sql` or `.tsx`.
5. **Isolation suite and anonymous-surface test** (§1, §2 tests included). For every
   exported repository function: act as property A, try B's rows by id. Read functions
   are attacked with read, list and by-id calls. Because Phase 1 has no activity, place
   or offer update/delete functions, "update and delete" are covered here by: the edit
   guards (§1), a test that `audit_log` and `event_counts` modules export no update or
   delete function, and the meta-test that fails when a later write function has no
   isolation test. I say so rather than inventing write functions to attack.
   Anonymous-surface test: every Hono route is enumerated from the app and called with
   no cookie; each response's field names (recursively) must be a subset of an allow-list
   kept next to the projections.
6. **i18n.** `shared\i18n\en.ts` and `fr.ts`; a typed `t(key)`; the rule in `05` §13 (the
   guest's language if present else English with a visible "English only" marker, never
   blank, never a key); build test fails if any key lacks French. The guest's language
   is read from the device store (try/catch around `localStorage`, a per-device
   convenience) and from `Accept-Language` for server messages. French strings are first
   drafts and are marked so; D-19 says a native Québécois review is still owed.
7. **Theme.** Tokens from `02` §1 as CSS custom properties; text/background pairs in
   `shared\tokens.ts`; `scripts\contrast.ts` prints the table of every pair with its
   WCAG ratio and fails the build under 4.5:1 (3:1 for large text). Expected from `02`
   row 13 `[V]`: dark `deep` on `trail` 5.82, on `ember` 5.91; `cream` on `deep` 13.44;
   `stone` on `deep` 5.18; `stone` on `timber` 4.58. `stone` on `ridge` is 3.94 and fails,
   so secondary text on the ridge surface will use a lighter value; coral is not used as
   text on dark surfaces. New values are computed, not guessed. DM Sans from
   `@fontsource/dm-sans` files copied into `web\public\fonts`, with the OFL text and a
   test that the built HTML and CSS name no external host.
8. **Shell.** Header (property name as text), four-tab `nav` with a tiny in-house router
   (History API, focus moved to the main heading on route change; no router dependency),
   What's On / Explore pages reading the API, Common Room and Connect showing "Not
   turned on for this property" until their `property_features` row is on. `Dialog`
   (role `dialog`, labelled, focus in, trapped, restored, Escape closes, scroll locked)
   and `Toast` (live region). Unit tests (jsdom) for focus entry, trap, Tab wrap,
   Escape, restore, backdrop click. States from `04` §5: loading, empty, error with
   retry, offline, "off for this property". The "Sample content" band for placeholder
   rows. Reduced-motion honoured; no particles.
9. **Seed.** `seed\demo-whistler.ts` built from the prototype's 10 activities and 24
   places: ratings dropped (D-17), invented guest names dropped, `is_placeholder = 1` on
   every row, verification fields empty, cafe spelled Cheaky's Cafe (D-14). Gatherings
   and signals are not seeded (Stage 2 and 3). Offers: none seeded (the prototype's
   "Save $20" and "$5.95" claims are unverified, `02` row 9); the offers pages show the
   empty state. The runner refuses to run unless the target is the local Wrangler state
   (checked against the local persist path and the absence of any remote flag), and a
   test proves it exits non-zero for a remote-looking target. If you say yes at §0 item
   6, two placeholder properties "Vancouver Downtown" and "Vancouver Jericho Beach" and
   three shared sample activities are added so the demo shows the hostel choice and the
   D-15 case; they carry the same placeholder marks.
10. **Preview gate.** `worker\preview-gate\` is a TypeScript copy of the Serendipty
    `packages\gate\index.js` (read, not imported): constant-time comparison via SHA-256
    digests, `hc_preview` cookie holding the hash, `HttpOnly; Secure; SameSite=Lax`, flat
    404, fail closed with no `ACCESS_KEY`, `/robots.txt` answered with Disallow. Changes:
    active only when `PREVIEW_GATE` is `"on"` (`wrangler.jsonc` vars: preview `"on"`,
    prod `"off"`); runs **first** in the Hono chain so it covers `/api/*`; on success the
    request continues into the app instead of calling `ASSETS` directly. Tests: gate on
    and no key: 404 on `/`, a static asset, `/api/...`, an unknown path; `/robots.txt`
    200 Disallow; correct key: 302 without `k`, cookie set, then 200; wrong key, forged
    cookie, other cookie name: 404; no `ACCESS_KEY` bound: 404; the key string is absent
    from every response body, from every `Location` after the first redirect, and from
    captured logs (the app logs request id, route template, status, duration only; the
    query string is never logged). Local tests use a made-up test key set in the test.
    `.dev.vars` is not created with a real key; `.dev.vars.example` has a placeholder.
    Note: the first request carries `?k=` in its URL, as in the original gate; that
    request is the one place the key appears and it is not logged.
11. **Read-only switch.** Middleware reads `platform_flags` `read_only` once per request
    with a 5-second in-isolate cache; when `on`, every `POST`, `PUT`, `PATCH`, `DELETE`
    returns 503 `{ "error": "read_only", "message": ... }` in the guest's language
    (`Accept-Language`, English fallback); reads unaffected. Tests: off; on blocks the
    one write route (`POST /api/p/<slug>/events`, the `event_counts` increment); on
    allows reads; cache window; French message.
12. **`npm run validate`:** typecheck, oxlint + ESLint, unit + isolation + static +
    contrast + i18n + migration tests, a bundle-size report (initial JavaScript gzip,
    compared to the 60 KB budget, fails above it), build, then Playwright with axe-core
    on the rendered shell at 360 px width (fails on serious or critical), and a keyboard
    walk (Tab through the four tabs, open and close the dialog). Any failure fails the
    script. I paste its raw output.

Other `05` §4 rules wired in: `Origin` and JSON content-type check on writes (rule 9),
security headers and the CSP in `05` §14 with exact values and a test, request logs with
no cookies or tokens (`05` §10).

### 4.4 Routes in Phase 1

| Route | Auth | Returns |
| --- | --- | --- |
| `GET /api/hosts/properties` (the picker; only for hosts with several rows) | none | `PublicPropertyChoice[]` of that host's list |
| `GET /api/p/:slug/config` | none | `PublicProperty` (name EN/FR, timezone, languages, feature on/off) |
| `GET /api/p/:slug/activities?day=` | none | `PublicActivity[]` |
| `GET /api/p/:slug/places` | none | `PublicPlace[]` |
| `GET /api/p/:slug/offers` | none | `PublicOffer[]` (empty until verified offers exist) |
| `POST /api/p/:slug/events` | none, Origin + JSON, read-only aware | 204; increments `event_counts` for an allow-listed event name |
| `GET /robots.txt` | none | Disallow |

If you choose Option 2 in §2, the same routes lose the `/p/:slug` segment.

## 5. Downloads and actions this plan needs (your GO covers them unless you strike one)

- `npm install` of the packages in §4.1 from the npm registry (creates `package.json`,
  `package-lock.json`, `node_modules\`; the lockfile is committed, `node_modules` is
  ignored). Registry `npm audit` output is reviewed and reported.
- `npx playwright install chromium`: a browser binary (about 150 to 200 MB `[I]`) from
  Playwright's download host, into the user cache outside the repository.
- Local only: `wrangler dev`/Vite dev server on `localhost`, local D1 state under
  `.wrangler\` (ignored). No `wrangler login`, `d1 create`, `deploy` or `secret put`.
- Git: commits only on a passing `npm run validate`. No push (the repository has a
  private remote now; I will not push without your word).

## 6. Risks and what happens if they bite

| Risk | If it happens |
| --- | --- |
| D1 does not enforce a foreign key or CHECK the design relies on | Stop, report the test output |
| The Cloudflare plugin cannot do something `05` assumes (assets with Worker first, local D1, SPA fallback) | Stop, report |
| Preact 11, its Vite preset or axe fails in a way that points at the framework | Stop, no framework change, no React. Moving to Svelte 5 would mean rewriting the shell, dialog and toast, about 8 KB more and 30 to 70 ms slower first content in the sandbox `[V]` (`05` §2.1); the cost then is days of rework on the pieces built so far, plus a new lint story (Svelte compiler instead of oxlint on JSX) |
| Preact 11 is three weeks old (G0 report §3) | Preact 10.29.8 is the fallback inside the same decision (D-12 says Preact, not which major); I would ask before using it |
| A pinned version (Vitest 4, TypeScript 6.0) is unavailable or breaks | Stop, report; no `--legacy-peer-deps` |
| Windows-specific failure (path length, Chromium, workerd) | Report with output; fix if local, otherwise ask |
| The staff role check cannot be fully tested without sign-in | Tested with an injected resolver; the real one is Phase 1b |

## 7. What this plan does not settle

- Real Downtown and Jericho content (Phase 3), staff sign-in (Phase 1b), guest sessions
  and QR entry (later stages), the production hostname (O-03), and whether HI Canada
  head office has agreed to the demo `[U]`.
- Lighthouse and a real phone (not gates for the demo, `G0` report §4).
- The French wording; a native review is owed (D-19).

## 8. Documents this build will touch

`02-STATE.md` (real layout), `03-DECISIONS.md` (D-13, the D-15 and D-21 outcomes),
`05-ARCHITECTURE.md` §4 and §16 (the added paragraph for A, the changed rule 1 for
Option 1, the final layout), `CLAUDE.md` Code rules (the matching line), and
`09-CONTENT-AND-ONBOARDING.md` §1 (the edit rule).
