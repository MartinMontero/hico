#Requires -Version 7.4
<#
.SYNOPSIS
Checks that an existing hico-preview workers.dev deployment fails closed without a preview cookie.
.DESCRIPTION
This script sends only unauthenticated GET requests. It does not deploy, change DNS, access D1, or accept a secret.
The authorized guest/staff, QR, passkey, install, offline and real-device checks remain human steps.
.EXAMPLE
.\scripts\verify-deploy.ps1 -PreviewHost hico-preview.your-account.workers.dev
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory)]
    [ValidatePattern('^hico-preview\.[a-z0-9-]+\.workers\.dev$')]
    [string]$PreviewHost
)
$ErrorActionPreference = 'Stop'
$baseUrl = "https://$PreviewHost"
$failures = [System.Collections.Generic.List[string]]::new()

function Get-PreviewResponse([string]$Path) {
    return Invoke-WebRequest -Uri ($baseUrl + $Path) -Method Get -SkipHttpErrorCheck -MaximumRedirection 0 -TimeoutSec 30
}

$protectedPaths = @('/', '/assets/not-a-real-file.js', '/api/hosts/properties', '/api/p/not-a-property/config')
foreach ($path in $protectedPaths) {
    try {
        $response = Get-PreviewResponse $path
        if ([int]$response.StatusCode -ne 404) { $failures.Add("$path returned $([int]$response.StatusCode), expected 404") }
        if ($response.Content -ne "Not Found`n") { $failures.Add("$path did not return the flat gate response") }
        if ($response.Headers['Cache-Control'] -notcontains 'private, no-store' -and $response.Headers['Cache-Control'] -ne 'private, no-store') {
            $failures.Add("$path is missing private, no-store")
        }
        if ([string]$response.Headers['X-Robots-Tag'] -notmatch 'noindex') { $failures.Add("$path is missing noindex") }
    }
    catch {
        $failures.Add("$path request failed: $($_.Exception.Message)")
    }
}

try {
    $robots = Get-PreviewResponse '/robots.txt'
    if ([int]$robots.StatusCode -ne 200 -or $robots.Content -notmatch 'Disallow: /') {
        $failures.Add('/robots.txt must return 200 and Disallow: /')
    }
}
catch {
    $failures.Add("/robots.txt request failed: $($_.Exception.Message)")
}

if ($failures.Count -gt 0) {
    $failures | ForEach-Object { Write-Error $_ }
    throw 'Deployed-preview verification failed. Do not hand this URL to testers.'
}
Write-Host 'Unauthenticated deployed-preview checks passed. No remote resource was changed.'
Write-Host 'Next: a person must redeem the preview link privately and complete the authorized human test checklist.'
