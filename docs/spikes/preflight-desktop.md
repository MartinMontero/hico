# Windows preflight — second record (run from the Claude desktop app session)

Run on 2026-10-23 (machine clock; `Get-Date` → `Friday, October 23, 2026 8:54:26 PM`).
Nothing was installed or deployed. The execution policy was not changed. The first
record, `docs\spikes\preflight.md`, was read and not edited.

PowerShell versions found: Windows PowerShell 5.1 (Desktop edition, build 26100.9711,
`C:\WINDOWS\System32\WindowsPowerShell\v1.0\powershell.exe`). PowerShell 7 (`pwsh`) is
not installed (`Get-Command pwsh` returned nothing), so steps 2a–2e ran only under
5.1. This session has a native PowerShell tool, so no `powershell.exe -Command`
wrapping was needed for step 1 and step 4; step 2 ran through
`powershell.exe -NoProfile -Command` with the script text loaded as a script block
(no `.ps1` file was executed, so the execution policy was not involved).

## 1. Where this session runs (PowerShell 5.1)

Parent chain from the PowerShell process that runs this session's commands
(`Get-CimInstance Win32_Process`, no command lines):

```
L0  ProcessId=19684  Name=powershell.exe  ExecutablePath=C:\WINDOWS\System32\WindowsPowerShell\v1.0\powershell.exe  ParentProcessId=21372
L1  ProcessId=21372  Name=cmd.exe  ExecutablePath=C:\WINDOWS\System32\cmd.exe  ParentProcessId=22244
L2  ProcessId=22244  Name=claude.exe  ExecutablePath=C:\Users\User\AppData\Local\Claude-Data\claude_pzs8sxrjxfjjc\claude-code\2.1.308\c17a819afb40\claude.exe  ParentProcessId=23716
L3  ProcessId=23716  Name=claude.exe  ExecutablePath=C:\Program Files\WindowsApps\Claude_3.6556.2.0_x64__pzs8sxrjxfjjc\app\claude.exe  ParentProcessId=8880
L4  ProcessId=8880  Name=sihost.exe  ExecutablePath=C:\WINDOWS\system32\sihost.exe  ParentProcessId=2712
L5  ProcessId=2712  Name=svchost.exe  ExecutablePath=  ParentProcessId=1348
L6  ProcessId=1348  Name=services.exe  ExecutablePath=  ParentProcessId=1264
L7  ProcessId=1264  Name=wininit.exe  ExecutablePath=  ParentProcessId=980
```

Reading of the chain: the shell's parent is `cmd.exe`, whose parent is a Claude
Code engine binary (`...\Claude-Data\...\claude-code\2.1.308\...\claude.exe`), whose
parent is the packaged Claude desktop application
(`C:\Program Files\WindowsApps\Claude_3.6556.2.0_x64__...\app\claude.exe`), whose parent
is `sihost.exe` (the Windows shell host). No `WindowsTerminal.exe`, `conhost`-hosted
`powershell.exe`/`cmd.exe` terminal window, or shell sits above the Claude engine. From
the chain alone, this session was launched by the Claude desktop application, which ran
its bundled Claude Code 2.1.308 binary.

Version the session reports for itself: Claude Code **2.1.308**. Found from two
independent places: the engine's own path (`...\claude-code\2.1.308\...`, process
22244) and the environment variable `AI_AGENT=claude-code_2-1-308_agent`. Related
variables in the same environment (secret-bearing ones redacted, not recorded):
`CLAUDE_CODE_ENTRYPOINT=claude-desktop`, `CLAUDE_CODE_DESKTOP_APP_VERSION=3.6556.2`,
`CLAUDE_AGENT_SDK_VERSION=0.3.308`, `CLAUDE_CODE_SESSION_ATTENDED=1`. These
corroborate the chain; the chain alone already settles it. This version is not the
`claude --version` on the PATH (2.1.310, below).

## 2a. Versions and command availability (PowerShell 5.1)

```
Major Minor Build Revision
----- ----- ----- --------
5     1     26100 9711

PSEdition: Desktop
node --version -> v24.16.0
npm --version -> 11.13.0
git --version -> git version 2.54.0.windows.1
claude --version -> 2.1.310 (Claude Code)

Name       CommandType Source
----       ----------- ------
claude.exe Application C:\Users\User\.local\bin\claude.exe
```

`wrangler` and `pwsh` were not found (the `Get-Command` call listed only `claude`).

## 2b. Key recipe (docs\11-DEPLOY.md §2, without Set-Clipboard and wrangler lines), PowerShell 5.1

Only length, pattern match and difference were printed. The key was never printed or
written to a file.

```
Run1 length: 43
Run1 matches pattern: True
Run2 length: 43
Run2 matches pattern: True
Runs differ: True
```

## 2c. Timestamp line and backup-folder line (docs\11-DEPLOY.md §4), PowerShell 5.1

`$HOME\dev\hico-preflight-test` did not exist beforehand. The folder was removed after.

