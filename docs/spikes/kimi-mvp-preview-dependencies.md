# Dependency review — Kimi MVP preview

Reviewed: 2026-11-02. The lockfile is unchanged by the preview/offline fix. This is a source and lockfile review, not a claim that the development toolchain is vulnerability-free.

Evidence labels: **[V]** verified output; **[R]** reasoning from verified evidence; **[I]** inference; **[A]** assumption; **[U]** unverified.

## Result

- [V] `npm audit --json` reported **16 vulnerable package entries: 13 moderate and 3 high**. These are package entries, not 16 distinct advisories.
- [V] The advisory sources are **10 distinct GHSA records**: one in `minimatch`, eight in `undici`, and one in `zod`.
- [V] `npm ls --omit=dev` for the flagged packages returned `(empty)`. The six production direct dependencies are the SimpleWebAuthn browser/server packages, Hono, `lean-qr`, Preact, and Valibot.
- [V] A source scan found no imports of `minimatch`, `undici`, `zod`, `wrangler`, `miniflare`, ESLint, or TypeScript-ESLint in `worker`, `web/src`, `web/sw`, or `shared`.
- [V] A string scan of the available built output found no flagged-package markers. [I] That supports, but does not by itself prove, non-reachability.
- [R] The known findings are in development, test, build, and audit tooling. No production-runtime dependency path to the flagged packages was found.
- [U] This is not a Software Bill of Materials, a full transitive-call analysis, or an independent supply-chain assessment. A human reviewer should repeat the audit against the final deployment lockfile.

## Direct advisory sources

| Package in the lockfile | Version | Audit severity | Advisories |
|---|---:|---|---|
| `minimatch` | 10.2.6 | moderate | GHSA-g3hv-75wg-m249: ReDoS from a `*` followed by multiple `?` wildcards with `noext` |
| `undici` | 7.29.1 | high | GHSA-4qv8-2p9j-2685: unbounded decompression chain |
| `undici` | 7.29.1 | high | GHSA-f72v-6w45-q472: missing WebSocket frame-size limit |
| `undici` | 7.29.1 | moderate | GHSA-xjj6-f33q-929c: predictable WebSocket masking key |
| `undici` | 7.29.1 | high | GHSA-4w7w-5xrc-9h26: unbounded WebSocket 64-bit payload length |
| `undici` | 7.29.1 | high | GHSA-2m5v-pch6-74hx: CRLF injection in `WebSocket` constructor |
| `undici` | 7.29.1 | moderate | GHSA-qrxm-fqhp-jwvm: Proxy-Authorization not cleared on cross-origin redirect |
| `undici` | 7.29.1 | moderate | GHSA-9fm3-97px-rjf6: random values bias toward `Math.random` when the entropy pool is exhausted |
| `undici` | 7.29.1 | moderate | GHSA-55wc-3pg8-jfw6: unbounded memory consumption in `response.arrayBuffer()` |
| `zod` | 4.6.5 | high | GHSA-mrhx-c7xc-m3w5: NoSQL injection through unvalidated `$` keys in record/object schemas |

[V] The locked versions above and advisory details come from the actual npm audit output. They are not inferred from package names.

## Why npm reports 16 package entries

The same vulnerable packages are reached through several development tools. npm also marks dependent packages as affected even when they do not contain the advisory code themselves.

- [V] `@cloudflare/vite-plugin@1.65.0` and `@cloudflare/vitest-plugin@1.4.7` reach Miniflare and Wrangler. The locked chain includes `wrangler@4.152.0`, `miniflare@5.20261019.2-beta`, and nested `undici@7.29.1`.
- [V] The Cloudflare Vite plugin chain also reaches `zod@4.6.5`; the same Zod package is shared by Lighthouse/Puppeteer tooling in the lockfile.
- [V] `eslint@10.13.0` and `typescript-eslint@8.72.0` reach `minimatch@10.2.6`.
- [V] Other reported entries such as `@eslint-community/eslint-utils` are dependency-chain effects, not additional direct advisory sources.

## Remediation constraints

Do **not** run `npm audit fix --force` on this branch.

- [V] npm suggested `@cloudflare/vite-plugin@1.67.0` as a non-major update.
- [V] The same audit metadata suggested `eslint@4.0.0` and `typescript-eslint@8.14.0`. Those are older than the currently locked ESLint and TypeScript-ESLint lines and are not an acceptable automatic remediation.
- [R] Dependency upgrades must be selected deliberately and verified from the resulting lockfile; changing a top-level version alone does not prove that every vulnerable transitive copy is gone.

## Safe next action for a local maintainer

Work on a separate dependency-update branch. Do not deploy from it until the complete validation suite and reviewer are green.

```powershell
Set-Location $HOME\dev\hico
npm install --save-dev @cloudflare/vite-plugin@1.67.0
npm audit --json
npm ls minimatch undici zod wrangler miniflare eslint typescript-eslint
```

[R] The first command is the non-major starting point explicitly proposed by the recorded audit, not a claim that it resolves all ten advisories. Upgrade the remaining supported Cloudflare, ESLint, and TypeScript-ESLint toolchain versions as needed. Prefer supported upstream releases that bring in `undici >= 7.30.1`, `zod >= 4.6.6`, and `minimatch >= 11.0.1`; do not force overrides without compatibility testing.

Then run:

```powershell
npm ci
npx playwright install chromium
node scripts/validate.ts
npm audit --json
```

Done when the dependency diff is understood, no automatic downgrade occurred, all validation passes, and the final audit is recorded. Any remaining advisory must be documented with its actual dependency path rather than dismissed solely as “dev only.”
