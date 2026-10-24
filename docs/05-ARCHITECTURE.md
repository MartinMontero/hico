# ARCHITECTURE — HI CO

How HI CO is built and why. Labels: `[V]` `[R]` `[I]` `[A]` `[U]` as in `00-README.md`.
Decisions that are still yours are in `03-DECISIONS.md`; this file says what each
one would change here.

## 1. Shape

```text
Phone (installed PWA or browser tab)
   │  HTTPS
   ▼
One Cloudflare Worker per environment (hico-preview, hico-prod)
   ├─ serves the built front end as static assets
   ├─ API (Hono) under /api/*  ── tenant middleware ── repositories ──► D1 (system of record)
   └─ PropertyRoom Durable Object, one per property  [built only in Stage 3]
```

- D1 is the system of record. Durable Objects hold only short-lived live state
  (Stage 3) and can be rebuilt from D1.
- Tenants share one Worker and one D1 database, separated in application code. A
  database per property is possible later; it is more operational weight than a
  single-digit number of properties justifies `[A]`.
- Until Stage 3, no Durable Object exists. Polling is adequate at one hostel's scale
  `[I]`; the room object is added when signals need to feel live.
- Nothing runs on Martin's or HI Canada's own servers.

## 2. Framework decision and gate G0

Martin's instruction (2026-10-23): explore alternatives to React; use one of equal or
greater quality and performance if one exists. Quality and performance have several
parts. Bundle size, load time and the cost of updating a screen were measured in a
sandbox (§2.1). Lighthouse, accessibility checks on the running page, developer
experience and compatibility with the Cloudflare Vite plugin were not; gate G0 (§2.4)
measures those, and repeats the load and update measurements, on your machine.

### 2.1 What was measured, and what it showed

**Method** `[V]` 2026-10-23. One screen was built the same way in four frameworks:
four tabs, a seven-day strip, five filter pills, a list of activity cards filtered by
day and category, and a join toggle that keeps a set of joined activities. Each card has
a title, a line of text, a progress bar and a button. Every build is Vite 8.3.5's default
production build; sizes are gzip level 9 (Brotli was not available in the sandbox).

The page was then loaded 396 times: 4 frameworks, 3 list sizes, 3 CPU speeds, 11 runs
each. Each run used a fresh headless Chromium 153.0.8010.12 driven by Playwright
1.63.0, with the browser cache off and the files served gzip-compressed from the same
machine. The CPU speeds are 1× (no slowdown), 4× and 6×, set with Chrome's CPU
throttling control. The list sizes are 40 activities in the data set (6 cards shown for
the selected day), 280 (40 shown) and 1,400 (200 shown). In each round the order of the
frameworks was shuffled. In every run the card counts and the join-button text were what
they should be.

What each measure is. *First content rendered*: time from the start of navigation until
the first activity card is in the page. *Script time* and *main-thread time during
load*: how much of that period the browser spent running JavaScript, and how much it was
busy in total. *Blocking time*: how far each stretch of work longer than 50 ms ran past
50 ms, added up; it is how long the page could not respond to a tap. *Update cost*: the
average time, per tap, for the framework's work plus the browser's layout after a day,
category or join tap, over a burst of 50 to 70 taps.

**What this cannot tell you.**
- It is one sandbox with two virtual CPUs, not a phone and not Windows. CPU throttling
  multiplies the cost of work on this machine. The sandbox ran a 30-million-step loop in
  about 80 ms, and there was no phone to compare it with, so read the ratios between
  frameworks, not the milliseconds, as the result.
- The screens are plain markup with no CSS, images or fonts, and no service worker or API
  call. A styled screen adds browser work that is the same in every framework, so the
  differences below shrink in relative terms on a real page; the gaps in milliseconds are
  what a real page would also carry `[I]`.
- There is no simulated network and no Lighthouse run. One author wrote all four screens
  in each framework's usual style; a different author might get different numbers.
- Differences from React are marked "n.s." when they could be chance (Mann–Whitney test,
  p at or above 0.01). No allowance was made for the 216 comparisons made, so at that
  threshold about two "significant" labels would be expected by chance alone.

The code, raw results and the full tables are in `hico-framework-benchmark.zip`, which
is separate from this package.

**Sizes** (one screen, the build that was benchmarked; gzip level 9):

