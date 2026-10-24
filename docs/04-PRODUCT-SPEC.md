# PRODUCT SPEC — HI CO

What the app does. Behaviour and acceptance criteria only; how it is built is in
`05-ARCHITECTURE.md`, what it may collect is in `06-PRIVACY-AND-COMPLIANCE.md`.
Numbers marked `[A]` are proposals for you to change, not findings.

## 1. Purpose

A guest of an HI Canada hostel should be able to open one page on their phone and
learn what is on this week, what staff recommend nearby, and, if they choose, meet
other guests without sharing more than they intended. It replaces the chalkboard
and cork board. It is useful to one guest on their own on day one (D-07).

## 2. Roles

| Role | How they get in | Can do |
| --- | --- | --- |
| Visitor | Opens the property link or a labelled QR link. No session in Stage 0 | Read What's On and Explore |
| Guest (from Stage 2) | Scans the property's QR code, which starts an anonymous session. No account | Everything a visitor can, plus whichever social features they have turned on |
| Staff editor | Staff login (method open: O-02) | Create and edit activities, places, offers; see the QR code |
| Property admin | Staff login | Everything an editor can, plus feature switches, staff invites, QR rotation, reports queue, content export |
| Operator | Martin, outside the app | Create and suspend properties, invite a property's first admin. Starts as reviewed scripts, not screens |

A staff member belongs to one or more properties and has a role in each. The console
acts on one property at a time, named in its address, and the server checks the staff
member's role in that property on every request. Nobody sees
or changes another property's data, including operators acting through the app.

## 3. Entry and sessions

- **Stage 0, no session.** Each property has QR codes for the door, desk, common room,
  kitchen and rooms. A code is a plain link to the property's app with a location label
  after the `#` in the address (for example `#l=desk`). Opening it shows the app, adds
  one to an aggregate count for that label and day (only labels the property has
  created count), then removes the label from the address bar. Nothing is stored about
  the guest and no cookie is set. The labels tell the property which placements bring
  guests back (`08` §4).
- **From Stage 2, sessions.** Social features need proof that the guest is at the
  property. A code then also carries an entry token. Scanning it starts an anonymous
  guest session (O-01 recommendation). A session carries no name, email or phone. It
  lasts `[A]` 14 days or until the guest clears it, whichever is first. Staff can
  revoke every session started by a given code.
- The first screen is in the guest's browser language if the property offers it,
  otherwise the property's default, with a visible language switch. The choice is
  stored on the device only.
- There is no account, sign-up, password or booking check anywhere in the guest flow.

## 4. Surfaces

### 4.1 What's On (Stage 0)

- A strip of seven days starting today **in the property's timezone**. A guest whose
  phone is set to another timezone still sees the property's day.
- Filter by category (Adventure, Social, Wellness, Culture, Outdoor).
- Each activity shows: title, time range, place within the hostel, host, a short
  description, and a cancelled or changed state when staff set one.
- Recurring activities repeat weekly at the same local time across daylight-saving
  changes. Staff can cancel a single date.
- "I'm In" saves the activity to the guest's own plan on their device (O-14). It
  shows nothing to anyone else and needs no session.
- Every screen shows when staff last updated it. Content older than `[A]` 7 days
  shows "Last updated 9 days ago — check at the desk" instead of looking current.
- The screen opens from cache with no network, and says it is offline.

Acceptance: switching days and filters takes under `[A]` 100 ms on a mid-range phone
throttled to four times slower than a typical laptop CPU (the G0 spike was waived, D-12,
so this is first measured on the real screens `[A]`, and then in CI). In the sandbox benchmark the work for a day switch was 6 to 8 ms with
6 cards and 83 to 92 ms with 200 cards at that slowdown, in all four frameworks
(`05` §2.1), so a day with hundreds of cards would need paging `[I]`. The list is operable by keyboard and screen reader; the day strip
and a recurring 8 pm activity are correct on both sides of each daylight-saving
change. The test takes those dates from the timezone database for the property's
zone and the year under test. It does not hard-code them.

### 4.2 Explore (Stage 0)

- Places grouped by Trails, Food, Drinks, Culture, Adventure. Staff pick is a label,
  not a score (O-13).
- Each place shows: name, category, staff note, how far it is **as staff describe it**
  ("12 min walk"), hours and phone only if staff supplied them, and a "Checked by
  staff on 12 October" stamp.
- "Open in Maps" is a plain link the guest taps. Nothing loads from a map provider
  until they do.
- Offers (a discount at a partner, a membership benefit) appear with the terms in
  plain words, the dates they are valid, and who confirmed them and when. An offer
  that is past its end date, or has not been checked within `[A]` 90 days, is hidden
  from guests and shown to staff with a "needs checking" flag.
