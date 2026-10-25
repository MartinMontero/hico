// Which French strings a reviewer has approved (D-19).
//
// NONE. French needs a native Québécois review before any Quebec-facing deployment, and nobody has been named to do it
// (D-19). Claude Code drafted every French string, so every one is on the needs-review list. A key goes into one of these
// sets only when a named person has reviewed it; tests/node/french-review.test.ts fails if a set is not empty without a
// reviewer recorded in docs\03-DECISIONS.md.
import { ALL_KEYS, type MessageKey } from './index.ts';
import { staffEn, type StaffKey } from './staff-en.ts';

export const FR_REVIEWED: ReadonlySet<MessageKey> = new Set<MessageKey>();
export const STAFF_FR_REVIEWED: ReadonlySet<StaffKey> = new Set<StaffKey>();

export const frNeedsReview = (): MessageKey[] => ALL_KEYS.filter((k) => !FR_REVIEWED.has(k));
export const staffFrNeedsReview = (): StaffKey[] => (Object.keys(staffEn) as StaffKey[]).filter((k) => !STAFF_FR_REVIEWED.has(k));