| Framework (version) | Build plugin | Raw bytes | Gzip bytes |
| --- | --- | ---: | ---: |
| React 19.3.1 | plugin-react 6.1.2 | 220,891 | 68,242 |
| Preact 11.0.2 | preset-vite 2.10.6 | 15,112 | 6,404 |
| Svelte 5.57.2 | vite-plugin-svelte 7.3.1 | 36,131 | 14,054 |
| solid-js 1.9.17 | vite-plugin-solid 2.11.14 | 14,210 | 5,790 |

The deployed prototype's bundle is 234,091 bytes raw and 71,209 gzip `[V]`. Vue, Qwik
and Lit were not measured. Solid 2.0 is at release candidate 18 on npm; the stable
version is 1.9.17 `[V]`.

**Load and update at 4× CPU slowdown, 40 activities (6 cards shown).** Median of 11
runs; the percentage is the change against React, shown only where the difference is
significant (not "n.s.").

| | React 19 | Preact 11 | Svelte 5 | Solid 1.9 |
| --- | ---: | ---: | ---: | ---: |
| First content rendered, ms | 299 | 135 (−55%) | 192 (−36%) | 143 (−52%) |
| Script time during load, ms | 176 | 30 (−83%) | 67 (−62%) | 34 (−81%) |
| Main-thread time during load, ms | 502 | 355 (−29%) | 419 (−17%) | 364 (−28%) |
| Blocking time during load, ms | 92 | 25 (−73%) | 54 (−41%) | 21 (−77%) |
| Day switch, update cost, ms | 8.1 | 6.4 | 7.8 | 5.8 (−29%) |
| Join toggle, update cost, ms | 2.4 | 2.2 | 1.7 | 1.1 (−53%) |

**Reading the results.**
- **Load.** At every CPU speed and list size, the three alternatives reached first
  content 34% to 57% earlier than React, and every one of those comparisons is
  significant. At 6× with 6 cards, first content took 459 ms in React, 200 in Preact, 264
  in Svelte and 197 in Solid. Preact and Solid are the two fastest, within 16 ms of each
  other in every cell (they were not tested against each other). Svelte is about 30 to
  70 ms behind them at 4× and 6×, because its JavaScript time during load is about
  twice theirs; it is still well ahead of React.
- **The browser sets the floor.** Main-thread time during load is 9% to 35% lower than
  React's for the alternatives, a smaller gap than the script time, because parsing,
  styling, layout and painting take most of the time whichever framework builds the page.
- **Updates do not separate the frameworks.** With 6 cards, a day switch costs about 1 ms
  at 1×, 6 to 8 ms at 4× and 12 to 14 ms at 6× in all four. Solid is lowest, and its
  difference from React is significant at 1× and 4× only. The join toggle is where a
  framework stands out: Svelte is cheaper than React in several cells (−46% at 1× with
  200 cards, −25% at 6× with 200 cards, both significant), but the join toggle costs
  about 25 ms at most in any cell, so this does not change the choice.
- **List length matters more than the framework.** With 200 cards shown, a day switch
  costs 83 to 92 ms at 4× and 134 to 143 ms at 6× in all four, within about 10% of
  each other. Blocking time while loading 200 cards at 4× was no lower than React's
  (React 119 ms; Preact 154, Svelte 168, Solid 136; none significant). No framework
  fixes a very long list; paging or windowing does `[I]`. A day with hundreds of cards
  would leave little or no room in the 100 ms budget in `04` §4.1 at that slowdown,
  whichever framework is used `[I]`.
- **Memory** is about 2 MB of JavaScript heap in all four; React uses up to 0.4 MB more.
  It does not affect the choice.
- **Transfer** for the page, script and styles at 40 activities, gzip, measured by the
  browser: React 68,877 bytes, Preact 6,994, Svelte 14,661, Solid 6,348.
- **Tap-to-next-frame**, the measure first proposed for G0, did not work: with 6 cards,
  all four frameworks measured a median of 33 ms at every CPU speed, which is two frames
  at 60 Hz. G0 uses update cost instead (§2.4).