- Search covers place and activity text in the guest's language.

Acceptance: no place shows a rating; nothing time-sensitive shows without a
verification stamp; an unverified item is visibly marked.

### 4.3 Settings and privacy (Stage 0)

- One screen lists every feature that uses anything about the guest, each with a
  switch that starts **off**: what it does, what it shares, with whom, for how long,
  and how to turn it off. The full list is the opt-in matrix in `06` §1.
- Actions a guest performs each time, such as "Check I'm here", have no standing
  switch: each use is a tap followed by the browser's own prompt.
- "Delete my data" clears everything stored on the device and, from Stage 2, ends the
  session and removes every row tied to it (`06` §2). From Stage 2, "Download my data"
  gives the guest a JSON file of every row tied to their session (`06` §3, section 3.3
  of the Quebec Act `[I]`).
- Language, text size and reduced-motion follow the device settings and can be
  overridden here.

### 4.4 Unlock your savings (Stage 1)

The membership moment. A guest who holds an HI Canada membership sees the member offers and a full-screen
"show this at the counter" view per offer. Until HI Canada can verify membership
(O-08), the guest declares it and the app never claims to have checked. "I used
this" is an optional tap that adds one to an anonymous count for the property.

### 4.5 Common Room (Stage 2)

Gatherings posted by guests: a hike, a board-game night, a cooking session.

- Requires a session, the 18+ attestation and the guest turning the feature on.
- A gathering has a title (up to `[A]` 60 characters), a description (`[A]` 280), a
  place from the property's named list, a start time within the next 7 days, and an
  optional capacity (`[A]` 2 to 20). No images, no links, no contact details: free
  text is scanned and a post with a link or phone number is refused with a plain
  explanation.
- The author picks a display name for each post. Names are not unique and not tied
  to a profile. The author's session is never shown to anyone, including staff,
  unless a report is being reviewed.
- Other guests can mark interest. Only the count is shown, never who.
- A post disappears when its event has passed, or at the property's closing-time
  cut-off the next day `[A]`, whichever is later.
- Limits per session `[A]`: 2 open gatherings, 5 posts a day.
- Report: any guest can report a post with a reason from a short list. **The post is
  hidden from everyone but its author at once** and marked "under review" for the
  author, until staff restore or remove it. This favours safety over availability
  and a malicious reporter can hide a post, which is why reports are rate-limited
  (`[A]` 3 a day per session) and staff can see report counts per session. An unwatched
  queue fails safe: hidden items stay hidden and expire with their event. That is how
  the "no queue that needs watching" rule and the "hide on report" rule fit together.
- A property admin can switch Common Room off, for example during a school-group
  stay. The switch takes effect immediately and posts disappear from guests' view.

### 4.6 Connect (Stage 3)

Signals: "I'm up for coffee in the Common Room in the next hour."

- Requires a session, the 18+ attestation, and the guest turning on **both** "Send
  signals" and, separately, "See nearby signals". Sending and seeing are different
  consents.
- Types: coffee, hike, food, explore, hang. A signal has a type, a place from the
  property's named list (including "Out and about"), an optional note of up to `[A]`
  80 characters, a display name, and an expiry `[A]` 60 minutes by default, 120 at
  most, set by the server.
- A guest can have one signal live at a time. They can end it early.
- Replying: a guest can tell the sender they are interested. The sender sees the
  responder's display name **only if the responder chose to share it** on that reply.
  Otherwise the sender sees "someone is interested" and the count. Nothing says
  "they will know you are coming" unless the reply really delivers that.
- No dorm, room or bed information exists anywhere in signals.
- Nearby view: see §4.7.
- Report, hide-on-report and the property switch work as in §4.5.

### 4.7 Nearby view and the radar (Stage 3, opt-in)

The prototype's radar draws people at random distances and angles. Production does
not fake proximity.

- **Tier 1 (O-04 recommendation).** The radar shows rings that mean *where people say
  they are*: "In the hostel", "A short walk away", "Further out". A signal sits on
  the ring that the place its sender chose belongs to (staff assign each place a ring). Position around the ring carries no
  meaning, is stable between refreshes, and the screen says in one line that rings
  show what people said, not measured positions.
- Every dot has a text equivalent: the same signals appear as an ordered list, and
  the list is what screen readers get.
- Optional on-device check: "Check I'm here" asks the browser for the phone's
  position once, compares it with the property on the phone, and tells the guest
  whether they appear to be at the hostel. Coordinates are never sent. The result
  is a convenience for the guest, not proof of anything, and gates nothing (`07` §4).
- **Tier 2** (distance bands between consenting guests) is not part of this spec.
  It returns only if a pilot shows Tier 1 is not enough and the privacy impact
  assessment in `06` §7 is done.

