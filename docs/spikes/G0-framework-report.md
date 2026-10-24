# G0 framework report — waiver

Date: 2026-10-23. Status: **gate G0 closed by waiver (D-12). The Phase 0.2 spike was not
run.**

This is not a spike report. Martin chose Preact 11 on the strength of the sandbox
benchmark and waived the spike so the demo path (D-22) can start. This file says what
that benchmark measured, what it did not, and how Preact stands against the rule in
`05-ARCHITECTURE.md` §2.4, so that Phase 1 starts from the facts and not from an
impression that gate G0 was met. Labels as in `00-README.md`.

## 1. What was measured

One screen, written four times (React 19.3.1, Preact 11.0.2, Svelte 5.57.2, solid-js
1.9.17) in a Linux sandbox with two virtual CPUs: four tabs, a seven-day strip, five
filter pills, a list of activity cards and a join toggle. Vite 8.3.5 production builds.
396 page loads in headless Chromium 153.0.8010.12 driven by Playwright 1.63.0, at 1×, 4×
and 6× CPU slowdown, with 40, 280 and 1,400 activities in the data, 11 runs per cell
`[V]`. The method, the limits and the sizes are in `05` §2.1. The code, raw results and
full tables are in `hico-framework-benchmark.zip`, which is not in this repository.

## 2. How Preact stands against the §2.4 rule

| §2.4 measure | Result for Preact 11 | Label |
| --- | --- | --- |
| 1. Gzip size of the screen | 6,404 bytes, against 68,242 for React. One plain screen, not the real app | `[V]` for that build |
| 2. Lighthouse, mobile, median of five | **Not run** | `[U]` |
| 3. axe-core on the rendered screen | **Not run.** A separate lint test on a file with nine deliberate defects found 7 (jsx-a11y) or 8 (oxlint) of 9. axe stays in `npm run validate` (Phase 1) | `[U]` for axe; `[V]` for the lint test |
| 4. Load and update cost at 4×, 40 and 280 activities | Measured in the sandbox, **not on Martin's machine**. Table below | `[V]` in the sandbox |
| 5. Developer experience: correction rounds, first-time passes, warnings | **Not measured.** The prototype is React-style code, so a near-copy is expected | `[I]` |
| 6. Cloudflare Vite plugin runs the Worker, assets and a local D1 binding with Preact | **Not tested** | `[U]` |

So by the letter of §2.4, measures 2, 3, 5 and 6 are open and measure 4 was not repeated
on Martin's machine. Phase 1 is where they are first exercised (§4).

### Measure 4, the cells §2.4 names: 4× CPU slowdown

Median of 11 runs, milliseconds. The change is against React. "n.s." means the difference
could be chance (Mann–Whitney test, p at or above 0.01).

| | 40 activities, React | 40, Preact | 280 activities, React | 280, Preact |
| --- | ---: | ---: | ---: | ---: |
| First content rendered | 299.3 | 135.1 (−55%) | 327.7 | 146.6 (−55%) |
| Script time during load | 176.2 | 29.9 (−83%) | 193.3 | 40.7 (−79%) |
| Blocking time during load | 92.0 | 25.0 (−73%) | 104.0 | 37.0 (−64%) |
| Day switch, update cost | 8.1 | 6.4 (−21%, n.s.) | 23.3 | 25.2 (+8%, n.s.) |
| Category switch, update cost | 4.5 | 3.7 (−19%, n.s.) | 10.5 | 9.9 (−6%, n.s.) |
| Join toggle, update cost | 2.4 | 2.2 (−4%, n.s.) | 5.1 | 5.2 (+3%, n.s.) |

In these cells Preact loads about twice as fast as React and its update costs are within
the 10% band §2.4 treats as equal, or better.

### Where Preact was more than 10% slower than React

Five cells out of the nine combinations and eight measures each, all in the larger lists.
All are update or blocking measures; none is a load-time measure.

| Cell | React | Preact | Change |
| --- | ---: | ---: | --- |
| 1,400 activities, 1×, join toggle | 1.4 ms | 1.7 ms | +25%, significant |
| 1,400 activities, 4×, blocking time during load | 119.0 ms | 154.0 ms | +29%, n.s. |
| 1,400 activities, 4×, join toggle | 12.5 ms | 15.4 ms | +24%, n.s. |
| 1,400 activities, 6×, join toggle | 22.8 ms | 25.2 ms | +11%, n.s. |
| 280 activities, 6×, join toggle | 8.7 ms | 10.1 ms | +17%, n.s. |

Svelte and Solid were also not better than React on blocking time in the 1,400-activity
cells, so this is mostly a long-list effect, not a Preact one. The two boards the demo
covers carry far fewer than 280 activities (14 weekly slots plus a handful of special
events) `[I]`, so the 40-activity cell is the nearer one.

### What the benchmark cannot show

It used unstyled screens in a Linux sandbox with no phone, no network simulation and no
service worker. One author wrote all four screens. 216 comparisons were made without
allowing for the number, so about two "significant" labels would be expected by chance.
Read the ratios between frameworks, not the milliseconds `[V]` (`05` §2.1).

## 3. The strongest argument against Preact

Version 11 is about three weeks old, and the patch release that was benchmarked was
published the day of the test `[V]`. A new major version can have faults an older one has
lost. Preact 10.29.8 (2026-08-01) is the older line; it was not measured, and whether
the prototype's patterns behave the same on it is `[U]`. Preact's compatibility layer
for React libraries was not tested; a library that depends on React internals can fail on
it `[U]`.

The documented alternative is Svelte 5: a rewrite of 13 components, about 8 KB more, and
30 to 70 ms slower to first content at 4× and 6× in the sandbox (`05` §2.3).

## 4. What Phase 1 must check, and what happens if it fails

Phase 1 builds the real scaffold on Preact, so it is the first test of the open
measures. It reports each of these in its plan or its result:

- The Cloudflare Vite plugin runs the Worker, static assets and a local D1 binding with
  Preact (measure 6).
- `npm run validate` runs type-checking, tests and axe-core on the rendered shell, and
  the shell has no serious axe violation (measure 3).
- Any library the project adds works with Preact, with or without the compatibility
  layer.

If any of these fails, Phase 1 stops and comes back to Martin. It does not switch
framework by itself and it does not fall back to React (D-12).

Lighthouse and a styled-screen load measurement (measures 2 and 4 on real screens) are
not gates for the demo. They can be run once the guest app exists, in Phase 2.