**Accessibility tooling check** `[V]` 2026-10-23. The aim was to test the claim that
Svelte's compiler gives accessibility warnings the others lack. A test file with nine
deliberate defects was run through Svelte 5.57.2's compiler (as `.svelte`), and the same
defects written as JSX were run through eslint-plugin-jsx-a11y 6.10.2 (its recommended
rules) on ESLint 9.39.5 and on ESLint 10.13.0, and through oxlint 1.89.0 with its
jsx-a11y rules. The defects: a clickable `div` with no keyboard handler; an image with no
alt text; a link to `#`; an invalid `aria-pressed` value; a text input with no label; a
`span` with `role="button"` and no handler; a positive `tabindex`; a label with no
control; a video with no captions.

| Tool | Defects flagged (of 9) | Not flagged |
| --- | --- | --- |
| Svelte compiler | 7 | Unlabelled input; `span` with `role="button"` |
| jsx-a11y (ESLint 9 and 10) | 7 | Same two |
| oxlint | 8 | Unlabelled input |

The same markup written correctly produced no warnings in any of them. So the compiler
has no coverage advantage over the lint rules on this test. Two further facts. A lint
rule cannot see that an input has no label; axe-core, which checks the running page,
has a rule for it `[I]`, so axe stays in G0 and in CI. And eslint-plugin-jsx-a11y 6.10.2,
the latest version, was published on 2024-10-26 with an ESLint range that ends at 9
`[V]` npm. ESLint 9 now carries an npm "no longer supported" notice. Installing the
plugin beside ESLint 10 fails with a dependency conflict unless the peer check is turned
off (`--legacy-peer-deps`) `[V]`, though it ran correctly on ESLint 10.13.0 once
installed. oxlint carries its own copy of the rules, which avoids that dependency. Solid
was not tested; its JSX uses `class` and `for` where the rules expect `className` and
`htmlFor` `[U]`.

### 2.2 Candidates and honest trade-offs

| | Preact 11 | Svelte 5 | Solid | React 19 |
| --- | --- | --- | --- | --- |
| Cost to move the prototype | Near-copy: React-style code `[I]` | Rewrite (13 components) | Rewrite | Near-copy |
| First content, 4×, 6 cards | 135 ms | 192 ms | 143 ms | 299 ms |
| Gzip bytes, one screen | 6,404 | 14,054 | 5,790 | 68,242 |
| Accessibility checks at build time | Lint rules: 7 or 8 of 9 test defects `[V]` | Compiler: 7 of 9 `[V]` | Lint, not tested with Solid's attribute names `[U]` | Same as Preact |
| Library ecosystem | React-compatible layer, not tested here | Smaller | Smaller | Largest |
| How much Claude Code has seen | A lot (React-style) `[I]` | Less (runes are new) `[I]` | Less `[I]` | Most |
| Governance | Open source; the repository page names no foundation or corporate owner and shows OpenCollective funding `[R]` | Open source | Open source | Open source, under the React Foundation (Linux Foundation, launched 2026-02-24); Meta is one of eight founding platinum members `[V]` |
| Current major version | 11.0.0 released 2026-09-30; 11.0.2 released 2026-10-23 `[V]` npm | 5.0.0 released 2024-10-19 `[V]` npm | 1.9; 2.0 is at release candidate 18 `[V]` npm | 19.0.0 released 2024-12-05 `[V]` npm |

React and Meta: your vendor exclusion list names Meta. React began at Meta and is now
governed by the React Foundation, where Meta is one of eight founding platinum members
`[V]`. Whether that brings React under the exclusion is your call (O-16). If it does,
React remains in the spike only as the baseline. Preact is a separate project that
implements React's programming interface, and the page I read does not connect it to
Meta `[R]`; whether that suffices is part of O-16. D-12 resolves O-16: React is the
measuring baseline only, and Preact was chosen.

### 2.3 Recommendation (not a decision)

Martin adopted this recommendation as D-12 on 2026-10-23.

**Preact 11 as a Vite single-page app, with a Hono Worker behind it.** In the sandbox
it and Solid were the two fastest to load at every CPU speed and list size, within
16 ms of each other, at 6.4 KB gzip, and its update cost matched the others. It is also
the cheapest move, because the prototype is React-style code and Preact runs that style
with few changes `[I]`. Its accessibility lint covered the same ground as Svelte's
compiler on the test file.

**The strongest argument against Preact.** Its current major version is three weeks
old, and the patch release that was benchmarked was published the day of the test `[V]`.
A new major can still have faults that a two-year-old one has lost. Preact 10.29.8
(2026-08-01) is the older line; it was not measured, and whether the prototype's
patterns behave the same on it is `[U]`. Preact also keeps the project in React's
programming model, so a decision to exclude React on governance grounds (O-16) is only
half observed. Its compatibility layer was not tested; a library that depends on React
internals can fail on it.

