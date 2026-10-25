// How long rows stay before the purge job (worker/purge.ts) deletes them, in days, for the row types that exist today.
//
// ASSUMED, NOT SET BY MARTIN (D-35 point 2; listed in O-23). Where 06 §2 gives a period it is marked [A], a proposal for
// HI Canada's privacy officer; the rest are Claude Code's choices for rows that carry no guest data. Nothing a guest sees
// depends on these in Stage 0. This is the only place they are written.
export const RETENTION_DAYS = {
  /** 06 §2 audit log, "One year" [A] */
  auditLog: 365,
  /** 06 §2 entry code, "Until revoked, then 30 days" [A]; Stage 0 labels are retired, not revoked sessions */
  retiredQrLabels: 30,
  /** 06 §2 staff accounts, "While active, plus 30 days" [A]; applied to a revoked passkey's key */
  revokedPasskeys: 30,
  /** a staff session that has expired or been ended: assumed */
  endedStaffSessions: 7,
  /** an invite or recovery link that has expired or been used: assumed */
  endedStaffLinks: 7,
  /** a sign-in challenge that has expired or been used: assumed */
  endedChallenges: 1,
  /** 06 §2 rate-limit counters, "24 hours" [A] */
  rateLimitCounters: 1,
} as const;

export type RetentionKind = keyof typeof RETENTION_DAYS;

export const retentionSeconds = (kind: RetentionKind): number => RETENTION_DAYS[kind] * 24 * 60 * 60;