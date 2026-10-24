# HI CO — Project Package

Read this first. It says what each file is, where it goes, and what to do with it.

## What this is

HI CO is a guest app for HI Canada hostels: what is on this week, staff
recommendations, guest-organised gatherings, and opt-in "who is up for something
right now" signals. A working prototype exists. It is one React file with invented
data, kept in memory, with no server. This package is the plan and the working
documents for turning it into a production application that many HI Canada
properties can each run with their own content and their own staff login. HI
Vancouver Downtown is the first.

The package covers the product, the architecture, privacy and compliance, the
location and Wallet research, the adoption strategy, the content workflow, the
build plan (with every Claude Code prompt written out), deployment, and a register
of what was verified and what was not. **Nothing in it has been built.** The
decisions that are still yours to make are listed in `03-DECISIONS.md`.

## Files and where they go

| File | What it is | Goes in |
| --- | --- | --- |
| `00-README.md` | This index | Repo `docs\` |
| `01-project-instructions.md` | Rules for Claude in the Project: who decides, evidence labels, product and deployment invariants | **Claude.ai Project instructions field** (paste the contents) and repo `docs\` |
| `02-STATE.md` | What exists today, with measurements, and everything wrong or fake in the prototype | Project knowledge and repo `docs\` |
| `03-DECISIONS.md` | Decisions made, and the open ones you owe, each with a recommendation | Project knowledge and repo `docs\` |
| `04-PRODUCT-SPEC.md` | What the app does, per surface and per role, with acceptance criteria | Project knowledge and repo `docs\` |
| `05-ARCHITECTURE.md` | Stack, framework decision gate, data model, tenancy, security, limits | Project knowledge and repo `docs\` |
| `06-PRIVACY-AND-COMPLIANCE.md` | Opt-in matrix, data inventory, retention proposals, law, threat model | Project knowledge and repo `docs\` |
| `07-LOCATION-AND-WALLET.md` | What location can and cannot do on the web, the Wallet route, the membership-card questions | Project knowledge and repo `docs\` |
| `08-ADOPTION-STRATEGY.md` | Why single-player first, the stages, the anti-roadmap, corrected facts | Project knowledge and repo `docs\` |
| `09-CONTENT-AND-ONBOARDING.md` | Content model, provenance rules, how a property is onboarded, translation | Project knowledge and repo `docs\` |
| `10-BUILD-PLAN.md` | Phases 0 to 8 with the full Claude Code prompt for each | Project knowledge and repo `docs\` |
| `11-DEPLOY.md` | Environments, secrets, migrations, deploy and rollback in PowerShell | Project knowledge and repo `docs\` |
| `12-EVIDENCE-REGISTER.md` | Every checkable claim: status, source, date | Project knowledge and repo `docs\` |
| `CLAUDE.md` | Working rules for Claude Code in the repo | Repo root |

A second file, `hico-framework-benchmark.zip`, is delivered beside this package but is
not part of it. It holds the sandbox measurement of four front-end frameworks that
`05` §2.1 reports, with its code and raw results. It is an optional input to Phase 0.2
(`10`); put it in `Downloads` beside the package if you want that phase to use it.

The canonical copy of every document is `C:\Users\User\dev\hico\docs\`. The
Project's knowledge files are copies with no version history. When Claude Code
changes `02-STATE.md` or `03-DECISIONS.md`, re-upload them to the Project.

## Reading order

1. `03-DECISIONS.md`: what is settled and what you owe.
2. `02-STATE.md`: where things stand and what is wrong with the prototype.
3. `10-BUILD-PLAN.md`: the sequence and the gates.
4. The document that owns the area you are about to touch.

## Labels

Every claim carries one: `[V]` verified by the author on a stated date, `[R]`
reported by a source document and not re-checked, `[I]` inferred, `[A]` assumption
or proposal, `[U]` unknown. A figure with no label is a mistake; say so.

## Set-up

Do these once.

1. In Claude.ai, create a Project called HI CO. Paste `01-project-instructions.md`
   into the instructions field. Upload `00` and `02` to `12` as project knowledge.
2. Also upload the source documents below, unchanged, as reference.
3. Put `hico-project-package.zip` (the 14 files at its top level, no folder inside it) in
   `Downloads`, then run this in PowerShell. It unpacks the package into the new repo
   folder. It does not overwrite anything. With `-ErrorAction Stop`, `Expand-Archive` stops
   at the first file that already exists. Without it, Windows PowerShell 5.1 prints an
   error for each existing file and carries on, still without overwriting `[V]`
   (`docs\spikes\preflight-desktop.md`); PowerShell 7 without it was not tested `[U]`.

PowerShell, run in a terminal:

```powershell
New-Item -ItemType Directory -Force -Path "$HOME\dev\hico" | Out-Null
Expand-Archive -LiteralPath "$HOME\Downloads\hico-project-package.zip" -DestinationPath "$HOME\dev\hico\_package" -ErrorAction Stop
```

4. In the Claude Code desktop app, open the folder `C:\Users\User\dev\hico` and paste the
   Phase 0 prompt from `10-BUILD-PLAN.md`. It starts with a preflight that runs the
   package's PowerShell on your machine and shows the output.

## Source documents (not in this package)

Martin supplied these. The package distils them and cites them by name. Upload them unchanged as reference. Where one differs from the
package, say so and show both; do not resolve it silently.

- `hi-co-prototype.jsx` — the prototype, 913 lines.
- The geofencing feasibility report.
- The Guest Adoption Strategy (the evidence base).
- The Second-Pass QA Audit.
- The Act respecting the protection of personal information in the private sector
  (CQLR c. P-39.1), Québec Official Publisher, updated to 15 October 2026.

HI CO is stand-alone (decision D-01). If any source document refers to another
program or pilot, ignore that part.

## What is deliberately not here

- The prototype's access key. It is held out of band.
- Any claim that HI Canada has agreed to anything. Nothing is agreed unless you say
  it is in writing.

## Terms

- **You, I, Martin.** In this README "you" is Martin. In `01` and `CLAUDE.md` "I" is
  Martin. The other documents say "Martin".
- **Stage and phase.** A *stage* (0 to 3) is a release step for guests (`04` §8,
  `08` §6). A *phase* (0 to 8) is a build step (`10`). Phases build stages.
- **Tenant.** One HI Canada property using HI CO.
- **Tier 1 and Tier 2.** The two designs for the Nearby view (`04` §4.7). Tier 1 is
  the first release.
- **LUME.** The original app HI CO was designed from. Its repository was cloned for
  reference. "City mode" is the Supabase-backed mode of that app that Option A
  (`05` §3) would reuse.
- **Serendipty.** Martin's repository that holds the deployed prototype and the shared
  preview gate.
- **Quebec-facing.** A property or deployment that serves guests in Quebec.
- **Audience, Tomahawk, Cobber.** The membership platform HI Canada's cards are issued
  through, and companies in its ownership chain (`07` §6).
- **HI Vancouver Jericho Beach.** The other Vancouver hostel; its season peaks in
  summer.
- **SPA** single-page application. **TBT** total blocking time, a Lighthouse measure
  of how long the page cannot respond. **PIPEDA** the federal privacy law for
  commercial activity. **PIPA** the provincial equivalents in British Columbia and
  Alberta. **ACA** Accessible Canada Act. **AODA** Accessibility for Ontarians with
  Disabilities Act. **WCAG** Web Content Accessibility Guidelines.
