# Windows preflight — fourth record (rerun under both PowerShells)

Run on 2026-10-23 (machine clock; `Get-Date` → `Friday, October 23, 2026 9:19:47 PM`),
from the Claude desktop app session described in `preflight-desktop.md`. This rerun
was done after PowerShell 7.6.8 and Wrangler 4.152.0 were installed (D-16), so unlike
the earlier runs it covers both shells. Nothing was installed or deployed during the
rerun itself. The execution policy was not changed. Wrangler was not run at all.
No earlier record was edited. Step 1 and step 4 ran in the session's PowerShell tool
(Windows PowerShell 5.1); step 2 ran once through `powershell.exe -NoProfile -Command`
(5.1) and once through `pwsh -NoProfile -Command` (7.6.8), with the script text loaded
as a script block so no `.ps1` file was executed.

## 1. Where this session runs (PowerShell 5.1)

```
L0  ProcessId=20736  Name=powershell.exe  ExecutablePath=C:\WINDOWS\System32\WindowsPowerShell\v1.0\powershell.exe
L1  ProcessId=14784  Name=cmd.exe  ExecutablePath=C:\WINDOWS\System32\cmd.exe
L2  ProcessId=3604  Name=claude.exe  ExecutablePath=C:\Users\User\AppData\Local\Claude-Data\claude_pzs8sxrjxfjjc\claude-code\2.1.308\c17a819afb40\claude.exe
L3  ProcessId=23716  Name=claude.exe  ExecutablePath=C:\Program Files\WindowsApps\Claude_3.6556.2.0_x64__pzs8sxrjxfjjc\app\claude.exe
L4  ProcessId=8880  Name=sihost.exe  ExecutablePath=C:\WINDOWS\system32\sihost.exe
L5  ProcessId=2712  Name=svchost.exe  ExecutablePath=
L6  ProcessId=1348  Name=services.exe  ExecutablePath=
L7  ProcessId=1264  Name=wininit.exe  ExecutablePath=
```

From the chain alone: the shell's parent is `cmd.exe`, above it a Claude Code engine
binary under `...\claude-code\2.1.308\...`, above that the packaged Claude desktop
application (`...\WindowsApps\Claude_3.6556.2.0_x64__...\app\claude.exe`), above that
`sihost.exe`. No terminal window or Windows Terminal is in the chain. This session was
launched by the Claude desktop application.

Version the session reports for itself: Claude Code **2.1.308**, from the engine's
folder name and from `AI_AGENT=claude-code_2-1-308_agent`. Also in the environment:
`CLAUDE_CODE_ENTRYPOINT=claude-desktop`, `CLAUDE_CODE_DESKTOP_APP_VERSION=3.6556.2`.
The engine process ID changed from the earlier record (22244 then, 3604 now) while the
desktop application's ID (23716) is the same, so the app stayed up and started a new
engine process. `$HOME\dev\hico-preflight-test` did not exist before step 2c.

## 2 under Windows PowerShell 5.1

```
##### Running under: Desktop 5.1.26100.9711 (host process: C:\WINDOWS\System32\WindowsPowerShell\v1.0\powershell.exe)
=== 2a ===

Major Minor Build Revision
----- ----- ----- --------
5     1     26100 9711

PSEdition: Desktop
node --version -> v24.16.0
npm --version -> 11.13.0
git --version -> git version 2.54.0.windows.1
claude --version -> 2.1.310 (Claude Code)

Name            CommandType Source
----            ----------- ------
claude.exe      Application C:\Users\User\.local\bin\claude.exe
wrangler.ps1 ExternalScript C:\Users\User\AppData\Roaming\npm\wrangler.ps1
pwsh.exe        Application C:\Users\User\AppData\Local\Microsoft\WindowsApps\pwsh.exe

=== 2b ===
Run1 length: 43
Run1 matches pattern: True
Run2 length: 43
Run2 matches pattern: True
Runs differ: True
=== 2c ===
Timestamp: 20261023-211941
Folder exists after line: True
Folder exists after removal: False
=== 2d ===
File count: 14
First extract succeeded. File count in extract folder: 14
Edited marker added. Hash before second extract: 6F85DCA0648D6735D54DF0B2EFC221556B97F2A30A5C22BA5D93F75C28121A49
Second extract stopped with error: Failed to create file 'C:\Users\User\AppData\Local\Temp\hico-pf2-extract\00-README.md' while expanding the archive file 'C:\Users\User\AppData\Local\Temp\hico-pf2-docs.zip' contents as the file 'C:\Users\User\AppData\Local\Temp\hico-pf2-extract\00-README.md' already exists. Use the -Force parameter if you want to overwrite the existing directory 'C:\Users\User\AppData\Local\Temp\hico-pf2-extract\00-README.md' contents when expanding the archive file.
Hash after second extract attempt: 6F85DCA0648D6735D54DF0B2EFC221556B97F2A30A5C22BA5D93F75C28121A49
Edited file left untouched: True
Marker still present: True
Cleanup done. Zip exists: False. Extract folder exists: False
=== 2e ===

CommandType Name           Version Source
----------- ----           ------- ------
     Cmdlet Set-Clipboard  3.1.0.0 Microsoft.PowerShell.Management
   Function Expand-Archive 1.0.1.0 Microsoft.PowerShell.Archive
   Function Get-FileHash   3.1.0.0 Microsoft.PowerShell.Utility
```

## 2 under PowerShell 7.6.8

