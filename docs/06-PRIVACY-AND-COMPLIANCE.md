# PRIVACY AND COMPLIANCE — HI CO

This is an engineering document, not legal advice. Where the law matters, it states
what was found, how it was found, and what counsel must confirm. Labels: `[V]` `[R]`
`[I]` `[A]` `[U]` as in `00-README.md`. Retention periods and limits marked `[A]` are
proposals for HI Canada's privacy officer to accept or change.

## 1. The opt-in rule

Everything privacy-sensitive is opt-in and off by default (D-04). Nothing turns on
because a guest failed to turn it off. Every switch below starts off, is explained at
the moment it is offered, can be turned off at any time in Settings, and takes effect
at once.

### 1.1 Features with a switch

| Feature (stage) | Needs first | Turning it on does | Leaves the device | Kept | Off does |
| --- | --- | --- | --- | --- | --- |
| Guest session (2) | Scanning a QR code | Starts an anonymous session so social features can exist | A random session token. No name, email or phone | Until the session ends, `[A]` 14 days | "Delete my data" ends it and removes its rows |
| I am 18 or over (2) | A session | Allows Common Room and Connect to be switched on | The fact that the guest attested, with a time | With the session | Hides both features |
| Common Room posting (2) | 18+ attestation | Lets the guest post a gathering and show interest | Display name, the post text, the place, the time | Until 7 days after the event `[A]` | Removes the guest's open posts |
| Send signals (3) | 18+ attestation | Lets the guest publish a signal | Display name, signal type, chosen place, optional note, end time | Until 24 hours after it ends `[A]` | Ends the live signal |
| See nearby signals (3) | 18+ attestation | Shows other guests' signals and the radar | Nothing beyond the request | Nothing | Hides them |
| Reply to a signal (3) | See nearby signals turned on | Tells the sender someone is interested; the sender sees a count | The fact of the reply, with no name unless the next row is used | Until the signal's retention ends | Withdraws the reply |
| Share my name on a reply (3) | A signal to reply to | Shows the guest's display name to the sender of that one signal | Display name, once per reply | Until the signal's retention ends | The sender sees only "someone is interested" |
| Check I'm here (3) | A tap, then the browser's own location prompt | Tells the guest, on their phone, whether they appear to be at the hostel | **Nothing.** The position is compared on the phone and discarded | Nothing | Nothing to undo |
| Wallet pass (later) | Tapping Add on a pass | OS may show the pass near saved places | The phone registers with Apple or Google for pass updates (a device push token) | Pass registration until deleted | Removing the pass in Wallet stops updates |
| Any notification (not built) | n/a | n/a | n/a | n/a | If ever built, opt-in per kind |

### 1.2 Things that need no switch, and why

- **Saved plan, language, text size, membership flag.** Stored only on the guest's
  device. Nothing leaves it.
- **Aggregate counters** ("What's On opened", "offer shown"). A count per property per
  day with no identifier. If a counter ever needs an identifier, it becomes a feature
  with a switch.
- **Stage 0 stores nothing about a guest on the server.** A QR scan adds to an
  anonymous count by location label and sets no cookie.
- **The session cookie (from Stage 2).** Strictly needed once the guest scans a code,
  and the scan is the guest's action. Counsel confirms that no cookie notice is needed beyond the
  disclosure on the landing screen `[U]`.

## 2. Data inventory and retention `[A]`

| Data | Why it exists | Held in | Kept | Removed by |
| --- | --- | --- | --- | --- |
| Entry code (hash, location label) | Start sessions | D1 | Until revoked, then 30 days | Daily purge job |
| Guest session (token hash, property, times) | Social features | D1 | Expiry plus 7 days | Purge job; "Delete my data" |
| Consents (feature, times, text version) | Proof of opt-in | D1 | With the session | Same |
| Gatherings, interest | Common Room | D1 | Event end plus 7 days | Purge job; author off-switch |
| RSVPs | Shared counts | D1 | Event end plus 7 days | Purge job |
| Signals, responses | Connect | D1, plus the room object while live | Expiry plus 24 hours | Alarm and purge job |
| Reports | Review | D1 | Resolved plus 90 days | Purge job |
| Staff accounts | Staff login | D1 | While active, plus 30 days | Admin or operator removal |
| Audit log | Accountability | D1 | One year | Purge job |
| Rate-limit counters | Abuse control | D1 or room object | 24 hours; keyed by a hash whose key is derived each day from `RATE_LIMIT_SECRET` and the UTC date, so counters cannot be linked across days | Expiry |
| Aggregate counters | Measurement | D1 | Indefinite; contains no personal data | n/a |
| Worker logs | Operations | Cloudflare | Cloudflare's retention `[U]` | n/a |
| Saved plan, membership flag, language | Convenience | The guest's device | Until cleared | The guest |

