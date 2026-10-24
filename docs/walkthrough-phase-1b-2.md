# Walkthrough — staff console at 360 px and by keyboard (Phase 1b-2)

Written 2026-10-24 by Claude Code. The console was driven in Chromium at a 360 by 740 viewport with a virtual
authenticator (`tests\e2e\staff-console.spec.ts`, 12 tests, all passing; `staff-auth.spec.ts`, 9 tests, for sign-in).
I looked at the ten screenshots in `docs\screenshots\phase-1b-2\` (recreate them with `HICO_SCREENSHOTS=1` set before
`npx playwright test tests\e2e\staff-console.spec.ts`). **Not done:** a real phone, a real security key, a screen
reader, scanning a printed QR code. Those are `[U]`.

## What I saw at 360 px

- **Overview** (`01`). The hostel name, a wrapped block of navigation buttons, then three cards: "Board: 3 activities
  overdue for a check", "Places: 0 overdue", "Offers: 0 not shown to guests". Nothing scrolls sideways.
- **Board** (`02`). One card per activity: title, "Every Sunday, 19:00 · Lobby", chips ("Shared with 2 hostels",
  "Check overdue", "Sample content"), the check line ("Never checked" for seeded rows), then buttons: Edit, Still correct,
  Cancel a date, Cancel the series, Copy, Where it shows, Delete. They wrap to two or three rows.
- **Add or edit** (`03`). A bottom sheet with labelled fields. The first field has focus and a visible focus ring. French
  fields say "Leave the French empty to show the English to French readers." The sheet scrolls inside itself.
- **Conflict** (`04`). When a second person saves first, a sheet titled "Someone saved first" lists only the fields that
  differ, "Yours" and "Saved now", with three buttons: save mine over theirs, use the saved version, cancel.
- **Where it shows** (`05`). The owner hostel is tagged "owner"; the other has "Stop showing here". "There is no other
  hostel where you also work" explains why nothing can be added.
- **Places, QR code, invite link, audit log, French** (`06` to `10`). The QR code is black on white with a quiet zone, the
  label and the link under it, Print and Close below. The invite sheet shows the QR code, the link in a read-only field
  (selected on focus), and Copy. The audit log reads "Invite link created", "Switch turned on", with the time in the
  hostel's time zone and the person. French screens fit the same width ("Toutes les auberges", "Ajouter une activité").

## By keyboard only

- Every dialog: focus moves in when it opens, Tab and Shift+Tab stay inside (25 Tab presses checked), Escape closes it,
  and focus returns to the button that opened it (checked for "Cancel a date" and "Add an activity").
- Choosing a screen from the navigation moves focus to its heading, so a screen reader starts at the new page.
- The add form was completed with Tab, typing and Enter alone; Enter in a text field saves.
- After a delete the opener is gone, so focus moves to the page heading (code path; the delete itself is checked at the
  server, and the dialog by the same pattern, but a keyboard-only delete was not a test).

## axe (serious or critical violations, WCAG 2.0 A, AA and 2.1 A, AA)

Zero on: sign-in, accept link, overview, board, activity form, conflict, cancel a date, where it shows, places, place
form, offers, zones, translations, QR codes, QR dialog, switches, invite link, people, audit log, export, French board.
Any new colour pair went through the contrast gate (`ink` on `paper`, 21:1).

## What I did not like, and left

1. **The navigation was tall at 360 px (fixed after the walkthrough, D-31: a "Menu" button).** The screenshots were taken before the fix and still show the wrapped buttons. It was: Eleven buttons wrap to five rows and push the content down by about 330 px
   before the first card. Targets are 44 px, so it is correct, but it is not good. A "Menu" disclosure or a select would
   fix it; that is a design choice, so it is yours.
2. **A toast now appears at the top** (it covered the buttons of a bottom sheet when it was at the bottom). For four
   seconds it can sit over the Settings button.
3. **Dates show in the hostel's time zone only.** A staff member on a different clock sees the hostel's time, as the rules
   say; the board says "Times on this page are in America/Vancouver."
