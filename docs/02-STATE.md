# STATE — HI CO

**As of 2026-10-23.** Update at the end of every session that changes anything.
Labels: `[V]` verified by me (how and when), `[R]` reported by a supplied source
document, not re-checked, `[I]` inferred, `[A]` assumption, `[U]` unknown.

## 1. What exists

### The prototype
`[V]` read in full on 2026-10-23.

| Item | Value |
| --- | --- |
| File | `hi-co-prototype.jsx` (copy kept at `reference\hi-co-prototype.jsx`) |
| Size | 913 lines, 60,370 bytes |
| Default export | `HiCoApp` |
| Function components | 13: `Pill`, `SearchBar`, `Card`, `Toast`, `Particles`, `WhatsOnView`, `ExploreView`, `CommonRoomView`, `ConnectView`, `RadarView`, `CreateSignalSheet`, `Nav`, `HiCoApp` |
| Imports | `react` only. `useMemo` is imported and never used |
| Persistence | None. No `localStorage`, `sessionStorage`, `fetch`, or geolocation call. All state is in memory and resets on reload |
| Outbound requests | One: Google Fonts `@import` for DM Sans inside the CSS string |
| Header comments | "Transformed from LUME for hihostels.ca"; mock data "sourced from HI Whistler boards" |

Surfaces: **What's On**, **Explore**, **Common Room** (with a "Post a Gathering"
sheet), **Connect** (a Feed and a "Nearby" radar, plus a "Send a Signal" sheet).

Content counts `[V]`: 10 activities; 24 places (7 trails, 7 food, 4 drinks, 3
culture, 3 adventure; 11 marked staff pick; all 24 carry a numeric rating); 6
gatherings; 5 signals; 5 signal types (coffee, hike, food, explore, hang); 5
activity categories (Adventure, Social, Wellness, Culture, Outdoor); 5 explore
categories (Trails, Food, Drinks, Culture, Adventure).

Design tokens `[V]` ("Mountain Lodge"): `deep #121a21`, `timber #1a2530`,
`ridge #243040`, `stone #7a8e9e`, `cream #e8e0d6`, `white #f5f0ea`, `trail
#2ea872`, `trailDk #1e8a5a`, `ember #e07a4f`, `emberLt #f0a878`, `sky #5ba0d4`,
`gold #d4a83a`, `coral #cc3d3d`. Font DM Sans. Max width 480 px. Dark theme.

### The deployed prototype
`[V]` read from `C:\Users\User\dev\Serendipty` on 2026-10-23.

| Item | Value |
| --- | --- |
| Repo | `C:\Users\User\dev\Serendipty` (npm workspaces: `packages\*`, `apps\*`) |
| App | `apps\hico`, `src\App.jsx` is byte-identical to `hi-co-prototype.jsx` |
| Worker | `hico`, live at `https://hico.these3remain.workers.dev` (share link needs the key, held out of band; never write it in a document) |
| Cookie | `hc_session` |
| Assets | `not_found_handling: single-page-application`, `run_worker_first: ["/*"]`, `compatibility_date 2026-08-07` |
| Bundle | `dist\assets\index-l_thFI2C.js`: 234,091 bytes raw, **71,209 bytes gzip-9** (measured 2026-10-23) |
| Toolchain | `react`/`react-dom ^19.2.8`, `vite ^8.2.1`, `@vitejs/plugin-react ^6.0.5`, root `wrangler ^4.120.0` |
| Local state | `.dev.vars` present per app (gitignored); `dist/` and `.wrangler/` present |

The gate (`packages\gate\index.js`, `@serendipty/gate` 1.0.0) `[V]`: `?k=` compared in
constant time against `env.ACCESS_KEY`; a valid key sets an HttpOnly, Secure,
SameSite=Lax cookie holding the SHA-256 of the key (30 days) and 302s to the same
path without `k`; anything else gets a flat 404; a Worker with no `ACCESS_KEY`
serves nothing; `/robots.txt` is answered ahead of the gate; security headers set
(`X-Robots-Tag`, `Referrer-Policy: no-referrer`, `nosniff`, `X-Frame-Options:
DENY`, `Cache-Control: private, no-store` on assets). It hands authorised requests
to `env.ASSETS.fetch`, so it fronts static assets only and has no hook for an API.

