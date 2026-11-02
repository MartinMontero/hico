# OWASP security review — Kimi MVP preview

Reviewed: 2026-11-02 against `cloud/kimi-mvp-preview`, including the preview/offline fix. This is a same-model source review, **not** an independent human security review or penetration test.

Evidence labels: **[V]** verified code/test output; **[R]** reasoning; **[I]** inference; **[A]** assumption; **[U]** unverified.

Scope: Worker middleware and routes, tenant and role resolution, passkeys/sessions/tokens, imports and audit, public writes, D1 repositories, service-worker caching, browser rendering, dependencies, and deployment guards.

## Risk summary

- **RED / High:** 0 found in the reviewed source.
- **YELLOW / Medium:** 4 open findings — last-admin/last-passkey races, development dependency advisories, non-atomic account recovery, and non-atomic content/audit writes.
- **Resolved during review:** preview gate responses made guest offline caching impossible; fixed and regression-tested.
- **GREEN / Low:** no separate low finding.
- **[U] Production approval:** independent human security review, deployed-origin testing, real-device/passkey testing, and final dependency review remain required.

## A01 — Broken Access Control: PASS in reviewed paths

- [V] Staff API routes resolve the property from the staff URL, load the caller’s role for that property on every request, and reject suspended properties and inactive memberships.
- [V] Role guards require administrator access for people, QR creation, imports, exports, content health, and aggregate counts; editor/administrator access is enforced for content writes.
- [V] Repository queries bind property identifiers. Cross-tenant tests cover public content, staff routes, imports, content health, and audit behavior.
- [V] The preview gate covers pages, assets, and APIs and fails closed without `ACCESS_KEY`.
- [R] No direct IDOR or cross-property read/write path was found in the reviewed routes. The last-admin and last-passkey concurrency issues are recorded under A04.

## A02 — Cryptographic Failures: PASS in reviewed paths

- [V] Invite, recovery, and session tokens use cryptographically random 256-bit values; only SHA-256 hashes are stored. SHA-256 is used for these random tokens, not as a password hash.
- [V] Session cookies are `HttpOnly`, `Secure`, and `SameSite=Lax`; sessions expire after 12 hours without a sliding extension.
- [V] WebAuthn verifies the challenge, relying-party ID, origin, signature counter behavior, and credential ownership. Challenges are single-use.
- [V] No tracked secret file or hardcoded production secret was found by the verifier.
- [U] Secret generation, storage, deployed configuration, and Cloudflare account controls have not been tested here.

## A03 — Injection: PASS in reviewed paths

- [V] D1 queries use bound parameters. Dynamic fragments examined in repositories are fixed source constants or a fixed optional day clause, not request-provided SQL.
- [V] JSON imports are parsed and validated with Valibot before normalization; duplicate checks and inserts are property-scoped.
- [V] Preact escapes rendered text. QR SVG contains generated numeric path data and is URI-encoded into an image source rather than interpolating staff text into SVG markup.
- [V] The reviewed code does not concatenate user input into an operating-system command or render untrusted raw HTML.

## A04 — Insecure Design: OPEN MEDIUM — last-admin and last-passkey races

**Locations:** `worker/repositories/people.ts:48-56` and `:66-73`; `worker/repositories/credentials.ts:68-82`.

[I] These checks and writes are separate awaited operations. Two concurrent requests can both observe another administrator or active passkey, then both demote/remove/revoke, leaving a person without the intended last recovery path. The credential check also runs before confirming that the named credential belongs to that user.

**Required fix:** make the invariant part of the write and check the affected-row count. Apply the same pattern to demotion, member removal, and credential revocation; add concurrent boundary tests.

```ts
const result = await db.prepare(
  `UPDATE staff_credentials AS sc
     SET revoked_at = ?
   WHERE sc.user_id = ? AND sc.credential_id = ? AND sc.revoked_at IS NULL
     AND EXISTS (
       SELECT 1 FROM staff_credentials other
        WHERE other.user_id = sc.user_id AND other.revoked_at IS NULL
          AND other.credential_id <> sc.credential_id
     )`,
).bind(now, userId, credentialId).run();
if (result.meta.changes === 0) throw new ConflictError('last-credential-or-not-found');
```

[R] The equivalent staff-membership statement must include the property and person predicates plus an `EXISTS` check for another active administrator. A successful response is allowed only when exactly one row changed.

## A05 — Security Misconfiguration: RESOLVED MEDIUM — preview gate blocked offline use

**Locations:** `worker/preview-gate/index.ts:68-77`; `web/sw/logic.ts:68-73`; regression tests in `tests/worker/gate.test.ts` and `tests/web/sw.test.ts`.

[V] Previously, every gated response ended as `private, no-store`, while the service worker refused every `private` response. That protected staff data but also prevented the promised guest offline preview.

[V] The implemented fix preserves every upstream `no-store`, including staff APIs and service-worker status, while allowing origin-private guest pages, public reads, and assets to use browser-owned Cache Storage. Hono’s response-header merge is handled by setting final headers after assigning `c.res`.

```ts
const upstreamCache = c.res.headers.get('Cache-Control') ?? '';
c.res = new Response(c.res.body, c.res);
for (const [k, v] of Object.entries(SECURITY_HEADERS)) c.res.headers.set(k, v);
c.res.headers.set('Cache-Control', /\bno-store\b/i.test(upstreamCache) ? 'private, no-store' : 'private, no-cache');
```

