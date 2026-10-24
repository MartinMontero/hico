# CONTENT AND ONBOARDING — HI CO

How content is structured, how it stays honest, and how a property goes live.
Labels as in `00-README.md`.

## 1. Content types

Staff are the authors. Every text field exists in English and French.

| Type | Fields (all text length-limited) | Notes |
| --- | --- | --- |
| Property | Name EN/FR, slug, hostnames, IANA timezone, address, supported languages, privacy contact title and address, centre and radius for the on-device check | Set by the operator, edited by the admin |
| Zones | Label EN/FR, ring | The named places in the hostel (Common Room, Deck, Kitchen, Lobby) plus "Out and about". Each belongs to one ring: in the hostel, a short walk away, or further out. "Out and about" is further out |
| Activity | Title, description, category, offered at (one or more properties, D-15), zone or place, host label, start and end or weekly recurrence with local time, capacity (optional), status (active or cancelled), verified-on, verified-by | Cancelling one date does not delete the series |
| Place | Name, category, staff pick, staff note, walk time as text, hours text, phone (optional), "open in maps" address, verified-on, verified-by | No rating |
| Offer | Partner name, terms in plain words, valid from and to, requires-membership flag, how we know, verified-on, verified-by | Hidden from guests if expired or unchecked for 90 days `[A]` |
| QR code | Location label, created, retired | In Stage 0 a code is a labelled link (`/p/<slug>#l=<label>`) the console draws as a QR code and prints; no token exists. Rotating a code and ending its sessions arrive in Stage 2 (Phase 1b-2 point 3). The entry token, shown once with only its hash kept, comes with guest sessions |

An activity can be offered at more than one property (D-15). It is one record with one set of
verification stamps. The zone or place it meets at belongs to one property.

Who may edit it (D-23): the activity has an owner property. Staff with `editor` or `admin` at any
property that offers it may edit its content (text, time, status, cancelled dates, verification
stamps), acting under that property in the path. Only an `admin` of the owner changes the
offered-at list or deletes it. Cancelling a date cancels it for every property that offers it.
Removing a property from the list removes the activity from that property at once.

Images are not part of Stage 0. Uploaded images need storage, review and
moderation; they come only if a property asks and staff have the time (`[A]`).

## 2. Provenance rules

1. Anything a guest might rely on (hours, prices, discounts, phone numbers, event
   times) has `verified_on` and `verified_by`. Saving an edit sets them, from the
   signed-in person and the server's clock: a request cannot supply them, and a test sends
   forged ones on every create, update and re-verify. A "re-verify" button ("Still correct")
   sets them without editing. The console marks a board item or a place "Check overdue" past the
   expiry in rule 3, and shows an offer as hidden from guests once it is past it.
2. The guest screen shows the stamp in words ("Checked by staff on 12 October"). It never
   shows the staff member's name; the name is for staff and the audit log.
3. Past the expiry (`[A]` 90 days for places and offers, 7 days for the board) the
   item says "Check at the desk" or is hidden, as `04` specifies. It never looks
   current when it is not.
4. Placeholder rows have `is_placeholder = true`. Placeholders render with a visible
   "Sample content" band. A production database must contain none; the launch check
   fails if any is found.
5. Ratings do not exist (O-13). Staff pick plus a note takes their place.
6. Nothing is copied from a third-party site without its terms being read and noted.

## 3. Onboarding a property

The property supplies the following. Nothing here tells a General Manager how to run a
hostel; it lists inputs.

1. **Identity.** Name, address, timezone, languages offered, privacy contact.
2. **People.** Who will be the admin, who the editors, who owns the weekly update and
   who looks at reports (O-09).
3. **The board.** Next two weeks of activities, with times, places and recurrence.
4. **Places.** Ten to twenty places staff would send a guest to, each with a note and
   hours checked within the last month `[A]`.
5. **Offers.** Only those the property can vouch for, with terms and end dates.
6. **Zones.** The names guests use for rooms and areas, which are shared spaces, and
   the ring each belongs to.