### The original LUME repository
`[V]` cloned into the sandbox on 2026-10-23 from
`github.com/MartinMontero/LUME-App-Version-VSW-`, HEAD `3b0e995` (2026-08-25,
"Record SB-2: the zone injects a beacon the policy disclaims").

- Stack: React 18.3.1, TypeScript, Vite 5, Tailwind 3, `@supabase/supabase-js`,
  `chart.js`, `lucide-react`.
- Seven migrations and a `supabase\verify` script. 125 `it`/`test` calls in 15 test
  files (static count; the suite was not run).
- Deployed as an assets-only Worker `lume-city` with a custom domain
  (`lume.builderworkshop.ca`).
- Supabase project `lume-city`: region `ca-central-1`, status `ACTIVE_HEALTHY`
  `[V]` via the Supabase tool on 2026-10-23.
- Its `SECURITY.md` documents SB-1 (anonymous read of `gatherings` including
  `organizer_id`) and SB-2 (the zone injects a Cloudflare analytics beacon that the
  privacy policy disclaims; the CSP is accidentally blocking it). `SEC-10` and
  `SEC-11`, referred to in earlier project notes, do not appear in this repository
  `[V]` by search.
- `C:\Users\User\dev\LUME App` is an empty folder `[V]`.
- **HI CO shares no code with this repository.** HI CO is a single-file artifact
  that borrowed LUME's concept (signals, gatherings) and was restyled. What carries
  over is the security thinking, not the code. See `05-ARCHITECTURE.md` §6.

### Not seen
- The physical boards the content was transcribed from.
- The Serendipty git history.

## 2. Known simplified, fabricated or wrong in the prototype

Every row is a production blocker unless marked otherwise. Line numbers are in
`hi-co-prototype.jsx` `[V]`.

| # | What | Where | Production consequence |
| --- | --- | --- | --- |
| 1 | The radar draws each person at `Math.random()` distance and angle | 736 | It shows fake proximity. It is also redrawn with new random positions every second, because the parent ticks `signals` every 1,000 ms (606–608) and the draw effect depends on `[signals]` (748) |
| 2 | Signal cards show a dorm name ("Dorm 3") | 124–128, 661 | Dorm-level presence reveals where a person sleeps. Must not exist in production |
| 3 | Signal countdown decrements on the client | 606–608 | Expiry must be a server timestamp. A backgrounded tab drifts |
| 4 | "Today" and the day selector use the device clock | 260, 284 | Must use the property's timezone. A traveller's phone may still be on another timezone |
| 5 | RSVP counts, "taken" counts and joined state are local | 262–276, 479–489 | No persistence, no shared count, no capacity enforcement |
| 6 | "Heading over — they'll know you're coming" | 614 | Promises a notification that does not exist. Replying reveals the responder to the sender, so it needs consent |
| 7 | Post a Gathering has no moderation, no adult check, no rate limit | 493–500 | Open to abuse and to minors meeting strangers |
| 8 | All 24 places carry a star rating with no stated source | PLACES | No provenance. Treat as placeholders. Do not copy ratings from a third-party service without checking its terms |
| 9 | Time-sensitive claims with no verification date: phone number for a bungee operator, "Save $20 with HI membership", a bakery's opening days and hours, "everything on the menu is $5.95" | 107–108, 94, 90 | Need `verified_on`, `verified_by` and an expiry |
| 10 | Guest names ("Lisa K.", "Marco P.") in signals and gatherings | 114–128 | Invented people. Production uses guest-chosen display names |
| 11 | Zero `role` or `aria-*` attributes in 913 lines. Sheets are plain `div`s with an overlay click; no focus trap, no Escape, no `role="dialog"` | 564, 770 | Fails WCAG 2.1 AA |
| 12 | 18 text styles below 12 px (nine at 11 px, seven at 10 px, two at 9 px) | throughout | Too small for phone reading |
| 13 | White text on the primary green button measures **2.66:1** (`#f5f0ea` on `#2ea872`); on the signal button (`#f5f0ea` on `#e07a4f`) **2.62:1**. AA needs 4.5:1 for normal text, 3:1 for large | 354, 696, 797 | Fails AA. Also fail for normal text: `stone` on `ridge` 3.94:1, `coral` on `deep` 3.60:1, `coral` on `timber` 3.18:1, white on `coral` 4.31:1. Pass: `stone` on `deep` 5.18:1, `stone` on `timber` 4.58:1, `trail` on `deep` 5.82:1, `ember` on `deep` 5.91:1, `cream` on `deep` 13.44:1. Dark text (`deep`) on the green and ember buttons gives 5.82:1 and 5.91:1. Computed 2026-10-23 with the WCAG relative-luminance formula |
| 14 | Emoji carry meaning (category and signal types) with no text alternative | throughout | Needs accessible names |
| 15 | English only. Header text is hard-coded to "HI Whistler" | 898 | Needs i18n and tenant config |
| 16 | The floating particles regenerate a random `@keyframes` on every render | 235–251 | Minor. Decorative motion needs a reduced-motion switch regardless |
| 17 | No loading, empty-error or offline states | throughout | Hostel wifi is poor `[A]`; read paths must work offline |
| 18 | The brand mark is an original mountain glyph | Nav | `[U]` whether HI Canada permits use of its marks. Ask before launch |

