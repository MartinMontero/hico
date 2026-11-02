# Architecture deepening candidates — Kimi MVP preview

Reviewed: 2026-11-02. This document records candidates only. No candidate has been selected, no interface has been designed, and no refactor issue has been created.

## 1. Account-access lifecycle

- **Cluster:** `worker/routes/staff-auth.ts`, `worker/repositories/people.ts`, `credentials.ts`, `sessions.ts`, `tokens.ts`, and `audit.ts`.
- **Why coupled:** invite acceptance, recovery, role changes, member removal, passkey revocation, session revocation, and person-level audit all change parts of one account-access state. The route currently coordinates several shallow repository calls.
- **Dependency category:** local-substitutable. The existing workerd/D1 test environment can exercise the real transaction boundary.
- **Test impact:** replace route/repository tests that separately mock individual writes with boundary tests for complete outcomes: invite accepted, recovery completed, last administrator preserved, last passkey preserved, all sessions revoked, and no partial state after a failed write.
- **Reason to explore:** this directly addresses the concurrency and atomicity findings in the security review.

## 2. Content normalization and mutation

- **Cluster:** `worker/routes/staff-content.ts`, `worker/routes/staff-import.ts`, `worker/repositories/activities.ts`, `offers.ts`, `places.ts`, `imports.ts`, and shared conversion/validation code.
- **Why coupled:** staff editing and JSON import both validate, normalize, convert shared activities/offers, check duplicates, write tenant-scoped content, and audit changes. Similar conversion logic in separate paths can drift.
- **Dependency category:** in-process for normalization/conversion; local-substitutable for D1 persistence and atomic audit writes.
- **Test impact:** test observable create/import/update behavior at one content boundary, including shared ownership, `activity_offered_at`, duplicate rejection, imported verification stamps, and audit completeness. Remove redundant shallow conversion tests only after equivalent boundary coverage exists.
- **Reason to explore:** one deeper content module would reduce the chance that imported and manually edited records obey different rules.

## 3. Staff console feature composition

- **Cluster:** `web/src/staff/StaffApp.tsx` (427 lines), `Content.tsx` (708), `Admin.tsx` (651), `ContentHealth.tsx`, `Import.tsx`, and shared API/resource helpers.
- **Why coupled:** navigation, property/role state, resource loading, mutations, toasts, and translations cross several large components. Understanding one staff workflow often requires moving between the shell, a feature screen, and shared request helpers.
- **Dependency category:** remote but owned for the staff API — use the existing typed API as the port and an in-memory fake for UI boundary tests; pure view-state extraction is in-process.
- **Test impact:** test complete staff workflows through feature boundaries rather than separately retesting loading/error/action wiring in every screen. Preserve the existing browser accessibility tests.
- **Reason to explore:** smaller feature boundaries would make future staff changes easier to review without changing product behavior.

## Selection required

Martin or the local maintainer should choose one candidate before interface design. The recommended first candidate is **Account-access lifecycle**, because it addresses verified integrity risks rather than only code size. Any resulting refactor should remain separate from the current preview/offline fix and must not be presented as already implemented.
