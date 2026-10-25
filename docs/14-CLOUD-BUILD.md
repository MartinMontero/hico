# CLOUD BUILD — HI CO

What it takes to build and test this repository somewhere other than Martin's Windows machine, what was checked, and what was
not. Written 2026-10-25 by Claude Code. Labels as in `00-README.md`. **Nothing here has been run on Linux `[U]`.**

"Cloud build" can mean three different things. This file prepares the first two and only names the third.

| Meaning | What changes | Status |
| --- | --- | --- |
| **Claude Code cloud sessions** (work continues in a Linux session started from the GitHub repository) | The shell is bash on Linux, not Windows PowerShell; the browsers and Node must be installed in the session | Repository checked for Linux problems (below). `CLAUDE.md`'s shell rule needs a note: Martin's decision |
| **CI on GitHub Actions** (`npm run validate` on every push) | A workflow file in `.github/workflows` | Example written, **not active** (`docs\ci\github-actions-validate.yml.example`). Turning it on is O-12's CI half: Martin's call |
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

## What was not checked, and why

- **A real Linux run.** This machine has WSL (an Ubuntu that is stopped) and Docker Desktop (its engine is not running), and
  using either would mean installing Node, the Playwright browser or a container image: downloads Claude Code does not make
  without being told to. The first run on Linux is the real test; it may find problems this list does not.
- **Playwright's Chromium on Linux** (system libraries; `--with-deps` installs them and needs permission to).
- **The Cloudflare local runtime on Linux** (`workerd` is published for Linux x64 and the tests use it; not run here).
- **Timing.** Lighthouse numbers on a shared cloud machine will differ from Martin's; they are printed, not enforced.

## Rules that differ in a cloud session (for Martin to decide)

`CLAUDE.md` says: Windows, PowerShell only, no bash, no forward-slash paths. That is right for Martin's machine and wrong for a
Linux session, where PowerShell may not exist and Windows paths do not work. Suggested addition, not made: "In a cloud session
(Linux) use bash and forward-slash paths; every other rule applies unchanged: never deploy, create remote resources, push, or
store a secret without my GO." The rule about never running `wrangler deploy`, `d1 create`, `secret put`, a remote migration or
a DNS change without GO does not depend on the shell.