```
##### Running under: Core 7.6.8 (host process: C:\Program Files\WindowsApps\Microsoft.PowerShell_7.6.8.0_x64__8wekyb3d8bbwe\pwsh.exe)
=== 2a ===

Major Minor Patch PreReleaseLabel BuildLabel
----- ----- ----- --------------- ----------
7     6     8

PSEdition: Core
node --version -> v24.16.0
npm --version -> 11.13.0
git --version -> git version 2.54.0.windows.1
claude --version -> 2.1.310 (Claude Code)

Name            CommandType Source
----            ----------- ------
claude.exe      Application C:\Users\User\.local\bin\claude.exe
wrangler.ps1 ExternalScript C:\Users\User\AppData\Roaming\npm\wrangler.ps1
pwsh.exe        Application C:\Users\User\AppData\Local\Microsoft\WindowsApps\Microsoft.PowerShell_8wekyb3d8bbwe\pwsh.exe

=== 2b ===
Run1 length: 43
Run1 matches pattern: True
Run2 length: 43
Run2 matches pattern: True
Runs differ: True
=== 2c ===
Timestamp: 20261023-211946
Folder exists after line: True
Folder exists after removal: False
=== 2d ===
File count: 14
First extract succeeded. File count in extract folder: 14
Edited marker added. Hash before second extract: 6F85DCA0648D6735D54DF0B2EFC221556B97F2A30A5C22BA5D93F75C28121A49
Second extract stopped with error: Failed to create file 'C:\Users\User\AppData\Local\Temp\hico-pf2-extract\00-README.md' while expanding the archive file 'C:\Users\User\AppData\Local\Temp\hico-pf2-docs.zip' contents as the file 'C:\Users\User\AppData\Local\Temp\hico-pf2-extract\00-README.md' already exists. Use the -Force parameter if you want to overwrite the existing directory 'C:\Users\User\AppData\Local\Temp\hico-pf2-extract\00-README.md' contents when expanding the archive file.
Hash after second extract attempt: 6F85DCA0648D6735D54DF0B2EFC221556B97F2A30A5C22BA5D93F75C28121A49
Edited file left untouched: True
Marker still present: True
Cleanup done. Zip exists: False. Extract folder exists: False
=== 2e ===

CommandType Name           Version Source
----------- ----           ------- ------
     Cmdlet Set-Clipboard  7.0.0.0 Microsoft.PowerShell.Management
   Function Expand-Archive 1.2.6   Microsoft.PowerShell.Archive
     Cmdlet Get-FileHash   7.0.0.0 Microsoft.PowerShell.Utility
```

The key was never printed or written. The temporary zip and extract folder, and
`$HOME\dev\hico-preflight-test`, were removed in each run. The hash differs from the
earlier records because the edited extracted file is the copy of `CLAUDE.md`, which
was edited in the working tree before this run (the Wrangler/PowerShell 7 correction).

## 4. Git repository checks

```
On branch main
Changes not staged for commit:
	modified:   CLAUDE.md
	modified:   docs/02-STATE.md
	modified:   docs/03-DECISIONS.md
	modified:   docs/09-CONTENT-AND-ONBOARDING.md
	modified:   docs/12-EVIDENCE-REGISTER.md

Untracked files:
	docs/external/

030e897 Add PowerShell 7 preflight record
30d75f3 Add second Windows preflight record
117fb3a Add Windows preflight results
ef0ee63 Bootstrap: project documents and reference prototype
(git fsck --full: no output, exit 0)
core.repositoryformatversion=0
core.filemode=false
core.bare=false
core.logallrefupdates=true
core.symlinks=false
core.ignorecase=true
user.name=Martin Montero
user.email=scoutmontero@gmail.com
```

(Hint lines from `git status` omitted.) No "dubious ownership" message or other error.
`docs/09-CONTENT-AND-ONBOARDING.md` and `docs/12-EVIDENCE-REGISTER.md` were modified
in the working tree by something other than this session's preflight (they apply
D-14 and D-15). They are not part of this record's commit.

## Comparison

Against `preflight-desktop.md` (second record, PowerShell 5.1) and
`preflight-pwsh7.md` (third record, PowerShell 7):

| Step | Result | Detail |
| --- | --- | --- |
| 1. Where the session runs | Same conclusion | Desktop application → engine 2.1.308 → `cmd.exe` → `powershell.exe`. Different process IDs for the engine, `cmd.exe` and `powershell.exe` (new engine process); the desktop application, `sihost.exe` and the system processes are the same. |
| Session's own version | Same | 2.1.308. PATH `claude --version` is still 2.1.310. |
| 2a under 5.1 | Different (one thing) | `Get-Command` now lists `wrangler.ps1` and `pwsh.exe` (installed after the second record). Versions of PowerShell, node, npm, git, claude unchanged. |
| 2a under 7 | Same | Identical to the third record. |
| 2b, 2c, 2e under 5.1 and 7 | Same | Key results identical; folder created and removed; same cmdlets and versions. Only the timestamp values differ. |
| 2d under 5.1 and 7 | Same outcome | 14 files; second extract errors; edited file untouched. The hash differs (6F85DCA0… vs 8D65F8DA…) because `CLAUDE.md` content changed. |
| 4. Git | Different | Log now ends with `030e897`; the working tree now shows modified tracked files (listed above), not only `docs/external/`. `git fsck --full` clean; config unchanged. |
| 5.1 vs 7 in this run | Same outcomes, different cmdlet versions | Presence and results match; Set-Clipboard/Get-FileHash/Expand-Archive are 3.1.0.0/3.1.0.0/1.0.1.0 under 5.1 and 7.0.0.0/7.0.0.0/1.2.6 under 7. |

Not verified: Wrangler's behaviour (only `--version` was run in the third record, and
nothing this time) and whether it is logged in to Cloudflare; `Set-Clipboard` was
checked for existence only; why the PATH `claude` (2.1.310) is newer than the engine
the desktop app runs (2.1.308).
