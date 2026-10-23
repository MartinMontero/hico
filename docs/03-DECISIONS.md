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
Staff are the content authors. Who at HI Vancouver Downtown owns the weekly update
and the report queue, and is that within the "a few minutes a day" budget `[A]`? Ask
before launch. Reversible: Y.

### O-10 Languages at launch
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
The prototype shows a star rating on all 24 places with no stated source `[V]`.
- **Recommended:** remove numeric ratings. Show "Staff pick", a one-line staff note
  and a verification stamp. A rating nobody can trace is the kind of thing that
  "masquerades as real".
- Alternatives: keep a rating that staff assign and label it "Staff rating" (honest,
  but invites argument about the number); import third-party ratings (terms of use,
  cost and freshness all `[U]`).
- Reversible: Y.

### O-14 "I'm In" before Stage 2
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

## Pending gate

**G0 — framework gate.** Closes when the Phase 0.2 spike report is in and Martin has
read it and chosen. Closing it adds decision D-12 (the framework). Until then no
application code is written in a framework. Phase 1 adds D-13 (the validation
library).