[V] The service worker now excludes only `no-store` responses, while retaining all existing staff-path, non-GET, cross-origin, non-public-API, opaque, error, and unsuccessful-response exclusions. Focused regression result: 3 files and 32 tests passed.

## A06 — Vulnerable and Outdated Components: OPEN MEDIUM — development toolchain advisories

[V] npm audit reported 16 vulnerable package entries (13 moderate, 3 high), sourced from 10 advisories in `minimatch`, `undici`, and `zod`. [V] No production dependency path or application import was found. [R] The exposure is therefore development/build/test tooling, but that is not a reason to ignore it.

Full evidence, dependency chains, and constraints are in `docs/spikes/kimi-mvp-preview-dependencies.md`.

Start with the audit-proposed non-major Cloudflare build-plugin update on a separate local branch, then resolve the remaining chains deliberately:

```powershell
Set-Location $HOME\dev\hico
npm install --save-dev @cloudflare/vite-plugin@1.67.0
npm audit --json
npm ls minimatch undici zod wrangler miniflare eslint typescript-eslint
```

Do not use automatic force-fixes or the audit-suggested ESLint/TypeScript-ESLint downgrades. The fix is complete only when the final lockfile and audit are reviewed and the complete validation suite passes.

## A07 — Identification and Authentication Failures: PASS in reviewed paths, subject to A04

- [V] Staff sign-in is passkey-only; there is no password endpoint to brute-force.
- [V] Invite and recovery tokens expire and are consumed; staff sessions are revocable and expire.
- [V] WebAuthn challenge consumption, origin/RP validation, session lookup, staff status, and property status are checked server-side.
- [R] The remaining account-recovery concerns are the concurrency invariant in A04 and transaction boundary in A08, not missing signature verification.

## A08 — Software and Data Integrity Failures: OPEN MEDIUM — account recovery is not one atomic operation

**Location:** `worker/routes/staff-auth.ts:251-301`, especially `:267-292`; invite completion has the same multi-step shape.

[I] Token consumption, session revocation, old-credential revocation, and new-credential insertion occur in separate awaited writes. A failure between them can consume a recovery link or revoke access without completing the replacement credential. This is a partial-failure/availability risk; no direct attacker-controlled code execution path was found.

**Required fix:** move the complete account transition into a repository operation that batches all D1 writes, checks conditional update results, and tests failure/concurrency at that boundary. The credential/session portion should use this form rather than three independent awaits:

```ts
await c.env.DB.batch([
  c.env.DB.prepare(
    'UPDATE staff_sessions SET revoked_at = ? WHERE person_id = ? AND revoked_at IS NULL',
  ).bind(now, person.id),
  c.env.DB.prepare(
    'UPDATE staff_credentials SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL',
  ).bind(now, person.user_id),
  c.env.DB.prepare(
    `INSERT INTO staff_credentials
       (id, user_id, credential_id, public_key, counter, transports, name, created_at, revoked_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
  ).bind(newId(), person.user_id, credentialId, publicKey, 0, transports, credentialName, now),
]);
```

[R] Include token consumption in the same transaction boundary during implementation so a failed batch does not strand the link. Do not deploy this snippet as a claim that the complete route is already fixed.

## A09 — Security Logging and Monitoring Failures: OPEN MEDIUM — content write and audit can diverge

**Locations:** examples include `worker/routes/staff-content.ts:95-98`, `:133-136`, `:214-216`, `:260-262`; append-only implementation is `worker/repositories/audit.ts`. The import path already uses the safer batch pattern.

[V] Request logs contain only request ID, route template, status, and duration; they do not log cookies, queries, tokens, passwords, or free text. [V] Staff audit records are structured and property-scoped.

[I] Several content routes await the content mutation and then await `audit.append` separately. A failure between the two can change guest/staff content without its required audit event. That weakens forensic integrity even though the audit table itself is append-only.

**Required fix:** prepare both statements first and commit them in one D1 batch. This helper is usable with the existing content and audit SQL statements:

```ts
export async function writeWithAudit(
  db: D1Database,
  contentWrite: D1PreparedStatement,
  auditWrite: D1PreparedStatement,
): Promise<void> {
  const results = await db.batch([contentWrite, auditWrite]);
  if (results.some((result) => !result.success)) {
    throw new Error('Atomic content and audit write failed');
  }
}
```

[R] Refactor repositories/routes to expose prepared statements, then use this boundary for create, update, archive, verification, and deletion operations. Add a failure-injection test proving that neither row survives when either statement fails.

## A10 — Server-Side Request Forgery: PASS in reviewed paths

- [V] No reviewed API accepts a user-provided URL and fetches it from the Worker.
- [V] Explore directions are browser links to a fixed maps destination; they are not server-side fetches.
- [V] Static asset requests go through Cloudflare’s asset binding, and preview redemption accepts only the fixed site root/path handling rather than an arbitrary upstream URL.

## Prioritized remediation and release gates

1. **Before production:** obtain an independent human security review of the exact deployment candidate, including D1 transaction behavior and concurrent account operations.
2. **Before broader staff testing:** fix and test the last-admin/last-passkey invariants and account-recovery transaction boundary.
3. **Before relying on audit history:** make every content mutation and its audit event atomic; extend failure-injection coverage.
4. **On a separate dependency branch:** remediate and re-audit the development toolchain without automatic downgrades.
5. **Deployed preview still unverified here:** run the unauthenticated gate checks, real passkey flows, QR readers, mobile/offline behavior, screen readers, and native Québécois French review.

The resolved preview/offline issue does not close any of these open gates.
