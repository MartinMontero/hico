# ADOPTION STRATEGY — HI CO

Why HI CO is staged the way it is, what it will not do, and the facts the strategy
rests on. The full evidence base is the Guest Adoption Strategy and the Second-Pass
QA Audit supplied with this project; this file is their current position. Where a
figure here is marked `[R]` it comes from those documents and was not re-checked.

## 1. The problem a social app has in a hostel

A guest stays a short time. The app is useful to them only if it is useful on the
first night, alone, before anyone else has used it. A feature that needs other guests
to have already joined shows an empty room to the first guest at every property, and
an empty room teaches them not to come back. So the first release helps one person,
and each later stage is switched on only after the earlier one has shown it is used.

Typical length of stay, how many guests arrive alone, and how many already hold a
membership are not known for any HI Canada property `[U]`. HI Canada holds them
(O-11). Do not substitute industry figures in documents that go outside this project.

## 2. Single player first (D-07)

Stage 0 contains nothing that needs a second user: what is on this week, what staff
recommend, and the offers on hand with their terms. A guest alone at 11 pm after the desk has
closed, opening the app from a code on the door, should find something useful.
What an unstaffed late arrival needs from the app beyond that is open `[U]` and
belongs in the first conversation with the property.

## 3. The reason to open the app on day one

The strongest candidate is **Unlock your savings**: the moment a guest learns what
their HI Canada membership is worth and where to use it. `[R]` The adoption strategy
reports that a one-night stay earns a free two-year HI Canada membership. That claim
is **not confirmed**: the HI Canada About page and the Life Member perks page, read on
2026-10-23, do not mention it `[U]`. Confirm the offer's exact terms with HI Canada
before any screen states it.

What the Life Member perks page does say `[V]` 2026-10-23: two vouchers for 50% off a
one-night stay at association-owned hostels (up to $100 off per reservation), a $50
refer-a-friend voucher, 15% off food and drink (not alcohol) at the cafés at HI Lake
Louise, HI Whistler and HI Banff on showing a Life Member card, and a free legacy
pin. That is the Life Member programme, which may not be the membership a stay earns.
Do not mix the two.

Whether an unactivated membership is a real, common problem for HI Canada guests is a
hypothesis `[A]` until HI Canada supplies activation numbers.

## 4. Bringing guests back: physical QR, not push

Re-entry is by scanning a code on the wall, not by a notification. Web push delivery
was reported at about a third, from a vendor `[R]`, which is unverified, and push
needs a permission most guests will not give. Codes go where guests already stand:
the front desk, the common room, the kitchen, the rooms `[A]`. Each code has a
location label so the property can see, in aggregate, which placements work.

## 5. Membership

Until HI Canada can verify membership in real time (O-08), HI CO treats it as a guest's
statement and stores it on their device only. Member offers are shown to everyone with
their terms; the app never claims the guest is a member. "I used this" is optional and
adds one to an anonymous count. See `07` §6 for the questions to Cobber.

## 6. Stages and what must be true to move on

| Stage | Contains | Moves on when |
| --- | --- | --- |
| 0 | What's On, Explore, offers shown with terms, offline, French | A measure of use, a baseline and a threshold agreed with HI Canada before launch `[U]` |
| 1 | Unlock your savings, redemption count | Same |
| 2 | Shared RSVP counts, Common Room, reports | Same, plus a privacy officer's sign-off on `06` §7 |
| 3 | Connect, Nearby view, on-device check | Same, plus the assessment in `06` §7 |

Each stage's gate has four parts, written down before the stage ships: the measure,
today's baseline, the threshold, and the window it must hold over. **This document
sets none of them.** Any number written here without those four parts would be a
guess.

## 7. The anti-roadmap

These are decided, not postponed.

- No points, badges, streaks, leaderboards or rewards for using the app.
- No profile that persists between stays.
- No always-on map and no live positions of people.
- No group chat, and nothing that outlives a stay.
- No native app and no app-store install.
- No requirement to book or hold a membership before a feature works.
- No reliance on push notifications for anything a guest needs.

## 8. Facts to use, and facts not to repeat

Use these, with their dates.

| Fact | Status |
| --- | --- |
| HI Canada's About page says the network has 39 hostels and, elsewhere on the same page, "about forty" | `[V]` 2026-10-23. Quote "39" or "about 40" with the date |
| The same page gives two worldwide figures that disagree (over 3,000 hostels in 61 countries; 2,100 in over 50) | `[V]`. Quote neither until HI Canada supplies one |
| Hostelworld reports 3 million members and FY2025 net revenue of €93.8m | `[R]` |
| iOS accounts for 60.31% of Canadian mobile traffic (StatCounter, 2026) | `[R]`. Test on iPhone Safari first |
| Quebec's Bill 96 requires a French interface for Quebec-facing deployments | `[R]`. Launch blocker for Quebec |
| HI Whistler peaks in winter; HI Vancouver Jericho Beach in summer | `[R]`. Content calendars differ by property |

Do not repeat these.

- **"70 to 85% of travel loyalty value goes unused."** Airline disclosures run from
  about 17 to 24% (United 18%, Alaska 17.4%, AIR MILES 24.5%) `[R]`. A figure of about
  30% attributed to The Bond is unverified `[R]`.
- **Any claim of adoption, redemption or turnout.** None has been measured.
- **Any statement that HI Canada, Cobber or a partner has agreed to something.**

## 9. Open operating questions

None is solved by software; each shapes the build.

- Staff labour: who updates the board each week, and does it fit the time they have?
  (O-09)
- A guest arriving at 11 pm with no one at the desk (§2).
- Poor wifi in hostels: why read paths must work offline (`04` §4.1).
- Who pays for hosting and development, and who owns the code (O-07).
- HI properties host minors and school groups `[R]` Guest Adoption Strategy. HI
  Canada's policy on minors was not located `[U]`. Connect and Common Room stay off by
  default and adult-gated (O-06).
- Different seasons by property: the same app, different content calendars.
