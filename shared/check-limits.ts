// How old a staff "checked" stamp may be before the item says "Check at the desk" (guests) or "Check overdue" (staff).
//
// ASSUMED, DEMO VALUES (D-33, 2026-10-24). Martin said events change monthly, that about half are active for about six
// months, "as long as it works for the hostel and the guest", and for places and offers "the 90 is fine for the demo.
// I will get a more official number later." The board's 90 is Claude Code's reading of those words, not a figure Martin
// gave. The earlier 7 days for the board was an assumption and is withdrawn. Official figures are owed (O-23).
//
// This is the only place these numbers are written. Everything else imports from here.
export const CHECK_LIMIT_DAYS = {
  board: 90,
  places: 90,
  offers: 90,
} as const;

export type CheckKind = keyof typeof CHECK_LIMIT_DAYS;

export const DAY_SECONDS = 24 * 60 * 60;

export const checkLimitSeconds = (kind: CheckKind): number => CHECK_LIMIT_DAYS[kind] * DAY_SECONDS;

/** True when there is no stamp, or the stamp is older than the limit for this kind of item. Times are epoch seconds. */
export function pastCheckLimit(verifiedOn: number | null, now: number, kind: CheckKind): boolean {
  return verifiedOn === null || now - verifiedOn > checkLimitSeconds(kind);
}
