<#
.SYNOPSIS
Prints a one-time recovery link for a staff person in the LOCAL database, for a property whose only admin lost their only device.
When they use it, every earlier passkey and sign-in of theirs stops working.
.EXAMPLE
.\scripts\issue-recovery-link.ps1 -Email admin@example.org
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory)][string]$Email,
    [string]$Origin = 'http://localhost:5173',
    [string]$Slug,
    [switch]$Remote,
    [string]$StateDir
)
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'operator-common.ps1')
$a = @('--email', $Email, '--origin', $Origin)
if ($Slug) { $a += @('--slug', $Slug) }
Invoke-Operator -Command 'issue-recovery-link' -Arguments $a -Remote:$Remote -StateDir $StateDir