## 3. Content provenance

The prototype content is HI Whistler's board content as transcribed by the prototype
author `[I]` from the file's own header comment; I have not seen the boards. HI
Vancouver Downtown, the first tenant, **has no content yet**. Treat the whole
prototype dataset as placeholder for any property other than HI Whistler, and
re-verify it before HI Whistler goes live. The café at HI Whistler is **Cheaky's Cafe**
(D-14, stated by Martin, 2026-10-23; the prototype spells it Cheekye's).


## 4. In flight

### The application (Phase 1, built 2026-10-23)

`[V]` by `npm run validate`, raw output in `docs\spikes\phase-1-validate-output.txt`: it
passes. This is the multi-tenant foundation only (D-22 Phase 1): no guest features, no
staff sign-in (Phase 1b), nothing deployed, no remote resource, no secret, and no Wrangler
command that contacts Cloudflare was run. Decisions called at GO: D-23 (activity ownership
and the offered-at list), D-24 (`/p/<slug>` checked against the host's own list), D-25
(no "HI" in displayed names, text-only header, two extra seeded hostels). D-13 (Valibot) was
chosen in the build and recorded.

Layout as built (replaces the proposal in `05` §16):

```text
hico\
  package.json  package-lock.json  tsconfig*.json  eslint.config.js  vite.config.ts
  vitest.config.ts  playwright.config.ts  wrangler.jsonc  env.d.ts  index.html
  .dev.vars.example (copy to .dev.vars, gitignored)  .claude\launch.json (dev server)
  worker\            index.ts, app.ts (Hono), tenant.ts, ids.ts, projections.ts,
                     middleware\ (tenant, guards, headers), preview-gate\, repositories\
  web\src\           App.tsx, router.tsx, pages.tsx, Dialog.tsx, context.tsx, api.ts, time.ts,
                     load.ts, styles\ (tokens.css is generated from shared\tokens.ts)
  shared\            limits.ts, schemas.ts (Valibot), types.ts, tokens.ts, contrast.ts, i18n\
  migrations\        0001_foundation.sql (15 tables)
  seed\              data.ts, run.ts (local D1 only), guard.ts
  scripts\           validate.ts, typecheck.ts, lint.ts, contrast.ts, bundle-size.ts,
                     check-names.ts, names.ts
  public\fonts\      DM Sans 400/500/700 woff2 and the OFL licence text
  tests\             worker\ (workerd + local D1), node\, web\ (jsdom), e2e\ (Playwright)
```

What it does `[V]`:

- **Stack on this machine.** The Cloudflare Vite plugin 1.65.0 runs the Hono Worker, the
  static assets (SPA fallback, Worker first) and a local D1 binding with Preact 11.0.2 on
  Vite 8.3.5, in `vite dev`, `vite build` and `vite preview`. Vitest 4.1.12 runs in
  workerd against a real local D1. Playwright 1.64.1 runs Chromium (headless shell 156)
  on Windows. Nothing failed in a way that points at Preact. Two version facts: Vitest must
  stay on 4.x or 5.x for the Workers test plugin, and the plugin is now
  `@cloudflare/vitest-plugin` (the old `@cloudflare/vitest-pool-workers` is deprecated and
  was not used); TypeScript is pinned to 6.0.3 for typescript-eslint.
- **D1 enforces what the design relies on** (`tests\worker\d1-enforcement.test.ts`):
  composite foreign keys (including the offered-at owner link and exception rows),
  length and enumeration CHECKs, id format, missing parents.
- **Tenancy.** The property comes from the hostname list plus the `/p/<slug>` rule, or
  from a per-request staff role lookup; never from the body, query, a client header or an
  id. Repository functions take the request context first; static tests forbid raw
  database access, `SELECT *`, building a context, and third-party hosts outside the
  allowed files. 151 tests; the isolation suite covers every exported repository
  function and a meta-test fails otherwise. Three deliberate mutations (a dropped
  property filter, a dropped offered-at join, a skipped host-list check) each failed
  tests, then were reverted.
- **Surface.** Every route is called with no cookie and its field names compared to an
  allow-list; forbidden names never appear. Exact CSP and companion headers on every
  response. Preview gate copied from Serendipty into `worker\preview-gate\`, covering
  `/api/*`, with the key never in a body, header or log line. Global read-only switch (503,
  guest's language, 5-second cache).
- **Front end.** Four tabs with routing, property name as text, "Sample content" band,
  accessible Dialog and Toast, English and French (French strings are first drafts, D-19),
  DM Sans self-hosted, 21 contrast pairs all above their minimum (table in the validate
  output). Initial JavaScript 12.45 KB gzip against the 60 KB budget.
- **Seed.** `npm run db:seed` writes the local D1: Whistler (10 activities, 24 places),
  Vancouver Downtown and Jericho Beach with 3 shared sample activities. Ratings, guest
  names, dorm names and unverified claims are left out; every row is a placeholder.
- **Browser checks** at 360 px: axe-core finds no serious or critical violation on any
  tab, the dialog, the French shell or the not-found page; no sideways scroll, also at
  200% text size; a keyboard-only walk through the skip link, tabs, heading focus, the
  Settings dialog (focus in, Tab trapped, Escape closes, focus returns). Axe found one
  real fault (day buttons whose accessible name did not contain their visible text) and
  the keyboard test found one (focus was not returned to the Settings button because the
  page behind is made inert in the same render that opens the dialog); both are fixed.

What is not done or not verified `[U]`:

- Staff sign-in (O-02, Phase 1b); the staff routes exist and answer 401 until a resolver is
  supplied. No activity, place or offer write functions exist yet, so "update and delete
  another property's rows" is covered by the edit guards and the meta-test, not by
  attacks on write functions.
- A real phone, Lighthouse, a screen reader, and the French wording.
- `npm audit`: 0 vulnerabilities in the production dependencies (hono, preact, valibot);
  6 (3 moderate, 3 high) in the Cloudflare tooling that is installed for development only
  (wrangler, miniflare, undici, sharp, zod inside them). The advisories name the tools, not
  the deployed Worker; `npm audit fix --force` would downgrade the Workers test plugin, so
  it was not run.
- `wrangler login` and every remote command: none run, Wrangler's login is still unchecked.
- A built `dist\hico_preview\` contains a copy of `.dev.vars` (the plugin copies it).
  Locally it holds only `PREVIEW_GATE=off`, but it must never hold a key, and `.dev.vars`
  must be absent or gate-on before any deploy of that folder.
- The workers.dev address of the preview is unknown until the first deploy, so
  `property_hosts` has only `localhost` and `127.0.0.1`; the deploy phase adds the real host.

Time-zone fact found while testing `[V]` on this machine: the runtime's time-zone data
(Node ICU, tzdata 2026b) has America/Vancouver on UTC-7 all year after 8 March 2026, with
no autumn change on 1 November, while Toronto, Edmonton, Los Angeles and Paris still fall
back. The code uses the IANA zone and never an assumed offset, so it follows whichever data
the device has; phones with older data may disagree for part of the year. See O-19.

The Windows preflight has run four times (`docs\spikes\preflight.md`,
`preflight-desktop.md`, `preflight-pwsh7.md`, `preflight-rerun.md`): Windows PowerShell 5.1,
then PowerShell 7.6.8 and Wrangler 4.152.0 installed with Martin's approval (D-16).
Wrangler has only been run with `--version`.

Gate G0 is closed by waiver (D-12); the open measures in `docs\spikes\G0-framework-report.md`
§4 are exercised here: the plugin works with Preact (measure 6) and axe finds no serious or
critical violation on the shell (measure 3).

Phase 1b-1 (the staff sign-in spike) ran on 2026-10-24 with Martin's GO. The report is
`docs\spikes\staff-auth-report.md`; the throwaway code and run output are in `spike\auth\` (own
`package.json`, never imported by shipped code, a test enforces that). `[V]`: our own WebAuthn with
SimpleWebAuthn 14 passes 14 of 14 browser tests under Chromium's virtual authenticator; Better Auth
1.7.12 with its passkey plugin passes 11 of 11 on workerd with local D1; the Worker half of Cloudflare
Access passes 2 of 2 against a local stand-in. Cloudflare Access itself could not be tested. Nothing was
sent, no account or remote resource was created, and the report recommends a route without deciding.
**Martin called O-02 on 2026-10-24: D-26, our own WebAuthn, passkey-first.** O-20 and O-21 were
accepted as recommended (D-27, D-28). `npm run validate` still passes (153 tests, raw output in
`docs\spikes\phase-1b-1-validate-output.txt`). Phase 1b-2 (staff authentication and console) is **in progress with Martin's GO of 2026-10-24**, built in four
slices, each committed only when `npm run validate` passes. Plan: `docs\plans\2026-10-24-phase-1b-2-staff-console.md`.
- **Slice 1 (auth and schema), done:** migration `0002` (passkeys, sessions, links, challenges, rate limits, a
  `version` column for optimistic concurrency); staff sign-in, sessions, passkeys, admin-issued invite and
  recovery links, person-level audit written per property (D-27), rate limits, the people routes with the
  role matrix; the staff screens (sign-in, accept link, home, my account) as a lazily loaded chunk of 8 KB gzip
  that guests never download; `scripts\operator.ts` with `invite-first-admin` and `issue-recovery-link`
  (local only for now). SimpleWebAuthn 14 is now a root dependency (D-26).
- **Slices 2 to 4 (content write API, console screens, operator scripts and finish): not started.**
## 5. Stale documents

- `docs\05-ARCHITECTURE.md` §16 shows the proposed layout; the real one is above. §13 says
  tests cover both daylight-saving changes; in this runtime BC has only the spring one
  (O-19).
- `docs\09-CONTENT-AND-ONBOARDING.md` §1 now carries the activity edit rule.
- `docs\10-BUILD-PLAN.md` Phase 1 lists tasks that are now done.
- `docs\01-project-instructions.md` line 70 and `docs\11-DEPLOY.md`'s status paragraph still
  describe the shell tools as they were before D-16 and the preflight runs.
- `docs\spikes\preflight.md` says PowerShell 7 and Wrangler are not installed; true when
  written, no longer true. It is a dated record and is left as written.