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
re-verify it before HI Whistler goes live. The café at HI Whistler is **Cheekye's**
(spelling as stated by Martin, 2026-10-23).

## 4. In flight

The repository exists at `C:\Users\User\dev\hico`. The documents are in `docs\`,
`CLAUDE.md` is at the root, and the prototype is in `reference\hi-co-prototype.jsx`.
No application code exists, nothing is installed and nothing is deployed. Phase 0 is
complete except its preflight (step 2), the package's PowerShell run on Windows,
which has not been run. The next steps are that preflight and the framework spike in
`10-BUILD-PLAN.md`, Phase 0.2.

## 5. Stale documents

None yet; this is the first issue of the set.