**Svelte 5 is the alternative.** It costs a rewrite of 13 components, 8 KB more, and
about 30 to 70 ms of first-content time at 4× and 6×. In return it has a major version
two years old, accessibility warnings that arrive with every build without choosing and
maintaining a lint plugin, and a cheaper join toggle in several cells. The strongest
argument against Svelte: the rewrite, and that Claude Code is more likely to write
older Svelte syntax than runes `[I]`, so more correction rounds in G0.

**Solid** is not recommended. It matches Preact on speed but needs a rewrite, has the
smallest ecosystem here, and has no stable 2.0 `[V]`.

SvelteKit is not recommended for any of them: the app sits behind a QR code, needs no
server-side rendering, and one fewer layer is one fewer thing to upgrade `[I]`. The
static shell can still be pre-rendered at build time.

The sandbox settles load speed and update cost to the extent §2.1 allows. It does not
settle the real app's size, a real phone, Lighthouse, developer experience or the
Cloudflare plugin. That is why G0 exists.

### 2.4 Gate G0 — the spike decides

**Status: waived on 2026-10-23 (D-12). The spike was not run.** What the sandbox
benchmark did and did not cover, measure by measure, is in
`docs\spikes\G0-framework-report.md`. The rule below is kept as written.

No application code is written until G0 closes. The spike (`10` Phase 0.2) builds
What's On in Preact, Svelte 5 and Solid, and ports the prototype's version as the
React baseline. It starts from the benchmark pack where that helps, and it records:

1. Gzip size of all JavaScript and CSS for the screen, from the production build.
2. Lighthouse mobile run, median of five.
3. axe-core violations on the rendered screen, and the compiler or lint findings for
   the same code.
4. Load and update cost as in §2.1, on your machine: first content rendered, script time
   and blocking time during load, and update cost per tap for day switch, category
   filter and join, at four times CPU slowdown, median of 11 runs, with 40 and 280
   activities in the data. Tap-to-next-frame is not used (§2.1).
5. Developer experience: how many correction rounds Claude Code needed, whether tests
   and type-checking passed first time, what the compiler or linter warned about.
6. Whether the Cloudflare Vite plugin runs the Worker, assets and a local D1 binding
   with that framework.

A framework **qualifies** if it is no larger than React on (1), no worse than React
on (2) and (4) (a timing difference under 10% counts as equal, because laptop
measurements are noisy), has no more serious axe violations on (3), and works on (6). If more than
one qualifies, the report recommends one with reasons and Martin decides (D-12 is
recorded then). If none qualifies, the report says so and comes back to Martin before any framework is
used; React is a measuring baseline only (D-12).

### 2.5 Everything else in the stack

| Part | Choice | Status |
| --- | --- | --- |
| Language | TypeScript, strict | `[A]` |
| Build | Vite with the Cloudflare Vite plugin: front end and Worker in one project, with Durable Objects, D1 and static assets. v1.0 went GA on 2025-04-08, with Hono among the supported frameworks | `[V]` Cloudflare blog; current version to be checked in Phase 1 |
| API | Hono on the Worker | `[I]`; check current version and Workers support in Phase 1 |
| Validation | One schema library shared by browser and Worker, with every length limit declared once | `[A]`; chosen in Phase 1 and recorded |
| Tests | Vitest for units and API tests against local D1; Playwright for end-to-end and axe | `[V]` 2026-10-23: they run on this Windows machine (Vitest 4.1.12 in workerd, Playwright 1.64.1 with Chromium); see `02` §4 |
| PWA | Web app manifest plus a service worker | `[A]`; see §12 |
| Fonts | DM Sans, self-hosted. No Google Fonts request in production | `[A]`; the prototype loads it from Google |

## 3. Option A against Option B

Martin chose Option B (D-05). The trade-offs are kept here so the decision can be
revisited with the facts in front of you.

