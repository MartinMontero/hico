# Windows preflight — third record (PowerShell 7)

Run on 2026-10-23, about 21:12 (machine clock), from the Claude desktop app session
described in `docs\spikes\preflight-desktop.md`. Neither earlier record
(`preflight.md`, `preflight-desktop.md`) was edited.

## Installs made for this record (approved in chat)

| Tool | Command | Source | Result |
| --- | --- | --- | --- |
| PowerShell 7.6.8 | `winget install --id Microsoft.PowerShell --source winget --scope user` | Microsoft winget source, installer hash verified | Installed as an app package; `pwsh.exe` at `C:\Users\User\AppData\Local\Microsoft\WindowsApps\pwsh.exe` |
| Wrangler 4.152.0 | `npm install -g wrangler@4.152.0` | npm registry | Installed globally (34 packages); `wrangler --version` → `4.152.0`; shim at `C:\Users\User\AppData\Roaming\npm\wrangler.ps1` |

No `package.json` was created. No Wrangler command other than `--version` was run,
and Cloudflare was not contacted. The Wrangler version matches the one
`docs\11-DEPLOY.md` says its commands were checked against (4.152.0).

## Steps 2a–2e under PowerShell 7.6.8 (Core)

Same script as the 5.1 run in `preflight-desktop.md`. The key was never printed or
written.

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
Timestamp: 20261023-211209
Folder exists after line: True
Folder exists after removal: False
=== 2d ===
File count: 14
First extract succeeded. File count in extract folder: 14
Edited marker added. Hash before second extract: 8D65F8DA32E0E1A2D259BF2779AAD735B7AEBDA54F4E039921112F0B138A49A9
Second extract stopped with error: Failed to create file 'C:\Users\User\AppData\Local\Temp\hico-pf2-extract\00-README.md' while expanding the archive file 'C:\Users\User\AppData\Local\Temp\hico-pf2-docs.zip' contents as the file 'C:\Users\User\AppData\Local\Temp\hico-pf2-extract\00-README.md' already exists. Use the -Force parameter if you want to overwrite the existing directory 'C:\Users\User\AppData\Local\Temp\hico-pf2-extract\00-README.md' contents when expanding the archive file.
Hash after second extract attempt: 8D65F8DA32E0E1A2D259BF2779AAD735B7AEBDA54F4E039921112F0B138A49A9
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

## Comparison with the PowerShell 5.1 run (preflight-desktop.md)

| Step | Result | Detail |
| --- | --- | --- |
| 2a. node, npm, git, `claude --version` | Same | v24.16.0, 11.13.0, git 2.54.0.windows.1, 2.1.310. |
| 2a. PowerShell version | Different | 7.6.8 Core instead of 5.1.26100.9711 Desktop. |
| 2a. `Get-Command` | Different | `wrangler` and `pwsh` are now found because of the installs above; `claude` is unchanged. |
| 2b. Key recipe | Same | Length 43, pattern True, runs differ True. |
| 2c. Timestamp / folder | Same | Only the timestamp value differs. |
| 2d. Zip / extract | Same outcome | 14 files; second extract errors; edited file untouched; identical hash to the 5.1 run. Under 7 the error stops with `-ErrorAction Stop` as in 5.1. |
| 2e. Cmdlets | Same presence, different versions | Set-Clipboard and Get-FileHash 7.0.0.0 (Cmdlets), Expand-Archive 1.2.6 (Function); under 5.1 they were 3.1.0.0, 1.0.1.0 and 3.1.0.0, and Get-FileHash was a Function. |

Not verified: `Set-Clipboard` was only checked for existence, not run. Whether the
bare `-ErrorAction Stop`-less `Expand-Archive` call in PowerShell 7 throws on its own
was not tested; the script used `-ErrorAction Stop` in both versions.
