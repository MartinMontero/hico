# EVIDENCE REGISTER — HI CO

Every checkable claim the package relies on: its status, where it came from and when.
A claim promoted into any document must be here. When something is re-checked, change
its row; when a document and this register disagree, say so and show both.

Status: **V** verified by the package author on the date shown; **R** reported by a
supplied source document and not re-checked; **I** inferred; **A** assumption or
proposal; **U** unknown.

## A. The prototype and the existing repositories

| ID | Claim | Status | Source and date |
| --- | --- | --- | --- |
| E-01 | Prototype is 913 lines, 60,370 bytes, SHA-256 `e83863dd…ee456`, default export `HiCoApp`, 13 components, imports only `react`, `useMemo` unused | V | Attached file, read and hashed 2026-10-23 |
| E-02 | No `role`/`aria-*` attribute anywhere in the prototype | V | `grep -c` returned 0, 2026-10-23 |
| E-03 | 18 text styles under 12 px (nine at 11, seven at 10, two at 9) | V | Counted from the file, 2026-10-23 |
| E-04 | Radar positions use `Math.random()`; the parent re-renders every second and redraws them | V | Source lines 736, 606–608, 748; read 2026-10-23 |
| E-05 | Signal cards show dorm names; client-side countdown; device-clock day filter | V | Source read 2026-10-23 |
| E-06 | Contrast pairs in `02` §2 row 13 | V | Computed with the WCAG formula, 2026-10-23 |
| E-07 | The café at HI Whistler is spelled "Cheaky's Cafe" (D-14). The prototype (line 71) spells it "Cheekye's" | V | Martin, 2026-10-23, and HI Canada's own discounts page |
| E-08 | Serendipty gate behaviour (constant-time key check, hashed HttpOnly cookie, flat 404, fail closed, security headers) | V | `packages\gate\index.js` read 2026-10-23 |
| E-09 | `hico` Worker config: SPA fallback, `run_worker_first: ["/*"]`, compatibility date 2026-08-07 | V | `wrangler.jsonc` read 2026-10-23 |
| E-10 | Deployed prototype bundle is 234,091 B raw, 71,209 B gzip | V | `dist\assets\index-l_thFI2C.js`, measured 2026-10-23 |
| E-11 | LUME repository: React 18.3.1, TypeScript, Vite 5, Tailwind 3, Supabase, seven migrations, 125 `it`/`test` calls in 15 files, HEAD `3b0e995` | V | Cloned 2026-10-23; test count is static, tests not run |
| E-12 | LUME SECURITY.md records SB-1 and SB-2; `SEC-10` and `SEC-11` do not appear | V | Searched the clone, 2026-10-23 |
| E-13 | Supabase project `lume-city` is in `ca-central-1`, `ACTIVE_HEALTHY` | V | Supabase tool, 2026-10-23 |
| E-14 | HI CO shares no code with LUME | V | Compared the sources, 2026-10-23 |

## B. Cloudflare

| ID | Claim | Status | Source and date |
| --- | --- | --- | --- |
| E-20 | Durable Object jurisdictions: eu, us (added 2026-06-26), fedramp; location hints wnam, enam, sam, weur, eeur, apac, apac-ne, apac-se, oc, afr, me; hints best effort | V | Cloudflare docs and changelog, 2026-10-23 |
| E-21 | D1 hints: wnam, enam, weur, eeur, apac, oc; jurisdictions eu, fedramp, us | V | Cloudflare docs and `wrangler d1 create --help`, 2026-10-23 |
| E-22 | Canada is not available as a jurisdiction or a hint for D1 or Durable Objects | V | Absence in the lists above; docs as read 2026-10-23 |
| E-23 | Durable Object pricing and limits in `05` §8 | V | Cloudflare pricing page, 2026-10-23 |
| E-24 | WebSocket hibernation: incoming messages bill 20:1; hibernating idle objects not billed for duration | V | Same page, 2026-10-23 |
| E-25 | D1 row allowances same as the DO row figures; storage $0.75/GB-month beyond 5 GB | V | Pricing page, 2026-10-23 |
| E-26 | D1 maximum database size and count | U | Not on the page read |
| E-27 | Workers Paid monthly base fee | U | Not read |
| E-28 | Cloudflare Vite plugin v1.0 GA with Durable Objects, D1 and static assets; Hono among supported frameworks | V | Cloudflare blog, 2025-04-08. Current version unchecked |
| E-29 | Wrangler 4.152.0 provides `d1 create` (with `--location`, `--jurisdiction`), `d1 export`, `d1 migrations list/apply/create`, `d1 execute --command --remote`, `d1 time-travel info/restore` (30-day window for timestamps), `secret put`, `secret bulk`, `deploy --dry-run`, `rollback`, `tail` | V | `--help` output run 2026-10-23 |
| E-30 | The root Serendipty repository pins Wrangler `^4.120.0`; the latest at test time was 4.152.0 | V | `package.json` and `npx wrangler --version`, 2026-10-23 |
| E-31 | Workers mTLS binding presents a client certificate via `env.BINDING.fetch()`; Cloudflare-proxied origins fail with 520; ports and hostnames not addressed | V | Cloudflare docs, 2026-10-23 |
| E-32 | Cloudflare Access free-plan seat limit and login methods | U | Not on the page read |
| E-33 | D1 enforces foreign keys and CHECK constraints | I | Standard behaviour; Phase 1 proves it by test |
| E-34 | D1 Time Travel restore also yields a bookmark that can undo the restore | U | Prove in the Phase 8 drill |
| E-35 | Scheduled (Cron Trigger) Workers can run the purge job | I | Confirm in Phase 2 |