| | Option A: LUME "city mode" on Supabase | Option B: Workers-native (chosen) |
| --- | --- | --- |
| Database | Postgres with row-level security enforced by the database | D1 (SQLite); no row-level security, so isolation is application code plus tests |
| Region | LUME's project is in `ca-central-1` `[V]` | D1 and Durable Objects offer **no Canada jurisdiction or location hint** `[V]`; only hints (best effort) and the jurisdictions eu, us and fedramp |
| Live updates | Supabase Realtime | Durable Object with hibernating WebSockets |
| Moving parts | Cloudflare plus Supabase | Cloudflare only |
| Reuse from LUME | SQL policies, migrations, tests | Ideas only (§6); no code |
| Cost model | Supabase plan plus Cloudflare | Cloudflare Workers Paid, which includes D1 and Durable Object allowances |

Consequences of B that need to be said plainly:

- The database will not stop a coding mistake from leaking another property's data.
  Everything in §4 exists to make up for that.
- Data cannot be pinned to Canada. See O-05 and `06` §3.

## 4. Tenancy and authorisation

The rules that stop one property seeing another's data. They are enforced in code and
proved by test.

1. **Where the property comes from.** A guest session belongs to one property. A staff
   member may hold roles in several, so each staff request names the property it acts
   on in the path (pages at `/staff/p/<slug>/...`, API at `/api/staff/p/<slug>/...`) and
   the server checks that staff member's
   role in that property on every request; naming a property gives no access by itself.
   For a public content read with no session, the property is looked up server-side
   from the request's hostname (`property_hosts`); that is safe because the content is
   public by design and nothing private is returned. Public content is addressed as
   `/p/<slug>/...` (D-24): the slug is accepted only if it names a property in that
   hostname's own list in `property_hosts`. A host with one row serves that property
   only, and a slug that is unknown or not on the host's list gets the same flat 404.
   In every other case the property is never read from the body, the query string, a
   client-set header or a client-supplied id.
