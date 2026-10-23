# DEPLOY — HI CO

How HI CO is put on Cloudflare, checked, and rolled back. Labels as in
`00-README.md`.

**Status of the PowerShell.** On 2026-10-23 every PowerShell block in `00`, `10` and
`11` was parsed with PowerShell 7.6.8, and the key recipe, the timestamp line and the
extract-without-overwrite behaviour were run, on a Linux machine, not Windows `[V]`.
None of it has run on Windows. The Windows path forms (`$HOME\dev`), `Set-Clipboard`
and the Wrangler commands were not exercised there `[U]`. The Wrangler command names
and flags were checked against `wrangler --help` for version 4.152.0 on 2026-10-23
`[V]`. The Phase 0 preflight (`10`) runs the local parts on your machine and shows the
output before you rely on them.

**Nothing in this file is run without your GO, announced in advance.** That covers
`d1 create`, `secret put`, `deploy`, remote migrations, restores, route or DNS
changes, and the plan upgrade.

## 1. Environments

| | Local | Preview | Production |
| --- | --- | --- | --- |
| Worker name | n/a | `hico-preview` | `hico-prod` |
| D1 database | local file under `.wrangler` | `hico-preview` | `hico-prod` |
| Address | `localhost` | `hico-preview.<account subdomain>.workers.dev` | A custom domain (O-03) |
| Guest access | open | Behind the preview key (`ACCESS_KEY`) | Open; from Stage 2, social features need a QR session |
| Plan | n/a | Free is acceptable | **Workers Paid** (`05` §8) |
| Data | Placeholder seed | Placeholder seed and test data only | Real content |

**Never** use the Worker names `hico`, `mec-trails`, `lume` or `lume-city`. `hico` is
the live prototype; deploying under that name would replace it. The build fails if a
configuration resolves to one of them (Phase 1).

## 2. Secrets

Secrets live only in Cloudflare, set with `wrangler secret put`. A secret is bound to
the Worker's name, not to the folder you run the command in, so always pass `--name`.
The app trims whitespace when it reads a secret, because piping from PowerShell can add
a newline.

| Name | Worker | Purpose | Notes |
| --- | --- | --- | --- |
| `ACCESS_KEY` | preview only | The preview gate key | You generate it, keep it in your password manager, and never paste it into a chat or a file |
| `SESSION_PEPPER` | both | Keyed hashing of session tokens and entry tokens (Stage 2 onward) | Rotating it signs every guest session out |
| `RATE_LIMIT_SECRET` | both | Source of the daily key that hashes network addresses for rate limits (Stage 2 onward) | The daily key is derived from this secret and the UTC date, so counters cannot be linked across days. Rotating it is harmless |
| Staff-auth secrets | both | Depend on the O-02 route | Named in the Phase 1b-2 plan |
| Wallet certificates and keys | prod | Phase 7 | Named in the Phase 7 plan |

Setting `ACCESS_KEY` on preview (you run this, so the key never passes through a
transcript). The key is copied to the clipboard so you can store it, then sent to
Cloudflare:

```powershell
$bytes = New-Object byte[] 32
$rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
$rng.GetBytes($bytes)
$key = [Convert]::ToBase64String($bytes).TrimEnd('=').Replace('+','-').Replace('/','_')
Set-Clipboard -Value $key
$key | npx wrangler secret put ACCESS_KEY --name hico-preview
Remove-Variable key, bytes, rng
```

Paste the clipboard into your password manager, then clear it with
`Set-Clipboard -Value ' '`.

`SESSION_PEPPER` and `RATE_LIMIT_SECRET` use the same recipe with the name changed and
without the clipboard line, once per secret per Worker (`--name hico-preview`, then `--name hico-prod`).

## 3. Resources you create once (GO needed)

D1 has no Canada location or jurisdiction `[V]`. Western North America is the nearest
hint, and a hint is best effort. Your decision on O-05 comes before production.

```powershell
npx wrangler d1 create hico-preview --location wnam
```

Wrangler prints the database id. Claude Code puts it into `wrangler.jsonc`. Repeat for
`hico-prod` only when production is approved.

## 4. Migrations

1. Make a backup folder outside the repository, because backups contain guest rows and
   must never reach git:

```powershell
New-Item -ItemType Directory -Force -Path "$HOME\dev\hico-backups" | Out-Null
```

2. Before any migration on a remote database, export it:

```powershell
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
npx wrangler d1 export hico-prod --remote --env prod --output "$HOME\dev\hico-backups\hico-prod-$stamp.sql"
```

3. Dry look at what will run, then apply (Wrangler prompts you to confirm the list):

```powershell
npx wrangler d1 migrations list hico-prod --remote --env prod
npx wrangler d1 migrations apply hico-prod --remote --env prod
```

Use `hico-preview` and no `--env` for preview. Wrangler states that a failed migration
is rolled back and the previous successful one stays applied `[V]` help text. Migrations
are forward-only: a fix is a new migration, never an edit to an applied one.

## 5. Deploying to preview (GO needed)

`--dry-run` uploads nothing and needs no GO `[I]`. The deploy that follows it does.