## C. Frameworks and tooling

| ID | Claim | Status | Source and date |
| --- | --- | --- | --- |
| E-40 | One-screen bundle sizes, gzip level 9: React 68,242 B; Preact 6,404; Svelte 14,054; Solid 5,790 (raw and versions in `05` §2.1) | V | Built and measured in the sandbox, 2026-10-23 (an earlier build without the list-size switch measured 37 to 45 B smaller) |
| E-41 | Load and update cost of the four frameworks on one plain screen: the three alternatives reach first content 34% to 57% earlier than React; update cost does not separate them | V | 396 runs, headless Chromium 153.0.8010.12, Playwright 1.63.0, two-CPU sandbox, CPU throttled 1×, 4×, 6×; raw results in the benchmark pack, 2026-10-23. Not a phone, not Windows, no CSS, no Lighthouse |
| E-42 | Brotli sizes | U | No brotli binary in the sandbox |
| E-43 | npm latest for Solid is 1.9.17 (no stable Solid 2) | V | npm, 2026-10-23 |
| E-44 | The React Foundation (Linux Foundation) launched 2026-02-24; Meta is one of eight founding platinum members | V | News and foundation announcement, read 2026-10-23 earlier in this work; the URL was not kept, so re-check before quoting outside the project |
| E-45 | Svelte's compiler flags 7 of 9 deliberate accessibility defects in a test file; eslint-plugin-jsx-a11y 6.10.2 flags the same 7; oxlint 1.89.0 flags 8; none flags an unlabelled input | V | Run in the sandbox on Svelte 5.57.2, ESLint 9.39.5 and 10.13.0, 2026-10-23. Solid not tested |
| E-46 | Claude Code has seen less Svelte 5 and Solid than React-style code | I | No measurement |
| E-47 | The official Svelte MCP server exists | V | Svelte documentation; tools not examined |
| E-48 | Better Auth has a passkey plugin built on SimpleWebAuthn | V | Its documentation; D1 and Workers support not stated (U) |
| E-49 | Core Web Vitals "good" thresholds: LCP 2.5 s, INP 200 ms, CLS 0.1 | I | Well known; not fetched this session |
| E-114 | Preact 11.0.0 was released 2026-09-30, 11.0.1 on 2026-10-08, 11.0.2 on 2026-10-23; the last 10.x is 10.29.8 (2026-08-01) | V | npm registry, 2026-10-23 |
| E-115 | Svelte 5.0.0 was released 2024-10-19; React 19.0.0 on 2024-12-05; Solid 2.0 is at release candidate 18 and 1.9.17 is the stable version | V | npm registry, 2026-10-23 |
| E-116 | eslint-plugin-jsx-a11y 6.10.2 is the latest version, published 2024-10-26; its ESLint range ends at 9; installing it beside ESLint 10 fails without `--legacy-peer-deps`; ESLint 9.39.5 carries an npm "no longer supported" notice | V | npm registry and an install attempt, 2026-10-23 |
| E-117 | The Preact repository page shows an MIT licence, the preactjs GitHub organisation and OpenCollective sponsors, and names no foundation, corporate owner or Meta affiliation | R | github.com/preactjs/preact, read 2026-10-23; absence from one page is not proof |
| E-118 | With 6 cards, tap-to-next-frame measured a median of 33 ms in all four frameworks at every CPU speed (two frames at 60 Hz) | V | Same 396 runs, 2026-10-23 |
| E-119 | With 200 cards a day switch costs 83 to 92 ms at 4× and 134 to 143 ms at 6× in all four frameworks | V | Same runs, 2026-10-23 |
| E-120 | Preact 11 runs the prototype's React-style code with few changes; its compatibility layer works with the libraries this project will use | U | Not tested; the benchmark screens are plain markup |