The purge job is a scheduled Worker (a Cron Trigger `[I]`, confirmed in Phase 2). A
test with a fake clock proves each row type is removed on schedule. Retention is a
tested behaviour, not a promise.

Data minimisation: HI CO does not collect guest names, emails, phone numbers, IP
addresses (beyond transient handling by Cloudflare), device identifiers, precise
location, room or bed numbers, or images. Staff email addresses are the only
directly identifying data the application stores.

## 3. What the law requires — what is known and what is not

- **Which statute applies** depends on the province of each property and how HI Canada
  is organised. Candidates: the federal PIPEDA, British Columbia's PIPA, Alberta's PIPA
  and Quebec's private-sector Act `[I]`. Counsel confirms `[U]`.
- **Quebec's private-sector Act (CQLR c. P-39.1).** Martin supplied the Act as
  published by the Québec Official Publisher, updated to 15 October 2026 and marked as
  having official status. All 38 pages were read `[V]`. It includes the 2021 amendments
  (Law 25, 2021 c. 25). The text does not say how far the Act reaches beyond Québec:
  section 1 applies it to personal information that a person collects, holds, uses or
  communicates in the course of carrying on an enterprise `[V]`. Whether that reaches
  a British Columbia property's Quebec-resident guests, or HI Canada as a whole, is for
  counsel `[U]`. The table applies if it does. The "What the Act says" column
  paraphrases the statute `[V]`; the "What HI CO does" column is the engineering
  response `[I]` for counsel to confirm.

  A third-party explainer from OneTrust gives the in-force timeline: breach
  notification and the privacy officer from September 2022, most other duties from
  September 2023, data portability from September 2024 `[R]`. The page describes those
  dates as upcoming, so it was written before September 2023 `[I]`, and the statute
  text carries no in-force dates. The page puts the penal fine for an individual at
  $5,000 to $50,000; the Act says $5,000 to $100,000 (section 91), so the Act governs
  `[V]`.

