# MISSING ITEMS — HI CO

What a property, HI Canada or Martin still owes before the app can say something true. The app shows a visible placeholder
for each of these rather than inventing an answer. One row per item; remove a row only when the thing is supplied and shown.

## Per property

| Property | Item | Where the app shows the gap | Who supplies it | How it gets in |
| --- | --- | --- | --- | --- |
| Whistler (`demo-whistler`) | Privacy contact (title and address) | Settings and privacy: "This property has not given a privacy contact yet." | HI Canada's privacy officer (`06` §7, not yet named `[U]`) | `properties.privacy_contact_title` and `privacy_contact_address`. **No console field or operator script sets them yet**: until one exists, a database update by the operator |
| Vancouver Downtown (`vancouver-downtown`) | Privacy contact | Same | Same | Same |
| Vancouver Jericho Beach (`vancouver-jericho-beach`) | Privacy contact | Same | Same | Same |

## Whole project

| Item | Why it matters | Where it is tracked |
| --- | --- | --- |
| A native Québécois reviewer for the French | Every French string is a draft by Claude Code and is on the needs-review list (`shared\i18n\review.ts`); none is marked reviewed (D-19) | `03` D-19 |
| Official check limits for the board, places and offers | 90 days each are demo values (D-33) | `03` O-23 |
| A staff trial of the text length limits | Chosen in Phase 1; not checked against what staff write | `03` O-23 |
| Real content for Downtown and Jericho Beach | The seeded rows are samples with the Sample band | Phase 3 |
| Checked stamps on seeded content | Seeded rows have none, so they read "Not checked yet. Ask at the desk." | Staff, in the console |