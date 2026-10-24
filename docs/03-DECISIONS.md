# DECISIONS — HI CO

One row per decision. Append, never rewrite history; supersede with a new row.
"Called by" is who made the call. Reversible: **Y** cheap, **M** costly, **N**
effectively permanent.

## How a decision is called and recorded

Martin calls a decision in plain words, including "accept O-01 as recommended".
Claude Code appends a row to Decided with the next D number and the date, and marks
the open item "Resolved by D-nn". An accepted recommendation is a decision. A decision
that is not in this file has not been made.

## Decided

| ID | Decision | Reasoning / alternatives rejected | Called by | Date | Rev. |
| --- | --- | --- | --- | --- | --- |
| D-01 | HI CO is a stand-alone app. Its product, funding and schedule do not depend on any other program or pilot, and no HI CO document or code refers to one. LUME and the Serendipty repository are its origin and tooling and are cited as such | Keeps scope and funding questions out of the product | Martin | 2026-10-23 | Y |
| D-02 | Multi-tenant. Each HI Canada property gets its own staff login and its own customised content. **HI Vancouver Downtown is the first tenant** | The prototype content is HI Whistler's. Downtown needs its own. This is Martin's decision; HI Canada's and Downtown's agreement is not recorded `[U]` | Martin | 2026-10-23 | M |
| D-03 | The café at HI Whistler is spelled **Cheekye's** | Spelling stated by Martin. Earlier research notes spelled it differently; ignore them | Martin | 2026-10-23 | Y |
| D-04 | The radar stays, and it is opt-in. **Every** privacy-sensitive feature is opt-in and off by default | Martin's rule. It also meets Quebec's default-privacy rule for products with privacy settings (section 9.1) and its notice rule for identify/locate/profile technology (section 8.1), as read in the Act's text updated to 15 October 2026 (`06` §3) | Martin | 2026-10-23 | N |
| D-05 | Production architecture is **Option B: Workers-native** (Cloudflare Worker, D1, Durable Objects when live state is built). Option A (LUME city mode on Supabase) is not used | Martin's call. Trade-offs recorded in `05` §3 | Martin | 2026-10-23 | M |
| D-06 | The front-end framework is not fixed to React. Use an alternative of equal or greater quality and performance if one qualifies | The Phase 0.2 spike supplies evidence and a recommendation; Martin chooses (D-12). Candidate recommendation: Preact 11, with Svelte 5 as the alternative (`05` §2.3) | Martin | 2026-10-23 | M |
| D-07 | Single-player first: ship the tool that helps one guest alone before any feature that needs other guests | Adoption research (`08`) | Inherited | — | Y |
| D-08 | No points, badges, streaks or leaderboards | Adoption research (`08`); Martin's standing rule | Inherited | — | N |
| D-09 | No native app, no booking gate, no reliance on push for core retention | Adoption research (`08`) | Inherited | — | M |
| D-10 | Location is foreground, per-use and on-device. Never continuous or background. Wallet pass is the only background route and it is OS-mediated and opt-in | Feasibility report (`07`) | Inherited | — | M |
| D-11 | Vendor policy is an exclusion list (Meta, OpenAI, xAI). Everything else is permitted | Martin's standing rule | Inherited | — | Y |
| D-12 | The front-end framework is **Preact 11**, as a Vite single-page app with a Hono Worker behind it. Phase 0.2 (the framework spike, gate G0) is waived. React stays only as the measuring baseline and is not a candidate for HI CO. This resolves O-16 | Martin, 2026-10-23, on the sandbox benchmark in `05` §2.1, summarised in `docs\spikes\G0-framework-report.md`. In it Preact reached first content 49% to 57% sooner than React at 4× and 6× CPU slowdown and at 1× about 50% sooner, and its one-screen build is 6.4 KB gzip against React's 68.2 KB. Update costs were mostly not significantly different from React's; five cells in the larger lists were more than 10% slower (report §2). What it did not measure: styled screens, a real phone, Windows, Lighthouse, axe on the running page, developer experience, the Cloudflare Vite plugin, and Preact's React-compatibility layer `[U]`. Strongest argument against Preact: version 11 is about three weeks old (`05` §2.3). Svelte 5 stays the documented alternative. Preact is a separate project from React; choosing it is Martin's call on the part of O-16 that asked whether that suffices | Martin | 2026-10-23 | M |
| D-14 | The café at HI Whistler is spelled **Cheaky's Cafe**. This supersedes D-03 | Martin, 2026-10-23. It is also how HI Canada's own discounts page spells it. The prototype source spells it Cheekye's and is wrong on this point | Martin | 2026-10-23 | Y |
| D-15 | An activity that HI Vancouver Downtown and HI Vancouver Jericho Beach both offer is **one shared record**, edited once and shown to guests of both hostels. Most activities meet at HI Vancouver Downtown for guests of both hostels, and the Jericho front desk tells guests how to get there, so the app carries no transport information | Martin, 2026-10-23. Replaces separate copies per hostel, which already differ on the two boards (`docs\external\jericho-2026-10-23\jericho-transcription.md` §1 and §3). How the data model carries it (a list of properties on the activity, or one tenant with two sites) is settled in the Phase 1 plan, which waits for Martin's GO. D-02 stands as written until then | Martin | 2026-10-23 | M |
| D-16 | PowerShell 7.6.8 (`winget`, `Microsoft.PowerShell`) and Wrangler 4.152.0 (`npm install -g`) are installed on this machine, on Martin's instruction in chat. Both are machine-wide, not project dependencies; no `package.json` exists | Martin chose both when asked, 2026-10-23, after the preflight found neither. PowerShell 7 lets the scripts be run under both shells (`11-DEPLOY.md`); Wrangler is needed from the deploy phases. Wrangler is not logged in as far as checked, and no Wrangler command beyond `--version` has been run | Martin | 2026-10-23 | Y |
| D-17 | **No numeric place ratings** (O-13 accepted as recommended). A place shows "Staff pick", a one-line staff note and a verification stamp | The prototype's stars on all 24 places have no stated source `[V]`; a rating nobody can trace is the kind of thing that masquerades as real (`01`) | Martin | 2026-10-23 | Y |
| D-18 | **"I'm In" saves the activity to the guest's own plan on their device and shows no count** (O-14 accepted as recommended). Shared counts and capacity wait for Stage 2, when sessions and the consent screen exist | Keeps Stage 0 single-player (D-07) and independent of the QR session flow | Martin | 2026-10-23 | Y |
| D-19 | **English and French from day one** (O-10 accepted as recommended). French needs a native Québécois review before any Quebec-facing deployment | The architecture needs both regardless (`05` §13). Nobody has been named as the reviewer `[U]` | Martin | 2026-10-23 | Y |
| D-20 | **Fawzie owns content updates and the report queue** for HI Vancouver Downtown and HI Vancouver Jericho Beach (O-09) | Martin's call. Fawzie runs programs for HI Jericho, Downtown and Whistler `[R]`. His own agreement and whether this fits the "a few minutes a day" budget `[A]` are not recorded `[U]`. Martin says events change monthly, not daily `[R]` | Martin | 2026-10-23 | Y |
| D-21 | **For the demo only,** the app's domain is **hico.builderworkshop.ca** and it shows **no HI logo**. The production hostname, who owns the domain, and whether HI marks may be used stay open (O-03) | Martin, 2026-10-23. Whether builderworkshop.ca is on the Cloudflare account Wrangler will use is not checked `[U]`. How the two hostels are told apart (one host with the property carried in the link, or a subdomain each) is for the Phase 1 plan | Martin | 2026-10-23 | Y |
| D-22 | **Demo scope.** The demo is for HI Canada's head office: Rhian, General Manager of both Vancouver hostels, asked for it so she can present it to the head of programs `[R]`. It is Phases 1, 1b-1, 1b-2, 2 and 3 of `10-BUILD-PLAN.md`, with Phase 3 covering both HI Vancouver Downtown and HI Vancouver Jericho Beach (D-15). Staff sign-in (O-02) is part of the demo; its method is chosen by the Phase 1b-1 spike and then called by Martin. Phase 0.2 is waived (D-12). Phase 3b onward (production, savings, membership verification, shared counts, wallet pass, a second tenant) is not part of the demo. Nothing is deployed without Martin's GO in advance | Martin, 2026-10-23: "you are overcomplicating this MVP build for the demo to senior management" and "staff sign-in (O-02) is part of the demo". HI Canada head office's agreement is not recorded `[U]` | Martin | 2026-10-23 | Y |
| D-23 | **An activity is one record owned by one property, with an "offered at" list** (O-17, Option A). Any property in the list can read it; staff with `editor` or `admin` at any listed property can edit its content; only the owner's `admin` changes the list or deletes it. D-02 is unchanged: each property is still a tenant. `05` §4 gains one paragraph stating this exception | Martin, 2026-10-23, "D-15: Option A". Option B (one tenant, two sites) would have changed D-02 and widened each hostel's staff rights | Martin | 2026-10-23 | M |
| D-24 | **Public content is addressed as `/p/<slug>/...`, and the slug is accepted only if it is in the request hostname's own list in `property_hosts`** (O-18, Option 1). A host with one row serves that property only. `05` §4 rule 1 and the matching line in `CLAUDE.md` are amended accordingly. Staff and guest-session rules are unchanged | Martin, 2026-10-23, "D-21: Option 1 ... approve the change to 05 section 4 rule 1 and the matching CLAUDE.md line". Option 2 (one hostname per hostel) stays available later with no code change, only `property_hosts` rows | Martin | 2026-10-23 | Y |
| D-25 | For the demo the app **shows no "HI" in hostel names** ("Vancouver Downtown", "Vancouver Jericho Beach", "Whistler"), the header is **the property name as text only** with no glyph, and **two extra placeholder properties (Downtown, Jericho Beach) are seeded** with shared sample activities so the hostel choice and D-15 can be shown | Martin, 2026-10-23, answering plan §0 items 4 to 6 | Martin | 2026-10-23 | Y |
| D-13 | **The validation library is Valibot 1.5.0**, shared by browser and Worker from `shared\` (every length limit is declared once in `shared\limits.ts`) | Chosen by Claude Code in Phase 1, as the brief allowed. Modular, so the browser bundle carries only the validators used (initial JavaScript is 12.45 KB gzip against the 60 KB budget, `04` §7). Zod 4.6.7 was the alternative: a larger ecosystem, a bigger default bundle. A test checks that the migration's CHECK lengths equal `shared\limits.ts` | Claude Code | 2026-10-23 | Y |
| D-26 | **Staff sign-in is our own WebAuthn, passkey-first: SimpleWebAuthn 14 with D1 sessions** (O-02, Route 3). A person has one or more passkeys, no password. Roles stay in `staff_memberships` and are read on every request. Route 1 (Cloudflare Access) and Route 2 (Better Auth) are not used | Martin, 2026-10-24, on `docs\spikes\staff-auth-report.md`: our own route passed 14 of 14 browser tests, needs no remote resource, and is the smallest (Worker 148 KiB gzip, sign-in page 9.8 KB, 26 packages). Strongest argument against, recorded: we own the sessions, tokens, recovery and rate limiting, and nobody independent has reviewed them; an outside review before production is `[U]` | Martin | 2026-10-24 | M |
| D-27 | **Person-level audit events (sign-in, sign-out, recovery, session and passkey changes) are written one row per property the person holds a role in**, in the existing `audit_log`. A person with no role writes no row and cannot sign in (O-20 accepted as recommended). `06` §2 says so | Martin, 2026-10-24, "accept O-20 and O-21 as recommended" | Martin | 2026-10-24 | M |
| D-28 | **Staff invite and recovery links are handed over by an admin: a one-time link or QR code shown once, no email** (O-21 accepted as recommended). Recovery is another admin of that property issuing a link, or the person's own second passkey. A property with one admin who loses their only device needs the operator (Martin) to issue a link, so staff should register two passkeys. Email stays a later add-on and needs its own decision | Martin, 2026-10-24. No sender, no new data flow, no DNS change | Martin | 2026-10-24 | Y |
| D-29 | **The QR library is lean-qr 2.7.4** (MIT, no dependencies), used only in the staff chunk, pinned to the exact version. It draws a code as an SVG image with a text alternative; invite and recovery links and the labelled links of a property are drawn with it | Chosen by Claude Code in Phase 1b-2 under Martin's approval of one QR package (2026-10-24, "approve the npm install of one QR library, chosen in the build"). Candidates: uqr 0.1.3 (MIT, no dependencies, pre-1.0), qrcode-generator 2.0.4 (MIT, 555 KB unpacked), lean-qr 2.7.4 (MIT, 69 KB unpacked, 2.x, updated September 2026). lean-qr was the smallest stable-major one. The whole staff chunk, console and library together, is 29 KB gzip against its 90 KB budget; the guest bundle is unchanged (15.6 KB of 60 KB). The `npm audit` findings (undici, zod) are in the existing tooling, not in this package. A code was checked to render as a decoded image, but **not scanned with a reader**: that check is `[U]` on a phone | Claude Code | 2026-10-24 | Y |

The next free number after D-29 is D-30.

## Open — decisions Martin owes

Each has a recommendation. None is built until Martin calls it.

### O-01 Guest access model
How does a guest get in, and what proves they are actually at the hostel?
- **Recommended:** content screens (What's On, Explore) are open to anyone with the
  link. Social features (gatherings, signals) need a **presence token** from a QR
  code staff print and display on site. Scanning it starts an anonymous guest
  session that lasts the length of a typical stay. Staff can rotate the code.
  Presence is proven by a physical act, with no location data involved.
- Alternatives: everything open (simplest; strangers and bots can post); everything
  behind a QR (hostile to guests who share the link before arriving); account
  sign-up (a wall; the adoption research says no).
- Cost of the recommendation: a guest who returns after the session ends scans
  again; a QR photographed and posted online extends access until rotated.
- Needed from Stage 2. Stage 0 uses plain QR links carrying a location label and has
  no session (`05` §7).
- Reversible: Y.

### O-02 Staff authentication
**Resolved by D-26: our own WebAuthn, passkey-first (the Phase 1b-1 spike, `docs\spikes\staff-auth-report.md`).**

Three options, none verified to work on this stack yet (Phase 1 spike decides):
1. **Cloudflare Access** in front of `/admin`: least code. `[U]` seat limit and
   login methods on the free plan (the pricing page did not state them), and
   per-property role mapping is manual.
2. **Better Auth** with its passkey plugin: documented, passkey support confirmed
   in its docs; `[U]` D1/Workers support (the page did not mention either).
3. **Own WebAuthn** using a standard library plus D1 sessions: most code to own,
   no dependency risk.
- Also needed: how a staff member recovers access (email delivery path `[U]`).
- `[U]` Does HI Canada want single sign-on for staff? That would change this.
- Recommendation: passkey-first with email fallback; choose between 2 and 3 on the
  spike result. Reversible: M.

### O-03 Hostnames, domain and marks
**Resolved for the demo only by D-21 (hico.builderworkshop.ca, no HI logo). The production half is still open.**

One subdomain per property (`downtown-vancouver.<domain>`) or one host with
`/p/<slug>`? Who owns the domain: Martin or HI Canada? May HI CO use "HI" marks, and
the HI Canada logo? `[U]` — ask HI Canada. Recommendation: subdomain per property
on a domain Martin controls until HI Canada says otherwise; custom domain on the
Worker, not `workers.dev`. Reversible: M.

### O-04 Radar: how much "nearby"?
- **Tier 1 (recommended for the first release of the Nearby view):** no person-to-person distance. The Nearby view
  groups live signals by **named place** (Common Room, Deck, Kitchen, Lobby,
  Out and about), and each place belongs to one of three rings: In the hostel, A short
  walk away, Further out. A guest may opt in to a foreground check that tells **them** whether
  they are at the hostel, computed on their phone; coordinates never reach the
  server.
- **Tier 2 (later, only after pilot evidence):** distance bands between guests who
  have both opted in, in bands of at least 100 m, with a minimum number of opted-in
  guests before anything shows. This reintroduces the stalking and trilateration
  risks the adoption audit flags; LUME's own distance function left a residual
  trilateration risk on its backlog. `[U]` the legal analysis for Quebec guests.
- Reversible: Tier 1 to Tier 2 is Y; the reverse is not a decision, it is a
  retraction.

### O-05 Data residency stance
Cloudflare D1 and Durable Objects offer no Canada jurisdiction and no Canada
location hint `[V]` (Cloudflare docs, 2026-10-23); hints are best-effort. LUME's
Supabase project is in `ca-central-1` `[V]`. AWS's Canada (Central) region, which
that name mirrors `[I]`, is in Montréal, Québec `[V]` (AWS announcement, 2016). For a
Quebec-facing property, data in Montréal would not leave Québec and data in D1 would,
which engages sections 17 and 18.3 of the Quebec Act (`06` §3). Whether that outweighs
the cost of a second datastore is for counsel and you `[U]`.
- **Recommended:** accept it for the first release and design the data so little is at stake: no
  guest email, no name required, no location stored, short retention, staff
  accounts the only personal data kept. Ask HI Canada's privacy officer and counsel
  to accept this in writing.
- Alternative: keep personal data in a Canadian-region Postgres (Supabase
  `ca-central-1`) behind the Worker and use D1 for content only. More moving parts;
  reopens part of Option A.
- `[U]` BC PIPA's position on storage outside Canada; not verified here.
- Reversible: M.

### O-06 Minors and age gating
HI properties host minors and school groups `[R]` (Guest Adoption Strategy; `08` §9). `[U]` HI Canada's
unaccompanied-minor and age policy was not located. **Recommended:** social
features off by default, an 18+ attestation inside the opt-in, a per-property
switch staff can flip off during school-group stays. Self-attestation is weak; say
so to HI Canada. Reversible: Y.

### O-07 Ownership, licence and hosting costs
Who owns the code and the Cloudflare account in production, what licence applies,
and who pays for hosting? `[A]` Workers Paid is required in production (see `05`
§8). `[U]` whether HI Canada can fund and sustain development and hosting — the
adoption audit lists this as unresolved. Reversible: N once a contract exists.

### O-08 Membership integration
HI Canada's membership card is issued through the Audience platform, built by
Tomahawk and now owned by Cobber (formerly ResPax) `[R]` per the Guest Adoption Strategy.
No public API was found. Four questions go to Cobber (`07` §6). Until answered,
HI CO treats membership as something a guest declares, never something it
verifies. Reversible: Y.

### O-09 Who edits content and who moderates
**Resolved by D-20.**

Staff are the content authors. Who at HI Vancouver Downtown owns the weekly update
and the report queue, and is that within the "a few minutes a day" budget `[A]`? Ask
before launch. Reversible: Y.

### O-10 Languages at launch
**Resolved by D-19.**

English plus French from day one (the architecture needs both regardless). Others
(Spanish, Japanese, Korean, German) are a content-and-review cost per language.
Recommendation: EN and FR at launch for Downtown; FR needs a native Québécois
review before any Quebec-facing deployment. Reversible: Y.

### O-11 Measurement
First-party aggregate counts only, no per-person tracking, no third-party scripts
(LUME's SB-2 shows how an edge-injected analytics beacon contradicts a privacy
policy). Which numbers matter to HI Canada, and what are today's baselines
(member count, discount redemption rate, average stay)? All `[U]` and internal to
HI Canada. Reversible: Y.

### O-12 Source control and CI
The Serendipty rule is local git, no remote. A production product wants backup,
review history and CI. Recommendation: a private remote repository and CI that runs
`npm run validate`. Reversible: Y.

### O-13 Place ratings
**Resolved by D-17.**

The prototype shows a star rating on all 24 places with no stated source `[V]`.
- **Recommended:** remove numeric ratings. Show "Staff pick", a one-line staff note
  and a verification stamp. A rating nobody can trace is the kind of thing that
  "masquerades as real".
- Alternatives: keep a rating that staff assign and label it "Staff rating" (honest,
  but invites argument about the number); import third-party ratings (terms of use,
  cost and freshness all `[U]`).
- Reversible: Y.

### O-14 "I'm In" before Stage 2
**Resolved by D-18.**

Stage 0 is single-player. **Recommended:** "I'm In" saves the activity to the
guest's own plan on their device and shows no count. Shared counts and capacity
arrive in Stage 2, when sessions and the consent screen exist.
- Alternative: show anonymous counts from Stage 0. Staff get headcounts for trivia
  night sooner; it needs a guest session from day one and makes the first release
  depend on the QR flow.
- Reversible: Y.

### O-15 Wallet issuer account
Who holds the Apple Developer Program membership and the Google Wallet issuer
account? The issuer's name appears on the pass and the signing certificates belong
to that account. Needed only for Phase 7. `[R]` $99 USD a year for Apple (feasibility
report); `[U]` any fee waiver for HI Canada (Apple's own fee-waiver pages returned
"not found" when I tried them on 2026-10-23). Reversible: M.

### O-16 Does the Meta exclusion cover React?
**Resolved by D-12: React is the measuring baseline only. Preact was chosen.**

Your vendor exclusion list names Meta. React began at Meta and is now governed by the
React Foundation (Linux Foundation, launched 2026-02-24), where Meta is one of eight
founding platinum members `[V]`. The project instructions state your list as written
and do not decide this for you.
- If React is excluded: it stays in the spike only as the measuring baseline and
  cannot be chosen at G0.
- If it is not: it competes under the same rule as the others.
- Preact is a separate project that implements React's programming interface. The
  repository page I read does not connect it to Meta `[R]`. Whether that is enough is
  part of this question.
- **Recommended:** decide before you read the G0 report, so the answer does not depend
  on the numbers.
- Reversible: Y.

### O-17 Data shape for an activity offered by one or two properties
**Resolved by D-23.**

Settles the open part of D-15. Full options, costs and tests: `docs\plans\2026-10-23-phase-1-foundation.md` §1.
- **Recommended: Option A.** One activity record owned by one property, with an
  "offered at" list of the properties that show it. Any property in the list can edit
  its content; only the owner's admin changes the list or deletes. D-02 does not change.
- Alternative B: one tenant ("the Vancouver hostels") with two sites. D-02 would change.
- Reversible: M.

### O-18 How one domain serves two hostels
**Resolved by D-24.**

Settles the open part of D-21. Options, costs and tests: plan §2.
- **Recommended: Option 1.** The property is chosen by a path segment (`/p/<slug>`), accepted only if
  it is in that host's own list in `property_hosts`. This changes `05` §4 rule 1 and the
  matching line in `CLAUDE.md`, so it needs Martin's approval.
- Alternative 2: one hostname per hostel (rule 1 unchanged; needs more DNS, certificate
  and route changes, and preview on `workers.dev` can serve only one hostel).
- Reversible: Y for the demo.

### O-19 British Columbia clock changes
Found while writing the daylight-saving tests. On this machine the runtime's time-zone data
(Node ICU, tzdata 2026b) has America/Vancouver on UTC-7 permanently after 8 March 2026: no
autumn change on 1 November. Toronto, Edmonton, Los Angeles and Paris still change `[V]`
(`02` §4). `05` §13 assumed both changes happen.
- Does BC (and so Whistler and both Vancouver hostels) now stay on daylight time all year? I
  did not check an official source; the data on one machine is the only evidence `[U]`.
- What the code does either way: dates are stored in UTC, shown with the IANA zone, so it
  follows the device's data. A phone with older data would show times an hour off for part of
  the year. The weekly board stores wall-clock times with the zone, so the posted time stays
  right wherever the data is current.
- **Recommended:** confirm the BC rule with someone at the hostel or an official source before
  the demo, and add a launch-check line that a phone on an older OS shows the right times.
- Reversible: Y.

### O-20 Where person-level audit events go
**Resolved by D-27.**

Found in the staff sign-in spike (`docs\spikes\staff-auth-report.md` §7.1). `audit_log` has a required
`property_id`, but a sign-in, sign-out or recovery belongs to a person who may hold roles in several properties.
- **Recommended:** keep one `audit_log`, write one row per property the person holds a role in (as the spike did), and
  say so in `06` §2. A person with no role produces no row and cannot sign in.
- Alternative: a separate platform-level audit table the operator reads. More to build; one more place to purge.
- Reversible: M. Decide with O-02.

### O-21 How staff invite and recovery links are delivered
**Resolved by D-28.**

From the same report (§6). The demo has a handful of staff.
- **Recommended for the demo:** the admin is shown a one-time link or QR code and hands it over in person; recovery is
  another admin issuing a link, or the person's second passkey. No email, no sender, no new data flow.
- Alternative: email through Cloudflare Email Service (Beta; arbitrary recipients need Workers Paid; the sending domain
  needs DNS records, a change that needs your GO) or a third-party sender (Resend, Postmark; a new data flow).
- Reversible: Y.

## Gates

**G0 — framework gate. Closed by waiver on 2026-10-23 (D-12).** Phase 0.2 was not run. The evidence is the sandbox benchmark, summarised in `docs\spikes\G0-framework-report.md`, which says what was and was not measured. Phase 1 adds D-13 (the validation library).