| Section | What the Act says `[V]` | What HI CO does `[I]` |
| --- | --- | --- |
| 3.1, 3.2, 8.2 | The person with the highest authority is the privacy officer unless they delegate in writing, and the officer's title and contact must be published on the website. Governance policies, and a plain-language confidentiality policy when information is collected by technological means, must be published | Each property record holds a privacy contact (title and address) that the guest app shows on a privacy page. HI Canada writes and approves the policies; Claude can draft them for HI Canada's review |
| 3.3 | A privacy impact assessment is required for any project to acquire, develop or overhaul an information system or electronic service delivery system that involves personal information. The privacy officer is consulted from the outset. The system must be able to give a person their computerized information in a structured, commonly used format. The assessment is proportionate to sensitivity and scale | HI CO is such a project, because staff accounts are personal information (section 2). The checklist in §7 is the engineering input to that assessment, not the assessment. From Stage 2 a "Download my data" button gives a guest a JSON file of the rows tied to their session |
| 3.5 to 3.8 | After a confidentiality incident: take reasonable steps to reduce harm; if there is a risk of serious injury, promptly notify the Commission d'accès à l'information and the people affected; keep a register of incidents and give the Commission a copy if it asks | The incident basics at the end of §7. HI Canada keeps the register; the audit log and Worker logs are the evidence behind it |
| 4, 5 | Decide the purposes before collecting. Collect only what is necessary, by lawful means | The data minimisation rule in §2 |
| 4.1, 14 | Under 14, a parent or tutor consents, unless collecting is clearly for the child's benefit. From 14, the minor can consent. Consent must be clear, free, informed, specific to each purpose, in plain language, requested separately from other information, and lasts only as long as needed | The 18+ attestation keeps under-18s out of the social features; the consent pattern in §5. Whether a self-attested check is enough is item 8 in §7 |
| 8 | At collection, say what the information is for, how it is collected, the rights of access and correction, and the right to withdraw consent. Name the third parties or categories that receive it and say it may be communicated outside Québec. On request, say who inside has access, how long it is kept and who the officer is | Each consent screen says these things (§5). While D1 is the store, the "outside Québec" line is true |
| 8.1 | Before collecting from a person with technology that can identify, locate or profile them, tell them it is used and how to activate those functions. "Profiling" is collecting and using personal information to assess characteristics such as work performance, economic situation, health, preferences, interests or behaviour | Those features are off until the guest turns them on, and the screen that offers the switch is the notice. Whether the on-device "Check I'm here" collects anything, when the position never leaves the phone, is item 10 in §7 |
| 9.1 | A technological product or service offered to the public that has privacy settings must default them to the highest level of confidentiality, without any action by the person. Browser cookie settings are excepted | D-04: every switch starts off. This is a statutory reason, not only a guideline |
| 10, 12 | Security measures proportionate to sensitivity. Using information for another purpose needs consent, and sensitive information (medical, biometric, or intimate by nature or by context, with a high expectation of privacy) needs express consent | Security is in `05` §14. Everything privacy-sensitive in HI CO is switched on by an express act. Whether a guest's position in the building is sensitive by context is for counsel `[U]` |
| 12.1 | A decision made exclusively by automated processing must be disclosed to the person, who may ask for the reasons and make observations to a staff member | HI CO makes no such decision. Hiding a reported post pending staff review, and rate limits, act on content and counters; counsel to confirm they are not "decisions" `[U]` |
| 17, 18.3 | Before personal information leaves Québec, or is entrusted to someone outside Québec to hold on the enterprise's behalf, an assessment is required (sensitivity, purpose, protections including contractual, and the destination's legal framework), with a written agreement reflecting it. Any service provider is engaged in writing, with protection measures, use only for the mandate, destruction at the end, immediate notice to the officer of any violation, and a right for the officer to verify | D1 and Durable Objects cannot be pinned to Canada `[V]`, so for a Quebec-facing property both sections apply to Cloudflare (items 2 and 5 in §7). A Montréal region would keep storage in Québec; see O-05 |
| 22, 23 | No commercial or philanthropic prospection without identifying yourself and offering withdrawal. When the purpose is achieved, destroy the information or anonymize it; anonymization must be irreversible, to accepted best practice and regulation criteria | HI CO sends no marketing. The purge job destroys rows on schedule. Aggregate counters hold no per-person row, which is the form of anonymization the design relies on; counsel to confirm `[U]` |
| 27 to 34 | A person can ask the privacy officer in writing for access and correction. The officer replies within 30 days, and silence is a refusal. Access is free apart from a reasonable copying charge. De-indexation of a hyperlink can be requested | HI Canada's officer receives these. Guest data is keyed to an anonymous session, so a request can be matched only if the guest supplies their session; "Download my data" covers the self-service case |
| 90.1, 90.12, 91, 92.1 to 93.1 | Administrative penalty up to $50,000 for an individual, or up to $10,000,000 or 2% of worldwide turnover (the greater) for others. Penal fines of $5,000 to $100,000 for an individual and $15,000 to $25,000,000 or 4% of worldwide turnover (the greater) for others, doubled for a repeat offence, with proceedings possible for five years. Directors and representatives who ordered or consented are parties to the offence. Intentional or grossly negligent infringement carries punitive damages of at least $1,000 | These are exposure figures for HI Canada's counsel, not forecasts |

- **Minors, HI Canada's policy.** HI Canada's own policy on minors and unaccompanied
  minors was not found `[U]`. The 18+ attestation (O-06) is the product's response, and
  it is self-attested, which is weak.
- **French.** Quebec's Bill 96 requires a French interface for Quebec-facing
  deployments `[R]` Guest Adoption Strategy.
- **Accessibility.** The target is WCAG 2.1 AA. The federal Accessible Canada Act is
  likely not binding on HI Canada, and Ontario's AODA and British Columbia's
  Accessible BC Act apply provincially `[R]` Second-Pass QA Audit; counsel to
  confirm.
- **Email.** HI CO sends no marketing. The only email is a staff sign-in or recovery
  message, which is transactional `[I]`.
- **HI Canada's marks.** Whether HI CO may use the name "HI" and the HI Canada logo is
  `[U]` (O-03).

## 4. Threat model

