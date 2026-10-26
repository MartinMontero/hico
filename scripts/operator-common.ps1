# Shared by the operator scripts: dot-source it, then call Invoke-Operator.
# Every script defaults to the LOCAL database. -Remote is a guarded path (see scripts\operator.ts): it prints what it
# would do, needs -Slug and you typing the slug, and in this phase it never runs anything on a remote database.
function Invoke-Operator {
    param(
        [Parameter(Mandatory)][string]$Command,
        [string[]]$Arguments = @(),
        [switch]$Remote,
        [string]$StateDir
    )
    $repo = Split-Path -Parent $PSScriptRoot
    # Join-Path uses the separator of the machine it runs on: a literal backslash is not a path on Linux (found by CI).
    $all = @((Join-Path 'scripts' 'operator.ts'), $Command) + $Arguments
    if ($StateDir) { $all += @('--state-dir', $StateDir) }
    if ($Remote) { $all += '--remote' }
    Push-Location $repo
    try {
        & node @all
        if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    }
    finally {
        Pop-Location
    }
}
