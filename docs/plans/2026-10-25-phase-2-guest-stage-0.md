# Plan — Phase 2: the Stage 0 guest app

Written 2026-10-25 by Claude Code. **Awaiting Martin's GO. Nothing in this plan is built yet.**

Scope is D-22: What's On, Explore, Settings and privacy, labelled QR links, French, offline, and the accessibility and
performance work, for Whistler and both Vancouver hostels. No guest data is stored on the server. D-17 (no numeric ratings)
and D-18 ("I'm In" saves to the guest's own plan on their device, no count) are in `03-DECISIONS.md` and apply.

"Seen in a demo" below means: someone at HI Canada's head office looking at the app on a phone would see it or its effect.
Sizes are rough, for choosing what to defer: **S** under half a day, **M** about a day, **L** two days or more.

## 0. Points for Martin (each has a recommendation; "accept as recommended" settles them)

1. **Lighthouse.** Item 10 needs Lighthouse mobile in the pipeline. That is a new dev dependency (`lighthouse`, Apache-2.0,
   pinned to an exact version), run against the built app with the Chromium Playwright already installs. *Recommended:* approve
   it, chosen and recorded in the build like D-13 and D-29. Alternative: measure with Playwright's own timing and report TBT and
   CLS only, with no Lighthouse score.
2. **Retention numbers for the purge job (item 5).** `06` §2 gives periods marked `[A]`. The purge job needs actual numbers
   for the rows that exist today: expired staff sessions, used or expired staff tokens and sign-in challenges, rate-limit
   counters (24 hours), revoked QR labels (30 days), audit rows (one year). *Recommended:* declare them once in
   `shared\retention.ts`, labelled assumed, and list them in O-23 as the CLAUDE.md rule requires. Nothing a guest sees depends
   on them in Stage 0.
3. **Where the missing-items list lives.** The prompt says to list an empty privacy contact in "the missing-items list", and no
   such file exists. *Recommended:* create `docs\13-MISSING-ITEMS.md`, one row per item a property still owes (privacy contact
   for each of the three properties on day one), and link it from `00-README.md`.
4. **Where a guest sees "my plan".** D-18 says "I'm In" saves to the guest's own plan; no document says where the plan is
   shown. *Recommended:* a "Show only my plan" toggle on What's On, plus a tick on each saved card; no new tab. Alternative:
   a separate "My plan" screen, which is more to build and one more tab.
5. **What "Delete my data" clears.** *Recommended:* every key this site wrote to the device's storage (language, text size,
   saved plan), the service worker's caches, and the service worker registration, then reloads in the property's default
   language, with a confirmation dialog first and a toast after. It cannot clear anything on the server, because the server
   holds nothing about the guest.
6. **The clock behind "Check at the desk".** The guest page compares the stamp with the phone's clock. A phone with a wrong
   clock would show a stale stamp as fresh or the reverse. *Recommended:* the page takes "now" from the server's `Date`
   header on the content response, falling back to the phone's clock offline. Costs a few lines; the test covers both.
7. **Four slices, each committed only when `npm run validate` passes** (§4). *Recommended.* Alternative: one commit at the end,
   which I advise against: this is the largest guest-facing change so far.

## 1. What already exists (Phase 1 and Phase 1b-2)

