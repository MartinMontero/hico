# CLOUD BUILD — HI CO

What it takes to build and test this repository somewhere other than Martin's Windows machine, what was checked, and what was
not. Written 2026-10-25 by Claude Code, updated 2026-10-26. Labels as in `00-README.md`. **The first run on Linux happened on 2026-10-26 (CI, below); no cloud session has run yet `[U]`.**

"Cloud build" can mean three different things. This file prepares the first two and only names the third.

| Meaning | What changes | Status |
| --- | --- | --- |
| **Claude Code cloud sessions** (work continues in a Linux session started from the GitHub repository) | The shell is bash on Linux, not Windows PowerShell; the browsers and Node must be installed in the session | Repository checked for Linux problems (below). `CLAUDE.md` has the cloud-session note (D-40). Building moves here (D-41). Needs the environment and a brief from Martin (last two sections) |
| **CI on GitHub Actions** (`npm run validate` on every push) | A workflow file in `.github/workflows` | **On** since 2026-10-26 (D-42): `.github/workflows/validate.yml`. Never run on GitHub before then `[U]` |
| **Builds on Cloudflare** (Workers Builds deploying from GitHub) | It would deploy | **Not prepared.** Deploying needs Martin's GO each time (`CLAUDE.md`); this file does not change that |

## The commands on a clean Linux machine

```bash
node -v            # 24 or later (.nvmrc says 24; package.json "engines" says >=24)
npm ci
npx playwright install --with-deps chromium   # the browser tests and Lighthouse use it
npm run validate   # typecheck, lint, tests, contrast, build (page and service worker), checks, browser tests, Lighthouse
```

`npm run validate` ends with a summary of ten lines, each `pass` or `FAIL`; it takes several minutes on Martin's machine (the browser tests and Lighthouse are the slow parts).
Everything it needs is in the repository: the database is a local file made by the tests, and no secret, account or network
service is involved. No step is configured to contact Cloudflare: `WRANGLER_SEND_METRICS=false` is set by the scripts, and every
database command is `--local`.

## What was checked from Windows (static, `[V]`)

- **Import paths.** Linux file names are case-sensitive; Windows' are not. Every relative import in every tracked TypeScript file
  was compared with the tracked file names, character for character: none differs (a script, not a human read).
- **Line endings.** `.gitattributes` makes every text file check out with LF, so a clone on any system gets the same bytes.
  (Without it, a fresh clone on Windows got CRLF and four tests failed; that was found and fixed on 2026-10-25.)
- **Windows-only code.** Two places, both fixed: `scripts\lighthouse.ts` stopped its preview server with `taskkill` only (it now
  stops the process group on Linux and macOS), and one operator test built a script path with a backslash (it now uses
  `path.join`). The PowerShell operator scripts (`scripts\*.ps1`) are for Martin's machine; their tests skip themselves when
  `pwsh` is not installed.
- **Node.** Scripts are run as `node file.ts`, which needs Node's built-in TypeScript support; Lighthouse 13.5.0 needs 22.19 or
  later. Only 24.16.0 has been used, so the repository claims 24.

## The first run on Linux (2026-10-26, `[V]`)