### 4.8 Staff console

Reached at a separate path, behind staff login.

- **Board.** Add, edit, cancel and duplicate activities; weekly recurrence; capacity
  (shown to guests only once Stage 2 is on). A change is live on save.
- **Places and offers.** Create and edit. Saving stamps who and when. A "re-verify"
  action stamps today's date without editing text. A list view sorts by oldest check.
- **Translations.** Each text field shows English and French side by side, with a
  marker where French is missing.
- **Places in the hostel (zones).** Name each in English and French and assign it a
  ring (in the hostel, a short walk away, further out).
- **QR codes.** View and print a code with its location label (Desk, Common Room,
  Rooms). In Stage 0 a code is a labelled link. From Stage 2, rotating a code stops it
  creating sessions straight away; existing sessions keep working unless the admin also
  revokes them.
- **Feature switches.** Per property: Common Room, Connect, Nearby view, each
  default off. Changing a switch writes an audit entry.
- **Reports** (Stage 2 onward). Hidden posts with the reason and the count of reports
  on that session, restore or remove.
- **Audit log.** Who changed what and when, read-only, kept `[A]` one year.
- **Export.** The property's content as one file, for its own records.

Acceptance: an editor on property A cannot read, list or change anything on property
B by any request, tested by script (`05` §4).

## 5. States every screen has

Loading, empty ("Nothing on today. Check tomorrow."), error with a retry that does
not lose input, offline, stale content, and "feature is off for this property".
Skeleton placeholders reserve space so the page does not jump.

## 6. Accessibility acceptance (WCAG 2.1 AA, `[I]` as the target)

- Semantic elements first: `button`, `nav`, `main`, `h1` to `h3`, lists. ARIA only
  where semantics fall short.
- Every interactive element works with keyboard alone and shows a visible focus ring.
- Sheets and dialogs: `role="dialog"`, labelled, focus moves in, stays in, returns
  on close, Escape closes.
- Body text at least 16 px; nothing below 12 px. Touch targets at least 44 by 44 CSS
  pixels.
- Text contrast 4.5:1 (3:1 for text 24 px and over, or 19 px bold and over). The
  prototype's white-on-green primary button measures 2.66:1 and fails; dark text on
  the same green measures 5.82:1 (`02` §2, row 13).
- Meaning is never carried by colour or emoji alone. Emoji have text alternatives.
- Honours `prefers-reduced-motion`; no decorative particles when it is set.
- Works at 360 px width and at 200% text zoom without horizontal scrolling.
- Live regions announce toasts and the result of "Check I'm here".
- Automated checks (axe) run in CI. They catch some problems, not all; a human audit
  with a screen reader is a Phase 8 gate.

## 7. Performance budget `[A]`

Initial JavaScript for the guest app at most 60 KB gzip (the prototype ships 71 KB
and contains one screen's worth of data). Largest Contentful Paint at most 2.5 s,
Interaction to Next Paint at most 200 ms, Cumulative Layout Shift at most 0.1, on a
mid-range Android phone with throttled mobile network `[I]` (the "good" thresholds
for these Core Web Vitals; not re-fetched this session). G0 was waived (D-12), so the
proposed 60 KB stands `[A]` until the real app is built; the sandbox build of one plain
screen was 6.4 KB gzip in Preact (`05` §2.1).

## 8. Stages

The order follows `08-ADOPTION-STRATEGY.md`. A stage ships only when the one before
has met thresholds that **you set with HI Canada before Stage 0 launches** `[U]`. This
document does not invent them.

| Stage | Contains | Build phase |
| --- | --- | --- |
| 0 | What's On, Explore, settings, offline, French | 2, 3 |
| 1 | Unlock your savings, offer redemption count | 4 |
| 2 | Shared RSVP counts, Common Room, reports | 5 |
| 3 | Connect, Nearby view, on-device check | 6 |
| Later | Wallet pass | 7 |

## 9. Not in this product

No points, badges, streaks or leaderboards. No profiles that outlive a stay. No
always-on map. No group chat that outlives a stay. No native app. No booking check
before a feature. No push notification for anything core. No images or links in
guest content. No third-party tracking of any kind.

## 10. How we will know it works

All of these are hypotheses until a pilot measures them; none is a claim.

- A guest alone on day one opens What's On and finds something to do.
- Staff keep the board current without it becoming a chore (measured in minutes a
  week the board takes, as reported by the property).
- Guests re-open the app from the in-hostel QR codes.
- No incident of a guest being located, contacted unwillingly or exposed.

Counts come from the first-party aggregate counters in `05` §10. No per-person
tracking exists to count with.
