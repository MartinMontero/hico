<#
.SYNOPSIS
Prints a one-time admin invite link for a property in the LOCAL database. The link is shown once, works once, expires in 30 minutes.
.EXAMPLE
.\scripts\invite-first-admin.ps1 -Slug demo-whistler -Email admin@example.org -Name 'Alex Admin'
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory)][string]$Slug,
    [Parameter(Mandatory)][string]$Email,
    [Parameter(Mandatory)][string]$Name,
    [string]$Origin = 'http://localhost:5173',
    [switch]$Remote,
    [string]$StateDir
)
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'operator-common.ps1')
$a = @('--slug', $Slug, '--email', $Email, '--name', $Name, '--origin', $Origin)
Invoke-Operator -Command 'invite-first-admin' -Arguments $a -Remote:$Remote -StateDir $StateDir
