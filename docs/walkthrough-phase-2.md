# Walkthrough — the guest app at 360 px and by keyboard (Phase 2)

Written 2026-10-25 by Claude Code. Driven in Chromium at 360 by 740 (`tests\e2e\guest.spec.ts`, 14 tests, plus `shell.spec.ts`).
Screenshots are in `docs\screenshots\phase-2\` (recreate with `HICO_SCREENSHOTS=1` set before
`npx playwright test tests\e2e\guest.spec.ts`). **Not done:** a real phone, VoiceOver or TalkBack, installing the app to a
home screen, scanning a real printed QR code, a slow real network. Those are `[U]`.

## What I saw

1. **Hostel choice** (`01`). Three links on a bare screen: Whistler, Vancouver Downtown, Vancouver Jericho Beach. The
   header shows only Settings: no logo, no HI mark (D-21).
2. **What's On** (`02`). Property name as text, four tabs, an amber "Sample content. Staff have not checked it yet." band,
   the heading, a seven-day strip with today underlined, category buttons (All, Adventure, Social, Wellness, Culture,
   Outdoor), a search box, a "Show only my plan" toggle, then the day's cards. Each card has the title, the time, the
   description, where it meets, the host, the stamp ("Not checked yet. Ask at the desk." for seeded rows) and an "I'm In"
   button. Nothing says how many people are going (D-18).
3. **My plan** (`03`). After "I'm In" on Friday's Trivia Night and "Show only my plan": the toggle turns green and only that
   card shows. The plan is in the browser's storage on that device and in no request.
4. **Explore** (`04`). Category buttons, a search box, a "Places" heading with cards (name, a gold "Staff pick" label, the
   note, walking time, the stamp) and an "Offers" heading below. A place with a staff-supplied address has "Open in Maps",
   a plain link. No stars, no scores anywhere.
5. **Settings and privacy** (`05`). A sheet with language, then Privacy: a plain statement that the app saves nothing about
   you on its server, then nine features each with a disabled, unchecked switch and "Not available at this property yet", a
   "What this would do" disclosure with the five facts in order, the privacy contact (here the amber placeholder, because
   none has been supplied), "Add to home screen" help, "Delete my data" and Close.
6. **French** (`06`). The same screen in French: tabs "Au programme, Explorer, Salle commune, Rencontres", days "dim. lun.",
   categories, search, toggle, card. A toast "Langue : Français" shows at the top for four seconds.
7. **Offline** (`07`). With the network off and the page reloaded: the page opens from the kept shell, an amber "You are
   offline. Showing what was loaded last." band appears above the content, and the last places are shown.
8. **Delete my data** (`08`, `09`). A confirmation sheet ("It cannot be undone. The app saves nothing about you on its
   server, so there is nothing to delete there.") with Delete and Cancel; after Delete the sheet says it is done and has a
   Close button, which reloads the page.

## What it did and did not do, checked

- **QR link.** `/p/demo-whistler#l=desk` sends exactly `{"label":"desk"}`, removes the fragment from the address bar, sets no
  cookie, stores nothing (no local or session storage, no database), and adds one to the count for that label and day. A
  label nobody created adds nothing.
- **Offline.** The service worker keeps only the public reads, the built files and the page shell. A test visits the staff
  sign-in page and asks for a staff API route, then lists what was kept: nothing from the staff area.
- **Delete my data.** At the moment of deletion there is no stored key, no cache and no service worker registration.
  After the reload the app is a first visit again, so it registers its service worker again and keeps new copies. That is
  the normal first visit, not data about the guest.

## By keyboard only

- A keyboard walk reaches the Saturday day button by Tab, Enter shows its cards, a further Tab sequence reaches "I'm In",
  Enter saves it, Settings opens by Enter and Escape closes it with focus back on the Settings button.
- Settings and the delete confirmation are the Phase 1 dialog: focus moves in, Tab stays inside, Escape closes.
- Not a test: pressing the search box, the category buttons and the plan toggle by keyboard. They are native buttons and an
  input and axe finds nothing, but no script presses them by keyboard.

## axe (serious or critical, WCAG 2.0 and 2.1 A and AA)

Zero on: hostel choice, What's On, empty search state, only my plan, Explore, Settings and privacy, What's On in French,
Explore in French, not found, Connect (not turned on), Explore offline, the delete confirmation. Common Room (not turned on) was\nloaded but not scanned by axe.

## Lighthouse mobile (simulated slow 4G, 4x CPU; median of three runs; printed, not enforced)

| Page | LCP | TBT | CLS |
| --- | --- | --- | --- |
| What's On | 2045 ms | 0 ms | 0.000 |
| Explore | 2169 ms | 0 ms | 0.035 |

The 2.5 s, 200 ms and 0.1 figures in `04` §7 are the "good" Core Web Vitals thresholds `[I]` and have not been set by Martin.
TBT stands in for INP, which a lab run cannot measure.

## Found while walking, and fixed

- French tab labels were cut in half at 360 px ("program-me", "Rencontre-s"). They now keep each word whole and wrap to two
  rows at large text sizes. A test checks it.
- The page language attribute was set a frame after the text, so a screen reader could read French in English for a moment.
  It is now set in the same frame.
- A deleted-data page refilled its own caches because the service worker was still serving it. Deleting now ends on a
  reload.
- Staff responses carried no `Cache-Control`, so the "second line of defence" a test asserted did not exist. Every
  response under `/api/staff/` is now `no-store`.

## What I did not like, and left

1. **The toast covers the header.** At the top for four seconds, it can sit over the Settings button right after a
   language change.
2. **Disabled switches look like plain checkboxes.** They are real switches to a screen reader, but the sighted look is a
   grey square, not a switch.
3. **The language radios in Settings sit slightly off their labels.** This was there before Phase 2.
