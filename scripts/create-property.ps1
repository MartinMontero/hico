<#
.SYNOPSIS
Creates a property (a hostel) in the LOCAL database. It has no hostname, zones or staff until you add them.
.EXAMPLE
.\scripts\create-property.ps1 -Slug vancouver-east -NameEn 'Vancouver East' -NameFr 'Vancouver Est' -Timezone America/Vancouver
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory)][string]$Slug,
    [Parameter(Mandatory)][string]$NameEn,
    [string]$NameFr,
    [Parameter(Mandatory)][string]$Timezone,
    [string]$Address,
    [ValidateSet('en', 'fr', 'en,fr')][string]$Languages = 'en,fr',
    [switch]$Remote,
    [string]$StateDir
)
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'operator-common.ps1')
$a = @('--slug', $Slug, '--name-en', $NameEn, '--timezone', $Timezone, '--languages', $Languages)
if ($NameFr) { $a += @('--name-fr', $NameFr) }
if ($Address) { $a += @('--address', $Address) }
Invoke-Operator -Command 'create-property' -Arguments $a -Remote:$Remote -StateDir $StateDir
