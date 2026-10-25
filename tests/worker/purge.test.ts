import { env } from 'cloudflare:workers';
import { beforeAll, describe, expect, it } from 'vitest';
import { RETENTION_DAYS, retentionSeconds } from '../../shared/retention.ts';
import worker from '../../worker/index.ts';
import { purgeExpired } from '../../worker/repositories/purge.ts';
import { makeProperty, makeStaff, type PropertyFixture } from '../support/fixtures.ts';

// The retention purge (06 §2) with a fake clock, for every row type that exists today. Each type gets one row just inside
// its period (kept) and one just outside (deleted). Periods come from shared/retention.ts, so the test follows the file.

const NOW = Date.parse('2026-10-25T03:17:00Z') / 1000;
const DAY = 24 * 3600;
const inside = (kind: keyof typeof RETENTION_DAYS) => NOW - retentionSeconds(kind) + 3600; // an hour short of the period
const outside = (kind: keyof typeof RETENTION_DAYS) => NOW - retentionSeconds(kind) - 3600; // an hour past it
const hex = (n: number) => n.toString(16).padStart(32, '0');
const hash = (n: number) => n.toString(16).padStart(64, '0');
const count = async (table: string) => Number((await env.DB.prepare(`SELECT COUNT(*) AS n FROM ${table}`).first<{ n: number }>())?.n);

let P: PropertyFixture;
let user: string;

beforeAll(async () => {
  P = await makeProperty(env.DB, 'purge-a', { host: 'purge-a.test' });
  user = await makeStaff(env.DB, 'purge@x.test', [{ propertyId: P.id, role: 'admin' }]);
});

const session = (n: number, expires: number, revoked: number | null = null) =>
  env.DB.prepare('INSERT INTO staff_sessions (id, staff_user_id, created_at, expires_at, revoked_at) VALUES (?1, ?2, 1, ?3, ?4)').bind(hash(n), user, expires, revoked).run();
const token = (n: number, expires: number, used: number | null = null) =>
  env.DB.prepare("INSERT INTO staff_tokens (token_hash, purpose, email, display_name, staff_user_id, created_at, expires_at, used_at) VALUES (?1, 'recovery', 'purge@x.test', '', ?2, 1, ?3, ?4)").bind(hash(n), user, expires, used).run();
const challenge = (n: number, expires: number, used: number | null = null) =>
  env.DB.prepare("INSERT INTO webauthn_challenges (id, challenge, purpose, expires_at, used_at) VALUES (?1, 'c', 'login', ?2, ?3)").bind(hex(n), expires, used).run();