7. **QR plan.** Where codes go, one label each.
8. **Switches.** Stage 0 launches with Common Room and Connect off.
9. **Baseline numbers** for the stage gates (`08` §6), as HI Canada can supply them.
10. **Launch date and the first review date.**

Operator steps, run by Martin through scripts that Claude Code writes and Martin
approves: create the property, add its hostnames, create the first admin invite,
load zones. The first admin takes it from there.

## 4. HI Vancouver Downtown (first tenant)

Facts, with their status. Re-verify with the property before any is shown to a guest.

| Fact | Status |
| --- | --- |
| Address 1114 Burnaby St, Vancouver, BC V6E 1P1 | `[V]` hihostels.com listing, 2026-10-23 |
| In the West End, about a block from Davie St., two minutes' walk from English Bay beach | `[V]` same listing |
| 4-bed shared dorms and private rooms | `[V]` same listing |
| Free wifi, coworking space, shared kitchen, games room with billiards, patio, library | `[V]` same listing (the listing says "sunny patio") |
| No hostel-run activities listed on the listing | `[V]` same listing |
| 232 pillows; reopened June 2023 after a three-year closure; 24-hour front desk; free continental breakfast 7 to 9; rooftop patio; TV lounge | `[I]` from an earlier research note (30 May). Not on the listing page read today. Treat as unverified |
| The General Manager of both Vancouver hostels is Rhian | `[R]` Martin, 2026-10-23, who confirmed the spelling. The surname in the earlier note is `[I]` and is not confirmed; do not use it |

Downtown has **no content yet** for the app. Its first board, places and offers come
from the property, not from the prototype's Whistler content (`02` §3).

## 5. The demo tenant

A seed property, `demo-whistler`, is built from the prototype's data for development
and testing only. Ratings are dropped, every row is marked `is_placeholder`, every
verification field is empty, and the guest screens carry the "Sample content" band.
It is never deployed to production. Invented guest names in the prototype
("Lisa K.", "Marco P.") are not carried over.

When HI Whistler becomes tenant two (Phase 8), its real content replaces the seed and
every item is verified by Whistler staff first. The café there is spelled
**Cheaky's Cafe** (D-14, which supersedes D-03; the prototype source, line 71, spells it Cheekye's and is wrong on this point `[V]`).
The Life Member page lists 15% off food and drink at HI Whistler's café for Life
Members `[V]` 2026-10-23; the terms and whether they apply to the app's offer are for
Whistler and HI Canada to confirm.

## 6. Translation

- Staff write in English or French. The editor shows both side by side and marks
  what is missing.
- A model may draft the other language. A draft is never published as final. The
  French draft carries a "needs review" flag until a native Québécois speaker has
  approved it. That review is a **hard gate before any Quebec-facing deployment**; for
  Downtown it is a quality gate, not a legal one `[I]`.
- The lookup rule is in `05` §13. A build test fails if any interface string ships
  without French.
- Other languages (Spanish, Japanese, Korean, German) are added per property, one at a
  time, each with its own review (O-10).

## 7. Weekly rhythm `[A]`

The editor opens the board, copies last week's recurring items forward, edits
anything that changed, cancels what is off, and checks the "needs checking" list. The
aim is under fifteen minutes a week. This is a target to test with Downtown, not a
finding.

## 8. Launch check

A script (`scripts\launch-check.ps1`, Phase 3) produces a pass or fail with the
evidence for each line:

- No placeholder rows in the production database.
- Every guest-visible item has a verification stamp inside its expiry.
- Every interface string and every guest-visible content field has French.
- Feature switches match the agreed stage.
- At least one QR code with a location label exists, and a test visit to its link
  opens the app, adds to the aggregate count and sets no cookie (from Stage 2 it also
  creates a session).
- Security headers and the content policy are as specified.
- The live page contains no third-party host and no analytics beacon.
- The accessibility checks pass at 360 px and with the keyboard.
- The bundle is within the performance budget.
- The retention purge job ran in the last 24 hours.
