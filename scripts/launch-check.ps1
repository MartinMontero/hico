#Requires -Version 7.4
<#
.SYNOPSIS
Runs the complete local validation and checks the PREVIEW configuration. It never deploys or changes a remote resource.
.EXAMPLE
.\scripts\launch-check.ps1 -PreviewHost hico-preview.your-account.workers.dev
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory)]
    [ValidatePattern('^hico-preview\.[a-z0-9-]+\.workers\.dev$')]
    [string]$PreviewHost
)
$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
Push-Location $repo
try {
    $nodeVersion = & node --version
    if ($LASTEXITCODE -ne 0 -or $nodeVersion -notmatch '^v(\d+)\.' -or [int]$Matches[1] -lt 24) {
        throw 'Node 24 or newer is required. Install it, open a new PowerShell window, and retry.'
    }
    if (-not (Test-Path (Join-Path $repo 'node_modules'))) {
        throw 'Dependencies are missing. Run npm ci first.'
    }

    $config = Get-Content -Raw (Join-Path $repo 'wrangler.jsonc')
    $preview = ($config -split '"env"\s*:', 2)[0]
    if ($preview -notmatch '"name"\s*:\s*"hico-preview"') { throw 'The top-level Worker must be hico-preview.' }
    if ($preview -match '00000000-0000-0000-0000-000000000000') { throw 'Replace the preview D1 placeholder ID locally before launch.' }
    if ($preview -notmatch '"PREVIEW_GATE"\s*:\s*"on"') { throw 'The preview gate must be on.' }
    if ($preview -notmatch ('"RP_ID"\s*:\s*"' + [regex]::Escape($PreviewHost) + '"')) {
        throw "RP_ID must be $PreviewHost. Passkeys are bound to this hostname."
    }
    if ($preview -notmatch ('"ALLOWED_ORIGINS"\s*:\s*"[^"]*https://' + [regex]::Escape($PreviewHost))) {
        throw "ALLOWED_ORIGINS must include https://$PreviewHost."
    }

    & npm run validate
    if ($LASTEXITCODE -ne 0) { throw 'Local validation failed. Do not deploy this branch.' }
    Write-Host 'Local launch checks passed. No remote resource was changed.'
    Write-Host 'Still required: real property content, local secret setup, deployment, and human device/security reviews.'
}
finally {
    Pop-Location
}