2. **Every query carries `property_id`.** All data access is in `worker\repositories\`.
   A repository function takes a context object that already holds the property; it
   cannot be called without one. Raw `env.DB.prepare` outside that folder is a lint
   error.
   **The one shared row type (D-23).** An activity belongs to an owner property
   (`activities.property_id`) and is readable by every property listed in
   `activity_offered_at`. Reads for property P require a row for P in that table. Staff
   with `editor` or `admin` at any listed property may edit its content; only the
   owner's `admin` may change the list or delete it. Guards `canEditActivity` and
   `canChangeOfferedAt` are the only way a write function may decide this. No other
   table is shared between properties.
3. **Composite foreign keys.** Every parent table has `UNIQUE (id, property_id)` and
   every child references `(parent_id, property_id)`. A child row cannot point at
   another property's parent even if code is wrong. `[I]` D1 enforces foreign keys;
   Phase 1 proves it with a test before relying on it.
4. **Named projections.** A function lists exactly which fields a client may see for
   each type (`PublicActivity`, `PublicGathering`, `PublicSignal`, `StaffActivity`).
   No `SELECT *` reaches a client. Author session ids never appear in any public
   projection.
5. **Random identifiers.** Anything a client can see uses a random 128-bit id, never a
   counter, so ids cannot be enumerated.
6. **Isolation test suite.** Two properties are created. For every repository
   function and every API route, a test acts as property A and attempts to read,
   list, update and delete property B's rows by id, and must find nothing. A meta-test
   fails the build if any exported repository function has no isolation test.
7. **Anonymous-surface test.** Every route is called with no cookie. The test
   compares each response's field names to an allow-list. This replaces LUME's
   `city_mode_anon_surface.sql` check (§6).
8. **Staff rights.** A staff member's role is per property, loaded from the database
   on each request, not read from a long-lived token.
9. **Writes.** Every state-changing request requires the session cookie, an `Origin`
   header matching the site, and a JSON content type. Cookies are `HttpOnly`, `Secure`,
   `SameSite=Lax`.

## 5. Data model

The tables, their purpose and the constraints that matter. Claude Code writes the
migrations; the behaviour below is the requirement. `[A]` throughout: this is a
design, not a finding. All text columns have a `CHECK` on length that matches the
shared schema. Instants are stored as UTC epoch seconds. Recurrence is stored as
weekday plus local wall-clock time plus the property's timezone name.

| Table | Purpose | Notable columns and rules |
| --- | --- | --- |
| `platform_flags` | Platform-wide switches such as `read_only` | key (unique), value; changed by the operator only |
| `properties` | A tenant | slug (unique), names in EN and FR, IANA timezone, address, supported languages, privacy contact title and address, `suspended_at` |
| `property_hosts` | Hostname to property | host (unique) |
| `property_features` | Feature switches | (property, feature) unique; enabled; who changed it and when. Default off |
| `zones` | Named places within a property | EN and FR label; `ring` (`in_hostel`, `short_walk` or `further`), which decides where its signals sit on the Nearby view; used by gatherings and signals; includes "Out and about", which sits on `further` |
| `staff_users`, `staff_memberships` | Staff identity and per-property role | role is `editor` or `admin`; auth tables depend on O-02 |
| `entry_codes` | QR codes | location label; from Stage 2 also a hash of the entry token (empty until then); `revoked_at`; never the token itself |
| `guest_sessions` | Anonymous sessions (Stage 2, Phase 5) | hash of session token, property, entry code, `created_at`, `expires_at`. No name, no IP, no user agent, no language |
| `consents` | What a session turned on (Stage 2, Phase 5) | (session, feature) unique; granted and revoked times; the version of the consent text shown |
| `activities`, `activity_exceptions` | The board, with recurrence and cancelled dates | EN and FR text, category, zone, host label, capacity (nullable), status, verified-on/by, `is_placeholder` |
| `places` | Explore | category, staff pick flag, staff note, walk time as text, hours text with verified-on, optional phone, `is_placeholder` |
| `offers` | Partner or membership benefits | terms text, valid from/to, requires-membership flag, verified-on/by, how-we-know note |
| `rsvps` | Stage 2 | (activity, session) unique |
| `gatherings`, `gathering_interest` | Stage 2 | author session never exposed; status `visible`, `hidden_pending_review`, `removed`; `expires_at` |
| `signals`, `signal_responses` | Stage 3 | `expires_at` set by the server; response carries `share_name` flag |
| `reports` | Stage 2 onward | target, reporter session, reason code, status, resolver |
| `rate_limits` | Abuse control (Stage 2, Phase 5) | keyed hash of session and of network address, window start, count; rows expire within 24 hours; a Durable Object or Cloudflare's rate-limiting feature may replace it `[U]` |
| `audit_log` | Staff and system actions | actor, action, target, time; no free-form personal data |
| `event_counts` | Aggregate analytics | (property, day, event) with a count; no session id, ever |

## 6. What carries over from LUME

HI CO shares no code with the LUME repository `[V]` (`02` §1). The lessons below come
from its `SECURITY.md`, migrations and tests (HEAD `3b0e995`, read 2026-10-23).

| LUME lesson | How it applies here |
| --- | --- |
| SB-1: anonymous users could read `gatherings` including `organizer_id` | Named projections; author session ids never in a public response; anonymous-surface test (§4.4, §4.7) |
| SB-2: the zone injected an analytics beacon the privacy policy disclaimed, blocked only by accident of the CSP | No third-party scripts; a strict CSP; the deploy checklist fetches the live page and fails if any beacon appears; the zone's Web Analytics auto-injection is turned off (`11` §7) |
| Distances only, never raw coordinates | Coordinates never reach the server (`07` §4) |
| Length `CHECK` constraints on user text | Same, in every migration, with a test that the shared schema and the `CHECK` agree |
| A bootstrap function creating a profile when a user signs up | Session creation is one function that writes the session and its consent rows together, or neither |
| Row-level security as the main tenant guard | Not available. Replaced by §4 |
| Residual trilateration risk on LUME's own backlog | Why Tier 2 radar needs a privacy impact assessment first (`06` §7) |

`SEC-10` and `SEC-11`, named in earlier project notes, do not occur in the LUME
repository `[V]`. Do not cite them as if they were there.

## 7. Guest entry and sessions

`[A]` proposal; the session part waits on O-01.

**Stage 0: labelled links, no sessions.** Each QR code is the property's address with a
location label after `#`. The page script reads the label, adds one to `event_counts`
for (property, day, `qr:<label>`) if the label exists for that property, and removes
the fragment. No cookie and no guest row exist. Only labels the property has created
are counted, so a hand-made link cannot fill the table with junk. The first release
therefore stores no guest data at all.

**From Stage 2: sessions.**
- Each code also carries a random entry token in the fragment. Fragments are not sent
  to servers, written to access logs or leaked in referrers. The page script reads the
  fragment, posts the token once to start a session, then removes it from the address
  bar.
- The server stores only a hash of the entry token. The browser holds a random session
  token in a cookie and the server stores only its hash, keyed with `SESSION_PEPPER`.
