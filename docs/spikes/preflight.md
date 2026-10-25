# Windows preflight — raw results

Run on 2026-10-23 (machine clock; `Get-Date` → `Friday, October 23, 2026 8:16:09 PM`).
Nothing was installed or deployed. PowerShell 7 (`pwsh`) was not found on this
machine, so steps 1b–1e ran only under Windows PowerShell 5.1 — the only PowerShell
present.

## 1a. Versions and command availability

PowerShell 5.1, Desktop edition:

```
Major  Minor  Build  Revision
-----  -----  -----  --------
5      1      26100  9711
Desktop
```

Other tools:

```
node --version   -> v24.16.0
npm --version    -> 11.13.0
git --version    -> git version 2.54.0.windows.1
claude --version -> 2.1.310 (Claude Code)
```

`Get-Command wrangler,pwsh -ErrorAction SilentlyContinue` returned nothing: neither
Wrangler nor PowerShell 7 is installed on this machine. Wrangler was not installed as
part of this preflight (not requested; installing anything is out of scope for this
session).

## 1b. Key recipe (docs\11-DEPLOY.md §2), run under PowerShell 5.1

The recipe was run twice with the `Set-Clipboard` and `npx wrangler secret put` lines
removed. The key itself is never printed, only its length, whether it matches
`^[A-Za-z0-9_-]+$`, and whether two runs differ:

```
Run1 length: 43
Run1 matches pattern: True
Run2 length: 43
Run2 matches pattern: True
Runs differ: True
```

## 1c. Timestamp line and backup-folder line (docs\11-DEPLOY.md §4), under PowerShell 5.1

Used `$HOME\dev\hico-preflight-test` in place of the real backup folder name.

```
Timestamp: 20261023-201509
Folder exists: True
Folder exists after removal: False
```

## 1d. Zip / extract-without-overwrite test, under PowerShell 5.1

Zipped `docs\*.md` and `CLAUDE.md` (14 files total) into a zip under `$env:TEMP`,
extracted it once, edited one extracted file, then extracted the same zip into the
same folder a second time without `-Force`:

```
File count: 14
First extract succeeded. File count in extract folder: 14
Edited marker added. Hash before second extract: A4A3D91448A0950F00F3237E779DAC1343310AEE7AF66F1F59E2AB113E84853B
Second extract stopped with error: Failed to create file 'C:\Users\User\AppData\Local\Temp\hico-preflight-extract\00-README.md' while expanding the archive file 'C:\Users\User\AppData\Local\Temp\hico-preflight-docs.zip' contents as the file 'C:\Users\User\AppData\Local\Temp\hico-preflight-extract\00-README.md' already exists. Use the -Force parameter if you want to overwrite the existing directory 'C:\Users\User\AppData\Local\Temp\hico-preflight-extract\00-README.md' contents when expanding the archive file.
Hash after second extract attempt: A4A3D91448A0950F00F3237E779DAC1343310AEE7AF66F1F59E2AB113E84853B
Edited file left untouched: True
Marker still present: True
Cleanup done. Zip exists: False. Extract folder exists: False
```

The second extract stopped with an error and left the edited file untouched, as
expected. All temporary files (zip and extract folder) were removed afterward.

## 1e. Required cmdlets present, under PowerShell 5.1

```
CommandType     Name                                               Version    Source
-----------     ----                                               -------    ------
Cmdlet          Set-Clipboard                                      3.1.0.0    Microsoft.PowerShell.Management
Function        Expand-Archive                                     1.0.1.0    Microsoft.PowerShell.Archive
Function        Get-FileHash                                       3.1.0.0    Microsoft.PowerShell.Utility
```

## Steps b–e under PowerShell 7

Not run: `pwsh` is not installed on this machine (see 1a). Only Windows PowerShell
5.1 was available, so it is the only version this preflight exercised.

## 3. Git repository checks

Run with Git for Windows (`git version 2.54.0.windows.1`), opening a repository that
was created from a Linux environment for the first time under Windows git.

```
$ git status
On branch main
Untracked files:
  (use "git add <file>..." to include in what will be committed)
	docs/external/

nothing added to commit but untracked files present (use "git add" to track)

$ git log --oneline
ef0ee63 Bootstrap: project documents and reference prototype

$ git fsck --full
(no output — clean)

$ git config --local --list
core.repositoryformatversion=0
core.filemode=false
core.bare=false
core.logallrefupdates=true
core.symlinks=false
core.ignorecase=true
user.name=Martin Montero
user.email=scoutmontero@gmail.com
```

No "dubious ownership" message and no other error appeared. `docs/external/` is the
only untracked path, which is expected (Downtown source photos and notes added after
the first commit); it was not staged, modified or deleted.

## 4. Stale lock/tmp cleanup

Before deletion:

```
.git\stale-tmp — 20 files (.git_objects_*_tmp_obj_* leftovers from object writes)
.git\stale-HEAD-lock — 0 bytes
.git\stale-maintenance-lock — 0 bytes
```

All three were deleted. No git process held them; `git fsck --full` and
`git log --oneline` above were run before the deletion and showed a clean, intact
repository. After deletion:

```
stale-tmp exists: False
stale-HEAD-lock exists: False
stale-maintenance-lock exists: False
```

## Result

No step failed under any PowerShell found on this machine (PowerShell 5.1 only;
PowerShell 7 is not installed). Git opened the repository without error.
