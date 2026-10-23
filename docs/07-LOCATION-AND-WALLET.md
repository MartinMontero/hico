# LOCATION AND WALLET — HI CO

What a web app can and cannot do about "tell me when I'm near". Source: the
geofencing feasibility report supplied by Martin (`[R]` throughout this file unless
marked), plus the Apple and Cloudflare facts verified on 2026-10-23.

**Wording rule.** Never describe geofencing as a reliable proximity alert. The honest
sentences are: "Your phone may nudge you when you are near" (Wallet), and "Check I'm
here tells you, on your phone, whether you appear to be at the hostel."

## 1. Two separate problems

- **A. Geometry.** Is this point inside that circle? Trivial: the haversine distance
  formula, a few lines, correct to well under the accuracy of a phone's position.
- **B. Waking up.** Getting the phone to notice, with the app closed, that it has
  entered an area. This is the hard problem and a browser cannot solve it. A web page
  can read the phone's position only while the page is open and in the foreground. On
  iOS especially there is no web route to background location. The W3C Geofencing API
  that once promised it is obsolete `[R]`.

No commercial location API (Google, TomTom, Mapbox, HERE, Progressier, Radar) solves
problem B for a web app, because they all depend on an installed native app `[R]`.
HI CO has no native app (D-09), so problem B is solved only by the layers below.

## 2. Layers, in the order HI CO uses them

| Layer | What it does | Reliability | Status |
| --- | --- | --- | --- |
| 0. Nothing | The default. No location used | n/a | Always the starting state |
| 1. On-device foreground check | Guest taps "Check I'm here"; the phone compares its position with the property | Good when asked, accurate to the phone's accuracy figure | Stage 3 |
| 2. Wallet pass | The operating system may show the pass on the lock screen near saved places | Best effort, passive, rate-limited | Later (Phase 7) |
| 3. Scheduled web push | A reminder at a set time | Not relied on; delivery was reported at about a third for web push, a vendor figure `[R]` unverified | Not built |
| 4. Physical QR code | Door, desk, rooms. The guest scans to return | Depends on a guest scanning; no technology risk | Stage 0 |
| 5. Captive portal | Hostel wifi landing page | Enrolment only, not retention `[R]` | Out of scope here |
| Rejected | A Capacitor native wrapper | Reintroduces an app store and a native app | D-09 |

## 3. Layers 3 to 5 in one line each

Push is not relied on for anything core. QR codes are the re-entry route. A captive
portal could introduce the app on arrival but is a property wifi project, not part of
this build.

## 4. Layer 1 — "Check I'm here"

Behaviour:

1. The guest taps the button. Nothing is requested before that.
2. The app calls the browser's one-time position request. The browser shows its own
   permission prompt. If the guest refuses, the app says so plainly and does nothing
   else; it does not ask again in the same visit.
3. The phone returns a position with an accuracy radius. The app computes the distance
   to the property's stored centre. If the distance is inside the property's radius
   **and** the accuracy radius is small enough to mean something `[A]` 150 m or better,
   it says "You appear to be at HI Vancouver Downtown." If the accuracy is too coarse
   it says "Your phone can't tell right now." Otherwise it says "You appear to be
   away from the hostel."
4. The position is then discarded. It is not stored on the device, not sent, not
   logged.
5. The result announces itself to screen readers.

Rules:

- The check gates nothing. A position can be faked and a hostel sits in a city block
  where accuracy is poor. Proof of presence is the QR code.
- Centre and radius are per-property settings that staff maintain.
- Unit tests cover the distance function against fixed points at known distances, and
  a network test proves no request body contains latitude or longitude.

## 5. Layer 2 — Wallet pass (Phase 7)

What it is: a pass in Apple Wallet or Google Wallet carrying locations. The operating
system, not HI CO, decides when to show it.

Limits as reported:

| | Apple Wallet | Google Wallet |
| --- | --- | --- |
| Locations per pass | 10 | Not stated in the report |
| Distance that triggers it | About 100 m for loyalty and coupon passes; about 1 km for event tickets and boarding passes | Not stated |
| Behaviour | Best effort, passive | About 4 notifications a day, and the feature has been switched off at times |
| Cost | Apple Developer Program, $99 USD a year `[R]`; a waiver may exist `[U]`: Apple's own fee-waiver pages returned "not found" on 2026-10-23 | `[U]` |

The 10-location cap can be worked around by updating the pass remotely. Apple's
mechanism `[V]` Apple documentation read 2026-10-23: the device registers with a web
service and gives a push token; the service sends an empty push through the Apple
Push Notification service, signed with the Pass Type ID certificate and with the
pass type identifier as the topic; the device then calls the service to fetch the
updated pass. Registration and fetch calls carry an `ApplePass <authenticationToken>`
header, and the update tag must move forward consistently.

**Not verified, and each needs a spike before anything is built:**

- Sending the push to Apple from a Cloudflare Worker with the pass certificate. The
  Workers mTLS binding presents a client certificate through `env.BINDING.fetch()` `[V]`
  Cloudflare docs, but the documentation says Cloudflare-proxied origins return a 520,
  and it does not state which ports and hostnames are allowed. Whether Apple's push
  service answers on port 443 or only 2197 `[U]`.
- Signing a `.pkpass` file inside a Worker `[U]`.
- Google Wallet class and object creation with a service-account token `[U]`.
- **Fallback if the Worker cannot do it:** a small relay outside the Worker that holds
  the certificate and sends the pushes. This adds a server to run and a secret to
  guard, so it needs Martin's call before it is built.

What the pass would contain: the property's name, the "Today's board" link, and up to
nine partner-venue locations with the offer text. **No personal data and no
membership data.** The pass serial is random and not linked to a guest session.
Registering a pass gives Apple or Google the device's push token for that pass; the
opt-in sheet says so (`06` §1).

The issuing account is a decision (O-15).

## 6. Membership card and the questions for Cobber

HI Canada's membership card is issued through the Audience portal
(`hicanada-member.audie.nz`), reached through a chain of platform owners that ends with
Cobber (formerly ResPax) `[R]` Guest Adoption Strategy. No public API was found `[R]`.
Until the answers below exist, HI CO treats membership as something the guest says,
never as something it has checked (O-08).

Four questions, to be put to Cobber through HI Canada:

1. Is there a real-time membership verification API? What does it return and how is
   it authenticated?
2. Can the Audience platform issue Apple Wallet and Google Wallet passes for member
   cards, or allow a third party to?
3. Is there an endpoint to log a discount redemption against a membership?
4. What are the data-residency terms for membership data?

Do not describe an integration to anyone as agreed or planned until HI Canada says it
is in writing.