- Visitors without a session can read What's On and Explore. Social routes return
  "scan the code in the hostel" with no data.
- Rotating a code revokes it at once. Sessions it created are listed so an admin can
  revoke them too.
- `guest_sessions`, `consents` and `rate_limits` arrive with Phase 5.

## 8. Platform limits, plan and cost

`[V]` from Cloudflare's documentation, 2026-10-23, unless marked.

| Item | Workers Free | Workers Paid |
| --- | --- | --- |
| Durable Objects | SQLite-backed only | SQLite-backed |
| DO requests | 100,000 a day | 1 million a month included, then $0.15 per million |
| DO duration | 13,000 GB-s a day | 400,000 GB-s a month included |
| DO / D1 rows read | 5 million a day | 25 billion a month |
| DO / D1 rows written | 100,000 a day | 50 million a month |
| Storage | 5 GB | 5 GB-month included, then $0.20 per GB-month (DO) or $0.75 (D1) |

- On Free, exceeding a daily limit makes requests fail until 00:00 UTC. For an app
  guests rely on at 9 pm that is a hard stop, not a slowdown. Production therefore
  runs on **Workers Paid** `[A]`. Its monthly base fee was not read; check the
  pricing page before budgeting `[U]`.
- WebSocket messages into a hibernating Durable Object bill at 20 messages to 1
  request, and a hibernating object with no active work is not billed for duration
  `[V]`.
- At one hostel's scale, request and row volumes sit far below every included Paid
  allowance above `[I]` (a few hundred guests, tens of calls each per day). Measure in
  the pilot; do not trust this paragraph past it.
- `workers.dev` is acceptable for the gated preview. Production uses a custom
  domain (O-03).
- D1 maximum database size and count were not on the page read `[U]`.
- Jurisdiction and location: D1 hints are wnam, enam, weur, eeur, apac, oc;
  jurisdictions are eu, fedramp and us. Durable Objects add sam, apac-ne, apac-se,
  afr, me, and the `us` jurisdiction (added 2026-06-26). Hints are best effort.
  Canada is in neither list `[V]`.

## 9. Live state (Stage 3)

- One `PropertyRoom` Durable Object per property, addressed by property id.
- Guests connect over a WebSocket that uses hibernation so idle connections cost
  nothing. The object pushes signal changes to connected clients.
- Signal expiry uses a Durable Object alarm set to the next expiry time. D1 holds the
  authoritative `expires_at`, and every read filters by it, so an alarm that runs late
  never shows an expired signal.
- If the WebSocket cannot connect, the client polls. The feature degrades; it does
  not break.
- The object holds no data that cannot be rebuilt from D1.

## 10. Measurement and logging

- First-party aggregate counters only: a count per property, per day, per event name
  ("opened What's On", "offer shown"). No session id, no user agent, no IP in the
  counter table.
- No Cloudflare Web Analytics auto-injection. After every deploy, a script fetches
  the live HTML and fails if it contains any beacon or third-party host.
- Worker logs: request id, route, status, duration. No cookies, no tokens, no
  display names, no free text.
- Workers observability is on. Logs are the only error tracking at first; a
  third-party error tracker would add a script and a data flow, and needs a decision
  first.

## 11. Staff authentication

Decided: O-02 was called as Route 3 (D-26), our own WebAuthn with SimpleWebAuthn 14 and
D1 sessions. Built in Phase 1b-2 (2026-10-24, `[V]` by the test suites and the browser
tests with Chromium's virtual authenticator; **not tried on a real phone or security
key**, `[U]`). The requirements that every candidate had to meet are all met: passkey,
recoverable without a ticket to Martin, sessions revocable, every sign-in and invite in
the audit log, no shared logins.

- **Sign-in.** Discoverable passkeys: no username, no password. Origin and relying-party
  id are checked against the Worker's `ALLOWED_ORIGINS` and `RP_ID` (the production
  environment sets neither yet, so staff sign-in answers 503 there: O-03).
- **Session.** An `hc_staff` cookie (`HttpOnly`, `Secure`, `SameSite=Lax`), 12 hours,
  no sliding window. Only the SHA-256 of the token is stored. Roles are read from
  `staff_memberships` on every request, not from the session.