```
Timestamp: 20261023-205417
Folder exists after line: True
Folder exists after removal: False
```

## 2d. Zip and extract-without-overwrite, PowerShell 5.1

Zip of `docs\*.md` (top level) and `CLAUDE.md` under `$env:TEMP`; the edited extracted
file was the extracted copy of `CLAUDE.md`.

```
File count: 14
First extract succeeded. File count in extract folder: 14
Edited marker added. Hash before second extract: 8D65F8DA32E0E1A2D259BF2779AAD735B7AEBDA54F4E039921112F0B138A49A9
Second extract stopped with error: Failed to create file 'C:\Users\User\AppData\Local\Temp\hico-pf2-extract\00-README.md' while expanding the archive file 'C:\Users\User\AppData\Local\Temp\hico-pf2-docs.zip' contents as the file 'C:\Users\User\AppData\Local\Temp\hico-pf2-extract\00-README.md' already exists. Use the -Force parameter if you want to overwrite the existing directory 'C:\Users\User\AppData\Local\Temp\hico-pf2-extract\00-README.md' contents when expanding the archive file.
Hash after second extract attempt: 8D65F8DA32E0E1A2D259BF2779AAD735B7AEBDA54F4E039921112F0B138A49A9
Edited file left untouched: True
Marker still present: True
Cleanup done. Zip exists: False. Extract folder exists: False
```

Note: in an earlier attempt of this same step the second `Expand-Archive` call did not
use `-ErrorAction Stop`. Under PowerShell 5.1 it then wrote one non-terminating error
per existing file (14 of them, same wording), did not throw, and still left the edited
file untouched (same hash). The output above is from the rerun with
`-ErrorAction Stop`, which is what makes the command stop. Temporary files from both
attempts were removed.

## 2e. Required cmdlets (PowerShell 5.1)

```
CommandType Name           Version Source
----------- ----           ------- ------
     Cmdlet Set-Clipboard  3.1.0.0 Microsoft.PowerShell.Management
   Function Expand-Archive 1.0.1.0 Microsoft.PowerShell.Archive
   Function Get-FileHash   3.1.0.0 Microsoft.PowerShell.Utility
```

## 2 under PowerShell 7

Not run: `pwsh` is not installed.

## 4. Git repository checks (before the commit)

```
$ git status
On branch main
Untracked files:
  (use "git add <file>..." to include in what will be committed)
	docs/external/

nothing added to commit but untracked files present (use "git add" to track)
$ git log --oneline
117fb3a Add Windows preflight results
ef0ee63 Bootstrap: project documents and reference prototype
$ git fsck --full
(exit code 0)
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

No "dubious ownership" message or other error. `docs/external/` was not staged,
modified or deleted.

## Comparison with docs\spikes\preflight.md

The first record numbers its sections 1a–1e, 3 and 4; this record uses the step
numbers of the task (1, 2a–2e, 4). Matching is by content.

| Step | Result | Detail |
| --- | --- | --- |
| 1. Where the session runs | Different (new) | The first record has no process chain and does not say which application ran it. This record shows the chain: desktop application → bundled engine 2.1.308 → `cmd.exe` → `powershell.exe`. |
| 2a. PowerShell version | Same | 5.1.26100.9711, Desktop. |
| 2a. node, npm, git | Same | v24.16.0, 11.13.0, git 2.54.0.windows.1. |
| 2a. `claude --version` on the PATH | Same | 2.1.310 in both. |
| 2a. `Get-Command` | Different (scope) | The first record asked for `wrangler,pwsh` only and found neither. This run also asked for `claude` and found `C:\Users\User\.local\bin\claude.exe`; `wrangler` and `pwsh` are still absent. |
| Session's own Claude Code version | Different | The task brief says the first session showed v2.1.243. This session reports 2.1.308 (engine path, `AI_AGENT`). Neither equals the PATH binary 2.1.310. |
| 2b. Key recipe | Same | Length 43, pattern True, runs differ True. |
| 2c. Timestamp / folder | Same | Folder created and removed. Only the timestamp differs (20261023-201509 then, 20261023-205417 now). |
| 2d. Zip / extract | Same outcome | 14 files, second extract errors, edited file untouched. Differences: the edited file here is `CLAUDE.md` (the first record used `00-README.md`), so the hash differs (8D65F8DA… vs A4A3D914…); and this record notes that the stop depends on `-ErrorAction Stop`, which the first record does not mention. |
| 2e. Cmdlets | Same | Set-Clipboard 3.1.0.0, Expand-Archive 1.0.1.0, Get-FileHash 3.1.0.0, same sources. |
| 2 under PowerShell 7 | Same | Not run in either; `pwsh` is not installed. |
| 4 / first record §3. Git checks | Different (one line) | `git log --oneline` now also lists `117fb3a Add Windows preflight results`, the commit made from the first record. `git status`, `git fsck --full` (clean) and `git config --local --list` are identical; no dubious-ownership message. |
| First record §4 (stale lock/tmp cleanup) | Not repeated | Not part of this task. |