## D. Location and Wallet

| ID | Claim | Status | Source and date |
| --- | --- | --- | --- |
| E-60 | Background location wake-up is not possible from a browser, especially iOS; the W3C Geofencing API is obsolete | R | Geofencing feasibility report |
| E-61 | No commercial API (Google, TomTom, Mapbox, HERE, Progressier, Radar) solves problem B for a PWA | R | Same report |
| E-62 | Apple: 10 locations per pass, about 100 m for loyalty and coupon passes, about 1 km for event tickets and boarding passes; Google about 4 notifications a day, switched off at times | R | Same report |
| E-63 | Apple pass update mechanism (registration, empty APNs push signed with the Pass Type ID certificate, `ApplePass` auth header, forward-only change tags) | V | Apple documentation, read 2026-10-23 |
| E-64 | A Worker can send the APNs push, on which port, with the certificate | U | Spike S-W2 |
| E-65 | A `.pkpass` can be signed inside a Worker | U | Spike S-W1 |
| E-66 | Apple Developer Program is $99 USD a year | R | Same report |
| E-67 | A fee waiver exists for HI Canada | U | Apple's own fee-waiver pages returned "not found" on 2026-10-23 (two URLs). One search-result title (iMore) says waivers were extended to Canada at some point; current terms unchecked |
| E-68 | Web push delivery is about a third | R | Vendor figure in the adoption strategy; unverified |

## E. Law and compliance

| ID | Claim | Status | Source and date |
| --- | --- | --- | --- |
| E-70 | Quebec regulator guidance (December 2023, privacy-policy guidelines) says identify/locate/profile functions must be off by default and activated by express consent; the guidelines do not have the force of law | V | Miller Thomson article, read 2026-10-23 |
| E-71 | Section 8.1 of Quebec's private-sector Act requires an enterprise collecting with technology that can identify, locate or profile a person to tell them of its use and of the means to activate those functions. It does not itself say "off by default" or "express consent"; section 9.1 supplies the default | V | Act, updated to 15 October 2026, supplied by Martin; read 2026-10-23 |
| E-72 | Section 17 requires an assessment, and a written agreement reflecting it, before personal information is communicated outside Québec or entrusted to someone outside Québec to hold for the enterprise | V | Act, section 17 |
| E-73 | Quebec's Bill 96 requires a French interface for Quebec-facing deployments | R | Guest Adoption Strategy |
| E-74 | WCAG 2.1 AA is the right target; ACA likely not binding on HI Canada; AODA and Accessible BC apply provincially | R | Second-Pass QA Audit; counsel to confirm |
| E-75 | BC PIPA's position on storage outside Canada | U | Not researched |
| E-76 | HI Canada's policy on minors and unaccompanied minors | U | Not located |
| E-77 | HI CO may use the name "HI" and HI Canada's logo | U | Ask HI Canada |
| E-102 | The Act supplied is the Québec Official Publisher's text of CQLR c. P-39.1, updated to 15 October 2026, with official status; all 38 pages read | V | The PDF, 2026-10-23 |
| E-103 | Section 9.1: a technological product or service offered to the public with privacy settings must default them to the highest level of confidentiality; browser cookie settings are excepted | V | Act, section 9.1 |
| E-104 | Section 3.3: a privacy impact assessment is required for any project to acquire, develop or overhaul an information system or electronic service delivery system involving personal information, with a structured-format portability requirement | V | Act, section 3.3 |
| E-105 | Sections 3.5 to 3.8: reasonable measures after an incident; prompt notice to the Commission and the people affected when there is a risk of serious injury; a register of incidents | V | Act |
| E-106 | Sections 4.1 and 14: under 14, a parent or tutor consents; from 14, the minor can; consent must be clear, free, informed, specific, per purpose, separate, and time-limited | V | Act |
| E-107 | Section 18.3: a service provider is engaged by written contract with specified protections and must notify the officer of violations | V | Act |
| E-108 | Penalties: administrative up to $50,000 (individual) or $10,000,000 or 2% of worldwide turnover (others); penal $5,000 to $100,000 (individual) or $15,000 to $25,000,000 or 4% (others); doubled for repeats; five-year limit; punitive damages of at least $1,000 for intentional or grossly negligent infringement | V | Act, sections 90.12, 91, 92.1, 92.2, 93.1 |
| E-109 | The Act's text does not state its reach outside Québec; section 1 ties it to personal information handled in carrying on an enterprise. Whether it reaches a BC property's Quebec-resident guests | V that the text is silent; U on the reach | Act, section 1; counsel |
| E-110 | AWS Canada (Central) is in Montréal, Québec; Supabase's `ca-central-1` mirrors AWS's name | V (AWS announcement, 2016); I (Supabase mirroring); current location not re-checked | press.aboutamazon.com, 2016-12 |
| E-111 | OneTrust explainer: in-force timeline (Sept 2022, 2023, 2024) and an individual's penal fine of $5,000 to $50,000. The page predates September 2023 `[I]`; its fine range differs from the Act, which governs | R | OneTrust page, read 2026-10-23 |
| E-112 | Sections 23 and 27 to 34: destroy or irreversibly anonymize when the purpose is achieved; access and correction on written request to the officer, reply within 30 days | V | Act |