- **Invite and recovery (D-28).** An admin hands over a one-time link (30 minutes, single
  use, kept in the URL fragment and removed from the address bar when used), shown as
  text and a QR code. No email. Using a recovery link revokes the person's earlier
  passkeys and sessions. An admin may issue one only for a person whose roles are all at
  properties where that admin is also an admin; otherwise it is the operator's script.
- **Guards.** A person with only one passkey is nudged to add a second; the last admin of a
  property cannot be demoted or removed; the last passkey cannot be removed.
- **Rate limits.** Sign-in, invite and recovery endpoints, in D1, keyed by a daily-rotating
  HMAC of the caller's address (`RATE_LIMIT_SECRET`), so counters cannot be linked across days.
- **Audit.** Person-level events are written once per property the person holds a role
  in (D-27).
- **Recorded risk.** We own the session, token and recovery code and nobody independent
  has reviewed it; an outside review before production is `[U]` and belongs on `12`.

## 12. Offline and PWA

- The shell and the last-fetched content are cached by a service worker. The guest
  sees the last good What's On and Explore with "Last updated" shown, not an error.
- Content is fetched network-first with a short timeout, then cache, so a stale board
  never beats a fresh one on good wifi.
- Social routes are never served from cache.
- The service worker never caches anything with a session cookie in its response.
- How long iOS keeps a site's stored data between visits `[U]`; the app must work
  from a cold start with a network and must not assume the cache survived.
- The "Add to home screen" prompt is manual, shown on request in settings, not a
  pop-up.

## 13. Language and time

- English and French strings live in catalogs. The lookup rule is: the guest's
  language if the string exists, else English with a visible "English only" marker.
  Never a blank and never a raw key. A build test fails if any shipped key has no
  French (`09` §6).
- Dates are stored in UTC and shown in the property's timezone. Tests cover both
  daylight-saving changes.

## 14. Security headers and CSP

Target for every response `[A]`; Phase 1 writes the exact values and tests them:
`Content-Security-Policy` with `default-src 'none'`, `script-src 'self'`,
`style-src 'self'`, `img-src 'self' data:`, `font-src 'self'`, `connect-src 'self'`
plus the site's `wss:` address, `manifest-src 'self'`, `frame-ancestors 'none'`,
`base-uri 'none'`, `form-action 'self'`. Also `X-Content-Type-Options: nosniff`,
`Referrer-Policy: no-referrer`, and a restrictive `Permissions-Policy` that allows
geolocation only for the site's own origin. User content is rendered as text, never
as HTML.

## 15. Backup and recovery

- D1 Time Travel restores a database to any point in the last 30 days; the CLI has
  `info` and `restore` subcommands `[V]` Wrangler 4.152.0 help, 2026-10-23. Exact
  behaviour is proved in a restore drill in Phase 8, not trusted from this paragraph.
- Before every remote migration: `wrangler d1 export` to a dated `.sql` file outside
  the repo (`11` §4).
- A global `read_only` flag in `platform_flags` and the per-property feature switches
  let Martin stop writes, or one feature, without a deploy `[A]`.

## 16. Repository layout

As built in Phase 1 (2026-10-23) and extended in Phase 1b-2 (2026-10-24), `[V]`. The full tree, with what each part does, is in
`02-STATE.md` §4. In short:

```text
hico\
  CLAUDE.md  package.json  wrangler.jsonc  vite.config.ts  vitest.config.ts  playwright.config.ts
  docs\                 the numbered documents; plans\; spikes\; external\ (answers from
                        HI Canada that Martin adds)
  reference\            hi-co-prototype.jsx (never edited)
  worker\               API (Hono), tenant middleware, repositories\, projections, preview-gate\
  web\src\              Preact front end; index.html is at the repository root
  web\src\staff\        the staff console, a lazily loaded chunk guests never download
  shared\               limits, Valibot schemas, types, design tokens, contrast, i18n catalogs
  migrations\           D1 migrations
  seed\                 demo seed (local D1 only)
  scripts\              validate and its parts; the operator scripts (operator.ts and the five
                        .ps1 wrappers: create-property, add-hostname, invite-first-admin,
                        load-zones, issue-recovery-link), local by default
  public\fonts\         DM Sans (self-hosted) and its licence
  tests\                worker\ (workerd + D1), node\, web\ (jsdom), e2e\ (Playwright)
```

`content\` and `spike\` from the proposal do not exist yet; `content\` arrives with Phase 3.