| Exists | Where | Note |
| --- | --- | --- |
| Shell: header with property name as text, four tabs, skip link, focus to the heading, Settings dialog with language | `web\src\App.tsx`, `Dialog.tsx` | No HI mark (D-21, D-25) |
| Hostel picker and `/p/<slug>/...` routes | `App.tsx`, `router.tsx` | D-24 |
| What's On v1: seven-day strip in the property's zone, cards, cancelled badge, recurrence, the stamp | `web\src\pages.tsx`, `time.ts` | No category filter, no "I'm In", no "changed" state yet |
| Explore v1: category pills, cards, staff pick label, note, walk time, hours, phone, stamp | `pages.tsx` | No search, no offers, no Maps link |
| Public API: config, activities, places, offers (hidden when expired or past the limit), events | `worker\app.ts` | Offers have an API but no screen |
| Check limits, one declaration | `shared\check-limits.ts` (D-33) | Tests at 89 and 91 days |
| Sample band when a property has placeholders | `App.tsx` | Every seeded activity and place is a placeholder |
| English and French catalogs with a "no key missing" build test | `shared\i18n\` | No "needs review" flag yet |
| Security headers (CSP, nosniff, Referrer-Policy, Permissions-Policy) | `worker\middleware\headers.ts` | `surface.test.ts` checks some; no test pins the exact values |
| Aggregate counter table and an increment-only repository | `worker\repositories\events.ts`, table `event_counts` | Events: `opened_*`, `offer_shown` only; no per-label QR count |
| Labelled QR links created in the console | staff console, table `entry_codes` | Labels only, no token (D-30 point 3) |
| Bundle budget in validate (guest 60 KB, staff 90 KB); contrast gate; axe in Playwright | `scripts\` , `tests\e2e\` | Budgets are assumed (O-23) |
| Staff console, all of Phase 1b-2 | `web\src\staff\` | Not touched by this phase |

**Does not exist:** a service worker, a manifest, a scheduled Worker (purge job), Lighthouse, the settings and privacy screen,
"I'm In", search, offers on screen, the QR landing behaviour, the French review flag, and the missing-items list.

## 2. The twelve items

| # | Item | Seen in a demo? | Size | What changes |
| --- | --- | --- | --- | --- |
| 1 | **What's On** | Seen | M | Add the category filter (five categories), "I'm In" (device-only plan, §0.4), a "changed" state if staff set one (the API has none today: I will read what a change is in `04` §4.1 and the schema and report, not invent a field), the stamp via `shared\check-limits.ts`. An activity shared by two hostels already reads the same at both (D-23); add a test at both hostels and nothing about transport (D-15). Keep the recurrence tests on Toronto (autumn) and Vancouver (spring); BC no longer changes clocks (O-19) |
| 2 | **Explore** | Seen | M | "Checked by staff on <date>" already has no name; add offers (terms, dates, hidden past the limit or after the end date), "Open in Maps" as a plain `https` link built from the staff address that loads nothing until tapped, search over place and activity text in the guest's language, "Staff pick" label kept, no rating anywhere (test) |
| 3 | **QR links** | Not seen (the guest sees an ordinary page; the count is in data) | M | New public route that counts `qr:<label>` for the property and day only when the label exists and is not retired; the page reads the fragment, calls it once, removes it with `history.replaceState`, sets no cookie, stores nothing. Social routes already answer "Not turned on for this property" |
| 4 | **Settings and privacy** | Seen | M | Every feature in `06` §1.1 listed, every switch off and disabled with "Not available at this property yet"; the privacy contact from the property (empty today for all three: show a visible placeholder and list it in the missing-items list, §0.3); the consent screen pattern of `06` §5 as a reusable component (five facts in order, "Not now" and "Turn on" the same weight, text version shown), not wired to anything; "Delete my data" (§0.5); language; "Add to home screen" instructions on request, no pop-up |
| 5 | **Retention purge job** | Not seen | M | A scheduled Worker (Cron Trigger) deleting expired rows per property; fake-clock test per row type that exists today (§0.2). Needs `triggers.crons` in `wrangler.jsonc`: a config change only, no deploy. `E-35` (cron can run it) is confirmed locally by a test; confirming it on Cloudflare is for the deploy phase |
| 6 | **Aggregate counters** | Not seen | S | Extend the allowed events (QR labels, a few screens); a test that the table has no column that could hold a session id, user agent or address, and that the increment path never reads either |
| 7 | **PWA and offline** | Seen only if the presenter turns the wifi off | L | Manifest, service worker (network-first with a timeout, then cache, for content; cache-first for the built assets), an offline state that says it is offline, no caching of any response with a session cookie or of `/api/staff`, never of social routes. `05` §12 says iOS may drop the cache: the app must work cold. Biggest risk in the phase (§5) |
| 8 | **Complete French** | Seen | M | Every guest string has French; a `needs review` list in the catalog, every string on it (D-19); a test fails if a string claims review without a named reviewer (none exists). I draft the French; a Québécois reader reviews it before any Quebec-facing use |
| 9 | **Accessibility** | Partly seen (focus, contrast, text size) | M | A dialog for every sheet (the Phase 1 component), emoji with text alternatives, reduced motion, 200% text zoom with no sideways scroll, live regions; axe at 360 px on every screen and state (including offline, empty, stale, Settings, the QR landing). Zero serious or critical |
| 10 | **Performance budget and Lighthouse** | Not seen | M | The bundle budget already fails the build; add Lighthouse mobile to the pipeline and print LCP, TBT (the INP proxy) and CLS (§0.1). The 60 KB, the 2.5 s, 200 ms and 0.1 figures are assumed or from the "good" Core Web Vitals thresholds `[I]`; I will print the numbers and not call anything "passed" against an assumption without saying so |
| 11 | **Security headers and content policy** | Not seen | S | Headers exist; pin the exact values in tests, add `connect-src` for the site's own `wss:` address only when a socket exists (none now), and add a test that no response (HTML, API, service worker, manifest) names a third-party host |
| 12 | **End-to-end tests at 360 px** | Not seen | M | First visit; a labelled QR link (count recorded, nothing stored: the test inspects cookies, storage, IndexedDB and Cache Storage); language switch; offline reload; delete my data |

## 3. Numbers this phase will add, and where they go (the CLAUDE.md rule)

No number that decides what a guest or staff member sees is written outside `shared\`, and each is labelled assumed there and
listed in O-23 before the phase ends:

- retention periods for the purge job (§0.2), in `shared\retention.ts`;
- the service worker's network timeout (proposed 3 seconds, assumed) and the cache lifetime of built assets, in
  `shared\offline.ts`;
- the search minimum length and result cap, if I add any (proposed: none; search filters the loaded list);
- the Lighthouse run count and the thresholds I print against (printed, not enforced, until Martin sets them).

Existing numbers stay in the O-23 list as they are.

## 4. Build order (four slices; each ends with `npm run validate` green and a commit; no push)

1. **Read screens: items 1 and 2**, with the clock source (§0.6), offers, search, Maps link, "I'm In" and the filter, and
   their French. Tests: filter, plan persistence in a throwing `localStorage`, shared activity at both hostels, no rating,
   89 and 91 days, search in French, Maps link loads nothing until tapped.
2. **Counting and housekeeping: items 3, 5, 6, 11.** QR route and landing; purge job and its tests; counter tests; header
   tests. Migration only if a column is needed (I expect none); any migration is announced first.
3. **Settings, privacy and French: items 4 and 8**, plus the missing-items list.
4. **Offline and quality: items 7, 9, 10, 12.** Service worker, accessibility pass over every screen and state, Lighthouse in
   `validate`, the end-to-end tests, the walkthrough at 360 px and by keyboard.

Then `02-STATE.md`, `03-DECISIONS.md` (new decisions, O-23 rows), the documents below, and the final report.

## 5. Risks

| Risk | If it happens |
| --- | --- |
| A service worker that caches the wrong thing shows a guest an old board, or caches a staff response | Network-first for content, an explicit allow-list of cacheable paths (nothing under `/api/staff`), tests that a response with a `Set-Cookie` or a session cookie is never stored, and a kill switch: the worker unregisters itself when a version file says so |
| iOS drops stored data between visits | The app works from cold with a network (a test with an empty cache) and says it is offline when it is |
| Lighthouse is slow or flaky in the pipeline | Run it once on the built app, three passes, take the median, print all three; it never fails the build on a score, only on the bundle budget |
| The French is a draft | Every string is on the needs-review list; the app does not claim review |
| "Changed" state has no field today | I report it and propose the smallest field (a `changed_note`, with limit and migration) instead of adding one; it needs your GO as a schema change |
| The 90-day limit hides most of the seeded board | Seeded rows have no stamp, so they show "Not checked yet. Ask at the desk." beside the Sample band; that is the intended honest state until staff check them |

## 6. Documents this phase will touch

`02-STATE.md`, `03-DECISIONS.md` (O-23 additions; the new decisions), `04-PRODUCT-SPEC.md` (§4.1 still cites O-14 where D-18
is now the decision; the "changed" state; the plan view), `05-ARCHITECTURE.md` (§10 events, §12 offline details, §14 exact
header values), `06-PRIVACY-AND-COMPLIANCE.md` (§2 retention rows as built), `09-CONTENT-AND-ONBOARDING.md` (the
missing-items list), `10-BUILD-PLAN.md` (Phase 2 status), `00-README.md` (the new file), and `CLAUDE.md` only if a rule changes.

## 7. What I will not do

Deploy, create remote resources, push, add a third-party script, font or request, put any HI mark in the app, invent content
(the seeded placeholders carry the Sample band), write an unlabelled number that decides what a guest sees, or mark any French
as reviewed. I stop and ask if a requirement conflicts with a document or needs a decision you have not made.
