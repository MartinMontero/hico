# Spike: preview WebAuthn uses the serialized local configuration

**Date:** 2026-11-03
**Result:** Rebuilding `dist` with the root local `.dev.vars` fixed both passkey-registration browser failures. The complete launch check then exited 0.

## Failing symptoms

The earlier launch evidence, `docs\spikes\2026-11-03-preview-launch-check-after-webauthn-fix.txt`, records two failures after **Create my passkey** was clicked:

- `tests\e2e\staff-auth.spec.ts:60` (`first admin: the invite link creates a passkey, signs in, and leaves the address bar`) timed out waiting for the **Your hostels** heading at line 67.
- `tests\e2e\staff-console.spec.ts:56` (`sign in with the invite, open the hostel, and the overview is axe-clean at 360 px`) timed out waiting for the same heading at line 59.

The remaining 24 tests that ran passed and 17 did not run. Direct per-test browser console text was not captured, so these observations alone do not assert a particular browser exception.

## Proven configuration chain

`[V]` Against the installed `@cloudflare/vite-plugin` 1.65.0 and Wrangler 4.152.0 source and resolver:

1. `vite build` serializes the top-level values from `wrangler.jsonc` into `dist\hico_preview\wrangler.json`.
2. The same build also serializes the root `.dev.vars` into `dist\hico_preview\.dev.vars`.
3. `.wrangler\deploy\config.json` points preview at the built Wrangler configuration. `vite preview` resolves that configuration together with its colocated serialized `.dev.vars`.
4. When that serialized `.dev.vars` exists, its values win; preview does not fall back to the Playwright `webServer.env` process values for the same keys, even with `CLOUDFLARE_INCLUDE_PROCESS_ENV=true`.

Consequently, changing only the root `.dev.vars`, or setting `RP_ID=localhost` in `webServer.env`, cannot repair an already-built `dist` that still contains the deployed preview RP ID. For local WebAuthn, the localhost values belong in the root gitignored `.dev.vars`, followed by a rebuild. `webServer.env` remains necessary for a fresh clone and CI, where no local `.dev.vars` is serialized and process-environment fallback supplies the test-only values.

## Verification

After `npm run build` with Node 24.16.0 and the Node PATH prepend, Wrangler's read-only `unstable_readConfig` plus `unstable_getMiniflareWorkerOptions` resolver was called against `dist\hico_preview\wrangler.json` with the Playwright test process environment. It reported `Using secrets defined in dist\hico_preview\.dev.vars` and resolved these non-secret local values:

```text
name=hico-preview
PREVIEW_GATE=off
RP_ID=localhost
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:4173
```

The two previously failing cases were then run alone: **2 passed**, exit 0. The complete command
`.\scripts\launch-check.ps1 -PreviewHost hico-preview.these3remain.workers.dev` subsequently exited 0, with **43 browser tests passed** and all ten validation steps marked `pass`.

Final raw green evidence: `docs\spikes\2026-11-03-preview-launch-check-local-webauthn-rebuild-green.txt`.
