<#
.SYNOPSIS
Adds a hostname to a property in the LOCAL database. A hostname may serve several properties; guests then reach each at /p/<slug>.
.EXAMPLE
.\scripts\add-hostname.ps1 -Slug vancouver-east -HostName east.example.org
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory)][string]$Slug,
    [Parameter(Mandatory)][string]$HostName,
    [switch]$Default,
    [switch]$Remote,
    [string]$StateDir
)
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'operator-common.ps1')
$a = @('--slug', $Slug, '--host', $HostName)
if ($Default) { $a += '--default' }
Invoke-Operator -Command 'add-hostname' -Arguments $a -Remote:$Remote -StateDir $StateDir