GitHub Actions ran `npm run validate` on `ubuntu-latest` (Node 24.21.0, Playwright's Chromium) from a fresh checkout of commit
`c71be4e` (run 40248020029, about 4 minutes). **Nine of the ten steps passed first time**, including all 43 browser tests with axe
at 360 px, the service worker and offline tests, and Lighthouse (What's On LCP 2031 ms, Explore 2168 ms, TBT 0, CLS 0 and 0.035,
the same as on Windows). The tenth, unit and isolation tests, failed on two tests with one cause: `scripts\operator-common.ps1`
built the path to `operator.ts` with a literal backslash, which is not a path on Linux. (The runner has PowerShell, so the
wrapper tests ran there; on a machine without `pwsh` they skip themselves.) Fixed with `Join-Path`. The other 558 unit tests
passed on Linux.

GitHub also warned that the `actions/checkout@v4` and `actions/setup-node@v4` actions run on Node 20, which is being retired; they
were forced onto Node 24 and worked. A newer major version of each is probably out; not checked.
## What was not checked, and why

- **A run in a Claude Code cloud session.** CI is a clean Linux machine, but a cloud session is a different environment (its own
  Node, its own network rules, the environment called `Default`, whose contents Claude Code cannot see). The first session is the
  test of that.
- **Playwright's Chromium on Linux** (system libraries; `--with-deps` installs them and needs permission to).
- **The Cloudflare local runtime on Linux** (`workerd` is published for Linux x64 and the tests use it; not run here).
- **Timing.** Lighthouse numbers on a shared cloud machine will differ from Martin's; they are printed, not enforced.

## Rules in a cloud session (decided: D-40, 2026-10-25)

`CLAUDE.md` now says: in a cloud session (Linux) use bash and forward-slash paths; the PowerShell rules are for Martin's machine;
every other rule applies unchanged (never deploy, create remote resources, push, or store a secret without Martin's GO); a cloud
session sees only what is on GitHub. The rule about `wrangler deploy`, `d1 create`, `secret put`, a remote migration or a DNS
change does not depend on the shell.

## What a cloud session needs from Martin to start

What Claude Code can see of the cloud setup (`list_start_targets`, read-only, 2026-10-25): cloud sessions are available; the
repository `MartinMontero/hico` is on GitHub; two cloud environments exist, both hosted by Anthropic, neither marked as unable to
run this repository. One is the default, and its name is `CLAUDE_CODE_GIT_BASH_PATH`, which looks like an environment-variable
name typed into the name field by mistake `[I]`; the other is called `Default`. **What each environment contains (setup script,
network access, variables) is not visible to Claude Code.** So the list below is what the repository needs; whether an environment
already provides it is Martin's to check.

1. **Pick the environment**, and say which in the request ("use Default"). The default one, with the odd name, is what a request
   without a choice would use.
2. **Node 24 or later.** `.nvmrc` and `package.json` say 24. If the environment's Node is older, `npm ci` may warn and the scripts
   (`node file.ts`) will fail.
3. **A setup step** that runs `npm ci` and `npx playwright install --with-deps chromium` before the session works. Without the
   second, the browser tests and Lighthouse cannot run (the other eight validate steps can).
4. **Network access** from the environment to the npm registry (to install), to Playwright's browser download host, and to
   GitHub. Nothing else is needed: the build calls no other service.
5. **No secrets and no Cloudflare credentials.** None is needed to build and test, and none should be put in the environment: a
   cloud session must not be able to deploy even by accident.
6. **What it may push (decided, D-41).** A branch named `cloud/<task>`, never `main`. Martin reviews and merges.
7. **Anything the session needs that is not on GitHub must be put there first.** `docs\external\` (HI Canada's answers) is
   untracked and stays on Martin's machine, so a task that depends on it cannot run in the cloud as things stand.
8. **A brief, because the session starts cold.** It does not have this conversation. A request names the files, what "done"
   looks like, and which documents to read (`CLAUDE.md`, `docs\02-STATE.md`, `docs\03-DECISIONS.md`).

The first run on Linux should be a small, harmless one: `npm ci` then `npm run validate`, nothing changed, so that anything
Windows-only that this audit missed shows up before real work depends on it.

## How building works now (D-41, D-42)

1. **Martin starts a session** with a brief (template below) and the environment `Default`.
2. **The session works on a branch** `cloud/<task>` made from `main`, in small commits, runs `npm run validate`, and pushes the
   branch. It never pushes to `main`, never deploys, never creates a remote resource, never stores a secret.
3. **CI runs on the branch** (`.github/workflows/validate.yml`). The session looks at the result and reports both: its own
   validate summary lines and the CI result. If CI fails and its own run passed, that difference is the report, not something to
   hide.
4. **Martin reviews** the branch (a pull request on GitHub, or the diff here) and merges it into `main`, or asks for changes.
   Merging is Martin's, on his machine or on GitHub.
5. **Anything that needs his logins or secrets stays on his machine:** deploys, `wrangler login`, secrets, DNS, the first
   Cloudflare setup (Phase 3). A cloud session writes the commands and the plan; Martin gives the GO and runs them (or says
   "run it" in a local session).

## A brief for a cloud session (copy, fill in, send)

```text
Task: <one sentence>.
Read first: CLAUDE.md, docs/02-STATE.md, docs/03-DECISIONS.md, and <the documents that own this area>.
Plan: for anything larger than a one-file fix, write docs/plans/<date>-<slug>.md and stop for my GO.
Work on: a branch named cloud/<task>, from main. Push only to that branch.
Done when: npm run validate passes in your session AND the GitHub Actions run on your branch is green; paste both results.
Do not: deploy, create remote resources, push to main, store any secret, or edit docs/external (it is not in your checkout).
Report: what changed, decisions I still owe, what you could not verify, and which documents are now stale.
```