describe('the purge deletes by age, per row type, and keeps what is inside its period', () => {
  it('staff sessions: expired or ended early; a live one is never touched', async () => {
    await session(1, outside('endedStaffSessions')); // expired long ago
    await session(2, inside('endedStaffSessions')); // expired recently
    await session(3, NOW + DAY); // live
    await session(4, NOW + DAY, outside('endedStaffSessions')); // ended early, long ago
    await session(5, NOW + DAY, inside('endedStaffSessions')); // ended early, recently
    const r = await purgeExpired(env.DB, NOW);
    expect(r.staffSessions).toBe(2);
    const left = (await env.DB.prepare('SELECT id FROM staff_sessions ORDER BY id').all<{ id: string }>()).results.map((x) => x.id);
    expect(left).toEqual([hash(2), hash(3), hash(5)]);
  });

  it('invite and recovery links: expired or used', async () => {
    await token(1, outside('endedStaffLinks'));
    await token(2, inside('endedStaffLinks'));
    await token(3, NOW + 1800); // still valid
    await token(4, NOW + 1800, outside('endedStaffLinks')); // used long ago
    await token(5, NOW + 1800, inside('endedStaffLinks')); // used recently
    const r = await purgeExpired(env.DB, NOW);
    expect(r.staffTokens).toBe(2);
    expect(await count('staff_tokens')).toBe(3);
  });

  it('sign-in challenges: expired or used', async () => {
    await challenge(1, outside('endedChallenges'));
    await challenge(2, inside('endedChallenges'));
    await challenge(3, NOW + 300);
    await challenge(4, NOW + 300, outside('endedChallenges'));
    const r = await purgeExpired(env.DB, NOW);
    expect(r.challenges).toBe(2);
    expect(await count('webauthn_challenges')).toBe(2);
  });

  it('rate-limit counters older than their period', async () => {
    const ins = (n: number, start: number) => env.DB.prepare('INSERT INTO rate_limits (key, window_start, count) VALUES (?1, ?2, 1)').bind(hash(n), start).run();
    await ins(1, outside('rateLimitCounters'));
    await ins(2, inside('rateLimitCounters'));
    const r = await purgeExpired(env.DB, NOW);
    expect(r.rateLimits).toBe(1);
    expect(await count('rate_limits')).toBe(1);
  });

  it('retired QR labels after their period; active ones are never touched', async () => {
    const ins = (label: string, revoked: number | null) =>
      env.DB.prepare("INSERT INTO entry_codes (id, property_id, label, token_hash, created_at, revoked_at) VALUES (?1, ?2, ?3, '', 1, ?4)").bind(crypto.randomUUID().replaceAll('-', ''), P.id, label, revoked).run();
    await ins('old-retired', outside('retiredQrLabels'));
    await ins('new-retired', inside('retiredQrLabels'));
    await ins('active', null);
    const r = await purgeExpired(env.DB, NOW);
    expect(r.retiredQrLabels).toBe(1);
    const left = (await env.DB.prepare('SELECT label FROM entry_codes WHERE property_id = ?1 ORDER BY label').bind(P.id).all<{ label: string }>()).results.map((x) => x.label);
    expect(left).toEqual(['active', 'new-retired']);
  });

  it('revoked passkeys after their period; a working passkey is never touched', async () => {
    const ins = (id: string, revoked: number | null) =>
      env.DB.prepare("INSERT INTO staff_credentials (id, staff_user_id, public_key, counter, created_at, revoked_at) VALUES (?1, ?2, zeroblob(4), 0, 1, ?3)").bind(id, user, revoked).run();
    await ins('cred-old', outside('revokedPasskeys'));
    await ins('cred-new', inside('revokedPasskeys'));
    await ins('cred-live', null);
    const r = await purgeExpired(env.DB, NOW);
    expect(r.revokedPasskeys).toBe(1);
    expect((await env.DB.prepare("SELECT id FROM staff_credentials WHERE id LIKE 'cred-%' ORDER BY id").all<{ id: string }>()).results.map((x) => x.id)).toEqual(['cred-live', 'cred-new']);
  });

  it('audit rows after a year', async () => {
    const ins = (n: number, at: number) =>
      env.DB.prepare("INSERT INTO audit_log (id, property_id, actor_kind, action, target_type, target_id, created_at) VALUES (?1, ?2, 'system', 'test.purge', 'test', NULL, ?3)").bind(hex(1000 + n), P.id, at).run();
    await ins(1, outside('auditLog'));
    await ins(2, inside('auditLog'));
    const r = await purgeExpired(env.DB, NOW);
    expect(r.auditLog).toBe(1);
    expect(Number((await env.DB.prepare("SELECT COUNT(*) AS n FROM audit_log WHERE action = 'test.purge'").first<{ n: number }>())?.n)).toBe(1);
  });

  it('aggregate counts are kept for ever: they hold no person', async () => {
    await env.DB.prepare("INSERT INTO event_counts (property_id, day, event, count) VALUES (?1, '2020-01-01', 'opened_whats_on', 5)").bind(P.id).run();
    await purgeExpired(env.DB, NOW);
    expect(Number((await env.DB.prepare("SELECT count FROM event_counts WHERE day = '2020-01-01'").first<{ count: number }>())?.count)).toBe(5);
  });

  it('a second run on the same data deletes nothing more', async () => {
    const again = await purgeExpired(env.DB, NOW);
    expect(Object.values(again).every((n) => n === 0)).toBe(true);
  });
});

describe('the scheduled entry point', () => {
  it('runs the purge at the time it was scheduled for and logs only counts', async () => {
    await session(90, outside('endedStaffSessions'));
    const waits: Promise<unknown>[] = [];
    const logs: string[] = [];
    const original = console.log;
    console.log = (...a: unknown[]) => void logs.push(a.map(String).join(' '));
    try {
      worker.scheduled?.({ cron: '17 3 * * *', scheduledTime: NOW * 1000, type: 'scheduled', noRetry() {} } as ScheduledController, env, { waitUntil: (p: Promise<unknown>) => void waits.push(p), passThroughOnException() {} } as unknown as ExecutionContext);
      await Promise.all(waits);
    } finally {
      console.log = original;
    }
    expect(waits).toHaveLength(1);
    const line = logs.find((l) => l.includes('"job":"purge"')) ?? '';
    expect(JSON.parse(line)).toMatchObject({ job: 'purge', staffSessions: 1 });
    expect(line).not.toMatch(/@|purge-a|hc_staff/);
    expect(await count('staff_sessions')).toBeGreaterThanOrEqual(0);
  });
});
