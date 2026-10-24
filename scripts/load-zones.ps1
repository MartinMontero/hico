<#
.SYNOPSIS
Loads a property's zones from a JSON file into the LOCAL database: [ { "en": "Lobby", "fr": "Hall", "ring": "in_hostel" } ].
ring is in_hostel, short_walk or further. It refuses if any zone name already exists.
.EXAMPLE
.\scripts\load-zones.ps1 -Slug vancouver-east -File .\zones.json
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory)][string]$Slug,
    [Parameter(Mandatory)][string]$File,
    [switch]$Remote,
    [string]$StateDir
)
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'operator-common.ps1')
$full = (Resolve-Path -LiteralPath $File).Path
Invoke-Operator -Command 'load-zones' -Arguments @('--slug', $Slug, '--file', $full) -Remote:$Remote -StateDir $StateDir