## F. HI Canada and the first tenant

| ID | Claim | Status | Source and date |
| --- | --- | --- | --- |
| E-80 | HI Canada's About page says the network has 39 hostels and, elsewhere, "about forty" | V | hihostels.ca/en/about, 2026-10-23 |
| E-81 | The same page gives two worldwide figures that disagree (3,000+ in 61 countries; 2,100 in 50+) | V | Same page, 2026-10-23 |
| E-82 | A one-night stay earns a free two-year HI Canada membership | U | Reported by the adoption strategy `[R]`; not found on the About page or the Life Member perks page, 2026-10-23 |
| E-83 | Life Member perks: two 50%-off vouchers (up to $100 per reservation), a $50 referral voucher, 15% off food and drink at the cafés at HI Lake Louise, HI Whistler and HI Banff, a legacy pin | V | hihostels.ca/en/faq/life-member-perks, 2026-10-23 |
| E-84 | HI Vancouver Downtown: 1114 Burnaby St, V6E 1P1; West End; 4-bed dorms and private rooms; wifi, coworking, kitchen, games room with billiards, patio, library; no hostel-run activities listed | V | hihostels.com listing, 2026-10-23 |
| E-85 | Downtown: 232 pillows, reopened June 2023, 24-hour desk, free breakfast 7–9, rooftop, TV lounge, GM Rhian | I | Earlier research note (30 May); not on the listing page. The general manager's surname was removed on 2026-10-24 at Martin's instruction; it is unconfirmed |
| E-86 | Membership card is issued via the Audience platform; owner chain ends at Cobber (formerly ResPax); no public API found | R | Guest Adoption Strategy |
| E-87 | Hostelworld: 3 million members; FY2025 net revenue €93.8m | R | Guest Adoption Strategy |
| E-88 | iOS is 60.31% of Canadian mobile (StatCounter 2026) | R | Guest Adoption Strategy |
| E-89 | Travel loyalty breakage is about 17–24% by airline disclosure (United 18%, Alaska 17.4%, AIR MILES 24.5%), not 70–85%; The Bond about 30% unverified | R | Second-Pass QA Audit |
| E-90 | Whistler peaks in winter, Jericho in summer | R | Guest Adoption Strategy |
| E-92 | HI properties host minors and school groups | R | Guest Adoption Strategy |
| E-93 | HI Canada's or HI Vancouver Downtown's agreement to take part | U | Not recorded; Martin's decision only (D-02) |
| E-91 | Any HI Canada adoption, redemption, turnout, stay-length or membership-activation figure | U | None measured |

## G. Process

| ID | Claim | Status | Source and date |
| --- | --- | --- | --- |
| E-100 | The PowerShell in `00`, `10` and `11` is syntactically valid, uses no PowerShell-7-only syntax, and the key recipe, the timestamp line and the `Expand-Archive` no-overwrite behaviour work | V | Parse: PowerShell 7.6.8 on Linux, 2026-10-23, 11 of 11 blocks. Run on Windows 11 under Windows PowerShell 5.1 and PowerShell 7.6.8, 2026-10-23 (`docs\spikes\preflight-desktop.md`, `preflight-pwsh7.md`, `preflight-rerun.md`): a 43-character URL-safe key, two runs differ; a second extract with `-ErrorAction Stop` raised an error and left an edited file intact. Without `-ErrorAction Stop`, 5.1 printed a non-terminating error per existing file and carried on, still without overwriting. Not tested on Windows: whether every block parses under 5.1 and under 7; `Set-Clipboard` beyond its existence; PowerShell 7 without `-ErrorAction Stop` `[U]` |
| E-113 | The same PowerShell works on Windows PowerShell 5.1 and on PowerShell 7 on Windows, including `$HOME\dev` paths and `Set-Clipboard` | U | Not run on Windows. The Phase 0 preflight runs it and saves the output |
| E-101 | The package contains none of the program names Martin ruled out on 2026-10-23, and no access key | V | Text search of every file for those names and for key-like strings, 2026-10-23 |