| Threat | Control | Proved by |
| --- | --- | --- |
| One property reads or edits another's data | Property from session or hostname only; repository layer; composite foreign keys (`05` §4) | Isolation suite; meta-test that every repository function is covered |
| A response exposes who posted something (LUME's SB-1) | Named projections; session ids never in public output | Anonymous-surface test |
| Someone works out where a guest is by combining distance readings (trilateration), or follows them | Tier 1 only: no person-to-person distance; no coordinates on the server | Network test: no request body contains latitude or longitude |
| Posts used to harass or to move a stranger to a private place | Opt-in; 18+ attestation; no free-form contact details; hide on report; per-session limits; property switch | Abuse tests: link, phone number, flood, repeat reports |
| Stored script in a display name or note | Output encoded as text; CSP forbids inline script | XSS payload tests across every user field |
| Bots flooding signals or gatherings | Session required; limits per session and per hashed address; QR rotation | Rate-limit tests |
| QR code photographed and posted publicly | Rotation, session revocation by code, short session life | Rotation and revocation tests |
| Staff account taken over | Passkeys; sessions revocable; role loaded per request; audit log | Auth tests; audit entries |
| Third-party script or beacon appears (LUME's SB-2) | No third-party scripts; strict CSP; post-deploy page check; zone auto-injection off | Deploy check (`11` §7) |
| Identifier enumeration | Random 128-bit ids | Test that no route accepts sequential ids |
| Cross-site request against a logged-in staff member | `SameSite=Lax`, `Origin` check, JSON-only writes | Request tests |
| Stale or invented information relied on | Verification stamps; expiry; placeholder marks; hide unverified offers | Content-rule tests; launch check |
| Package supply-chain attack | Lockfile committed; audit in CI; few dependencies | CI `npm audit` output reviewed at each phase |
| Secret leaks into git | Secrets only in `wrangler secret`; `.dev.vars` ignored; secret scan in `validate` | Scan in CI |

## 5. Writing the consent screens

- Shown at the moment the feature is first offered, not on a settings page nobody
  opens.
- Plain words, grade-8 reading level `[A]`, five facts in this order: what it does,
  what is shared, with whom, for how long, how to stop.
- "Not now" and "Turn on" are the same size and the same visual weight. Nothing is
  pre-selected.
- Each shows its text version; the version is stored with the consent so a change in
  wording re-asks.
- French is written with the English, not afterwards (`09` §6).
- If the Quebec Act applies (§3), each screen also names who holds the data
  (Cloudflare), says the data may be held outside Québec while D1 is the store, and
  shows the property's privacy contact (section 8 of the Act).

Worked example, English (property name is filled in from the property):

> **Send signals.** Let other guests at HI Vancouver Downtown see that you're up for
> something. Shared: the kind of plan, the place you pick, your display name and when
> it ends. Not shared: your phone's location, your room or bed. It ends by itself
> after 60 minutes and you can end it sooner. Turn this off any time in Settings.

## 6. Guest-written content

Display names: 2 to 24 characters, no links, not unique, not remembered between posts.
Gathering and signal text: length-limited, no links, no phone numbers or addresses
(pattern-checked and refused with an explanation), no images. Staff content about
third-party businesses (hours, a phone number) is public business information and
carries a verification stamp.

## 7. Privacy impact assessment and counsel checklist

HI Canada's privacy officer `[U — not yet named]` and counsel answer these. They are
grouped by when the answer is needed.

**Before Stage 0 goes to production.** Stage 0 stores no guest data. It holds staff
accounts, an audit log, aggregate counts and what staff publish.

1. Which privacy statute governs each property, does anything in Stage 0 trigger it
   (including whether the Quebec Act reaches Quebec-resident guests), and, if the Quebec
   Act applies, has the project assessment under its section 3.3 been done with the
   privacy officer?
2. Is storage in D1, which cannot be pinned to Canada, acceptable for the staff accounts
   held there, and, for a Quebec-facing property, is the assessment under section 17 of
   the Quebec Act needed before they are held outside Québec?
3. Is the retention schedule in §2 acceptable for staff accounts, the audit log and the
   counts?
4. Who at HI Canada owns a privacy incident, who decides on notifying people and the
   regulator, and who keeps the incident register that section 3.8 of the Quebec Act
   requires?
5. Is a data-processing agreement with Cloudflare in place or needed (section 18.3 of
   the Quebec Act requires a written contract with specified protections)?
6. Is the accessibility statement HI Canada needs to publish drafted?

**Before Stage 2** (sessions and guest posts exist):

7. Is the anonymous session token personal information? Is the cookie disclosure on the
   landing screen sufficient?
8. Is a self-attested 18+ check enough for Common Room, and what does HI Canada's policy
   on minors require?
9. Is the retention schedule acceptable for sessions, posts, reports and rate-limit
   counters?

**Before Stage 3:**

10. Does section 8.1 of the Quebec Act apply to the on-device "Check I'm here" and the
    Nearby view as designed, given that the position never leaves the phone, and is the
    notice on the consent screen enough?
11. Only if Tier 2 (distance bands between guests) is ever proposed: lawful basis, the
    trilateration risk, and a full assessment before any code.

Incident basics (the plan, not the law): stop writes (`read_only` flag), keep the logs,
tell HI Canada's privacy officer straight away, and let counsel decide on any
notification and its deadline. The application cannot make that decision. If the Quebec
Act applies, HI Canada records every confidentiality incident in a register (section 3.8)
and notifies the Commission d'accès à l'information and the people affected promptly
when there is a risk of serious injury (section 3.5).