1. `npm run validate` passes. Claude Code pastes the raw output.
2. Secrets are set (§2).
3. Database exists and migrated (§3, §4).
4. Compile and check without uploading (`--dry-run` exists in this Wrangler version
   `[V]` help text), read the output, then deploy:

```powershell
npx wrangler deploy --dry-run
npx wrangler deploy
```

The top-level configuration is `hico-preview`. Confirm the printed Worker name before
you accept anything else. Wrangler deletes any variable that is not in the
configuration file unless told otherwise (`--keep-vars`); set variables in the file,
and set secrets only with `secret put`, which a deploy does not touch.

5. Run the post-deploy check (§7).

## 6. Deploying to production (GO needed)

Every step in §5, with `--env prod`, plus:

1. You have upgraded the account to Workers Paid. Only you can do this; it is a
   billing action `[U]` on the price (`05` §8).
2. O-03 is decided: the domain is a zone on this Cloudflare account, and the Worker's
   custom-domain route is in `wrangler.jsonc`. Attaching a route changes DNS for that
   hostname; that is a GO of its own.
3. The zone's Web Analytics automatic injection is off. LUME's SB-2 shows how a
   zone-level setting can add a script that the privacy policy disclaims; LUME's
   `SECURITY.md` describes the Configuration Rule used to disable it. Do this before the
   first production request, then confirm with §7.
4. The launch check (`09` §8) passes.
5. The privacy officer's answers to `06` §7 items 1 to 6 are in writing. Items 7 to 9
   are due before Stage 2 and item 10 before Stage 3 (item 11 only if distance bands
   between guests are ever proposed).
6. A fresh export of the production database exists (§4 step 2) before the first
   production migration, even if the database is empty.

## 7. Post-deploy check

Claude Code writes `scripts\verify-deploy.ps1` in Phase 3 and runs it on your machine
after every deploy. It takes the base address as a parameter and fails loudly. It must
verify, and print the evidence for:

- On preview: every path, including `/api/*`, answers a flat 404 without the key, except
  `/robots.txt`, which answers a Disallow as the original gate does. The key-bearing
  link redirects to the clean path with a cookie that is `HttpOnly`, `Secure` and
  `SameSite=Lax`.
- On production: the page, an API route and the service worker file return the headers
  in `05` §14, with exact values.
- The HTML, the service worker and the manifest contain no third-party host, and no
  `cloudflareinsights` or other beacon string. This is the SB-2 check.
- Stage 0: a labelled link opens the app, adds to the aggregate count and sets no
  cookie. From Stage 2: scanning a code creates a session and a revoked code does not.
- A deliberate cross-tenant request fails.
- `robots.txt` and the robots meta tag keep the app out of search results `[A]`.

On Windows PowerShell 5.1 and PowerShell 7 the HTTP error handling differs; the script
must be run and shown working on the version you use before you trust it.

## 8. Rollback

Code:

```powershell
npx wrangler rollback --name hico-prod --message "reason for the rollback"
```

Wrangler lists versions and asks you to confirm `[V]` help text. A rollback does not
undo a database migration.

Data: D1 Time Travel can restore to a point within the last 30 days `[V]` help text.
First record where you are, then restore:

```powershell
npx wrangler d1 time-travel info hico-prod --env prod
npx wrangler d1 time-travel restore hico-prod --env prod --timestamp 2026-11-01T14:30:00Z
```

The timestamp above is an example. A restore overwrites the current data. Take a fresh
export first (§4 step 2). Whether the restore prints a bookmark you can use to undo it
is `[U]` until the Phase 8 drill; do not rely on it.

## 9. Stopping things quickly

- **Stop all writes**, keeping reads: set the platform flag. Replace the command's flag
  value with `off` to resume. GO needed.

```powershell
npx wrangler d1 execute hico-prod --remote --env prod --command "UPDATE platform_flags SET value = 'on' WHERE key = 'read_only'"
```

- **Stop one feature at one property**: the admin turns the switch off in the console,
  or you use the operator script.
- **Revoke a leaked QR code**: rotate it in the console, then revoke its sessions.
- **Leaked preview key**: set a new `ACCESS_KEY` (§2). The old cookie stops working.
- **Anything involving guest data**: stop writes first, keep the logs, tell HI Canada's
  privacy officer (`06` §7). If the Quebec Act applies, HI Canada records the incident
  in its register (`06` §3).

## 10. Watching it

- `npx wrangler tail hico-prod --status error --format pretty` shows live errors.
- The Cloudflare dashboard shows usage against plan limits. On Free the daily limits
  stop service until 00:00 UTC `[V]`; on Paid they bill. Whether you can set a billing
  alert is `[U]`; check once you are on Paid.
- Logs must not contain cookies, tokens, display names or free text (`05` §10).

## 11. Steps only you can do

These need your accounts or a person's judgment; Claude Code cannot do them.

- Upgrade to Workers Paid.
- Decide and own the domain, and approve the DNS change.
- Create the Apple Pass Type ID and certificate and the Google Wallet issuer account
  (Phase 7 only).
- Obtain HI Canada's answers on marks, privacy, minors and membership.
- Arrange the human screen-reader accessibility audit and the native French review.
