import { env } from 'cloudflare:workers';
import { beforeAll, describe, expect, it } from 'vitest';
import { makeProperty, makeStaff, type PropertyFixture } from '../support/fixtures.ts';
import { newId } from '../../worker/ids.ts';
import { createTenantContext, type TenantContext } from '../../worker/tenant.ts';
import { audit, challenges, credentials, people, ratelimit, sessions, tokens } from '../../worker/repositories/index.ts';

// Isolation suite, part 2: staff people, sessions, passkeys, links, challenges, rate limits and the audit list.
// tests/node/meta.test.ts reads every isolation*.test.ts file for covers() calls.
function covers(...names: string[]): void {
  expect(names.length).toBeGreaterThan(0);
}

const NOW = 1_800_000_000;
const ctxFor = (p: PropertyFixture) => createTenantContext(env.DB, { propertyId: p.id, slug: p.slug, timezone: 'America/Vancouver' });
const hash = (c: string) => c.repeat(64).slice(0, 64);

let A: PropertyFixture, B: PropertyFixture, C: PropertyFixture;
let ctxA: TenantContext, ctxB: TenantContext, ctxC: TenantContext;
let adminA: string, editorA: string, adminB: string, adminAB: string, loner: string, soloC: string;

beforeAll(async () => {
  A = await makeProperty(env.DB, 'ist-a');
  B = await makeProperty(env.DB, 'ist-b');
  C = await makeProperty(env.DB, 'ist-c');
  [ctxA, ctxB, ctxC] = [ctxFor(A), ctxFor(B), ctxFor(C)];
  adminA = await makeStaff(env.DB, 'admin-a@ist.test', [{ propertyId: A.id, role: 'admin' }]);
  editorA = await makeStaff(env.DB, 'editor-a@ist.test', [{ propertyId: A.id, role: 'editor' }]);
  adminB = await makeStaff(env.DB, 'admin-b@ist.test', [{ propertyId: B.id, role: 'admin' }]);
  adminAB = await makeStaff(env.DB, 'admin-ab@ist.test', [{ propertyId: A.id, role: 'admin' }, { propertyId: B.id, role: 'admin' }]);
  loner = await makeStaff(env.DB, 'loner@ist.test', []);
  soloC = await makeStaff(env.DB, 'solo-c@ist.test', [{ propertyId: C.id, role: 'admin' }]);
});

describe('people (property-scoped)', () => {
  it('listForProperty returns only that property\'s people', async () => {
    covers('people.listForProperty');
    const a = (await people.listForProperty(ctxA)).map((p) => p.id).sort();
    expect(a).toEqual([adminA, editorA, adminAB].sort());
    expect((await people.listForProperty(ctxB)).map((p) => p.id).sort()).toEqual([adminB, adminAB].sort());
    expect(a).not.toContain(adminB);
  });

  it('roleOf answers only for a person who holds a role at that property', async () => {
    covers('people.roleOf');
    expect(await people.roleOf(ctxA, adminA)).toBe('admin');
    expect(await people.roleOf(ctxA, editorA)).toBe('editor');
    expect(await people.roleOf(ctxA, adminB)).toBeNull();
    expect(await people.roleOf(ctxB, editorA)).toBeNull();
  });

  it('setRole: B cannot change A\'s person; the last admin cannot be demoted', async () => {
    covers('people.setRole');
    expect(await people.setRole(ctxB, editorA, 'admin')).toBe('missing');
    expect(await people.roleOf(ctxA, editorA)).toBe('editor');
    expect(await people.setRole(ctxC, soloC, 'editor')).toBe('last_admin');
    expect(await people.roleOf(ctxC, soloC)).toBe('admin');
    // With a second admin the demotion is allowed, and a promotion always is.
    const second = await makeStaff(env.DB, 'second-c@ist.test', [{ propertyId: C.id, role: 'editor' }]);
    expect(await people.setRole(ctxC, second, 'admin')).toBe('ok');
    expect(await people.setRole(ctxC, soloC, 'editor')).toBe('ok');
    expect(await people.setRole(ctxC, soloC, 'admin')).toBe('ok');
  });

  it('removeMember: B cannot remove A\'s person; the last admin cannot be removed', async () => {
    covers('people.removeMember');
    expect(await people.removeMember(ctxB, editorA)).toBe('missing');
    expect(await people.roleOf(ctxA, editorA)).toBe('editor');
    const only = await makeProperty(env.DB, 'ist-only');
    const solo = await makeStaff(env.DB, 'only@ist.test', [{ propertyId: only.id, role: 'admin' }]);
    expect(await people.removeMember(ctxFor(only), solo)).toBe('last_admin');
    const extra = await makeStaff(env.DB, 'extra@ist.test', [{ propertyId: only.id, role: 'editor' }]);
    expect(await people.removeMember(ctxFor(only), extra)).toBe('ok');
    expect(await people.roleOf(ctxFor(only), extra)).toBeNull();
  });
});

describe('people (person-level lookups)', () => {
  it('findUserByEmail, findUserById, createUser, setDisplayName', async () => {
    covers('people.findUserByEmail', 'people.findUserById', 'people.createUser', 'people.setDisplayName');
    const id = newId();
    await people.createUser(env.DB, { id, email: 'new@ist.test', displayName: 'New Person' }, NOW);
    expect(await people.findUserByEmail(env.DB, 'new@ist.test')).toMatchObject({ id, displayName: 'New Person', disabled: false });
    await people.setDisplayName(env.DB, id, 'Renamed');
    expect((await people.findUserById(env.DB, id))?.displayName).toBe('Renamed');
    expect(await people.findUserByEmail(env.DB, 'nobody@ist.test')).toBeNull();
    await env.DB.prepare('UPDATE staff_users SET disabled_at = 5 WHERE id = ?1').bind(id).run();
    expect((await people.findUserById(env.DB, id))?.disabled).toBe(true);
  });

  it('membershipsOf lists only that person\'s own properties; addMembership never overwrites', async () => {
    covers('people.membershipsOf', 'people.addMembership');
    expect((await people.membershipsOf(env.DB, adminAB)).map((m) => m.slug)).toEqual(['ist-a', 'ist-b']);
    expect((await people.membershipsOf(env.DB, adminA)).map((m) => m.slug)).toEqual(['ist-a']);
    expect(await people.membershipsOf(env.DB, loner)).toEqual([]);
    expect(await people.addMembership(env.DB, loner, C.id, 'editor')).toBe(true);
    expect(await people.addMembership(env.DB, loner, C.id, 'admin')).toBe(false); // existing role is kept
    expect(await people.roleOf(ctxC, loner)).toBe('editor');
    await env.DB.prepare('DELETE FROM staff_memberships WHERE staff_user_id = ?1').bind(loner).run();
  });

  it('canIssueRecovery needs an admin role at EVERY property the person belongs to', async () => {
    covers('people.canIssueRecovery');
    expect(await people.canIssueRecovery(env.DB, adminA, editorA)).toBe(true); // only A, issuer admins A
    expect(await people.canIssueRecovery(env.DB, adminA, adminAB)).toBe(false); // adminAB is also in B
    expect(await people.canIssueRecovery(env.DB, adminB, adminAB)).toBe(false); // and not covered by B alone
    expect(await people.canIssueRecovery(env.DB, adminAB, adminA)).toBe(true);
    expect(await people.canIssueRecovery(env.DB, adminAB, adminB)).toBe(true);
    expect(await people.canIssueRecovery(env.DB, adminB, editorA)).toBe(false); // nothing in common
    expect(await people.canIssueRecovery(env.DB, adminA, loner)).toBe(false); // no memberships: operator only
    expect(await people.canIssueRecovery(env.DB, editorA, adminA)).toBe(false); // an editor is not an admin
  });
});

describe('audit', () => {
  it('appendForPerson writes one row per property the person holds a role in, none for a person with no role', async () => {
    covers('audit.appendForPerson');
    const n = await audit.appendForPerson(env.DB, adminAB, { action: 'staff.test.person', targetType: 'staff', targetId: adminAB }, NOW);
    expect(n).toBe(2);
    const rows = await env.DB.prepare("SELECT property_id FROM audit_log WHERE action = 'staff.test.person'").all<{ property_id: string }>();
    expect(rows.results.map((r) => r.property_id).sort()).toEqual([A.id, B.id].sort());
    expect(await audit.appendForPerson(env.DB, loner, { action: 'staff.test.none', targetType: 'staff', targetId: loner }, NOW)).toBe(0);
    expect((await env.DB.prepare("SELECT COUNT(*) AS n FROM audit_log WHERE action = 'staff.test.none'").first<{ n: number }>())?.n).toBe(0);
    // Not under a property the person has no role in.
    expect((await env.DB.prepare("SELECT COUNT(*) AS n FROM audit_log WHERE action = 'staff.test.person' AND property_id = ?1").bind(C.id).first<{ n: number }>())?.n).toBe(0);
  });

  it('list is one property, newest first, filterable and paged', async () => {
    covers('audit.list');
    for (let i = 0; i < 5; i += 1) {
      await audit.append(ctxA, { actorKind: 'staff', actorStaffId: adminA, action: i % 2 ? 'staff.test.odd' : 'staff.test.even', targetType: 'x', targetId: null }, NOW + 100 + i);
    }
    await audit.append(ctxB, { actorKind: 'staff', actorStaffId: adminB, action: 'staff.test.even', targetType: 'x', targetId: null }, NOW + 500);
    const all = await audit.list(ctxA, { limit: 50 });
    expect(all.every((r) => r.id.length === 32)).toBe(true);
    const times = all.map((r) => r.createdAt);
    expect(times).toEqual(times.toSorted((x, y) => y - x));
    expect(all.some((r) => r.createdAt === NOW + 500)).toBe(false); // B's row is not in A's list
    expect((await audit.list(ctxA, { limit: 50, action: 'staff.test.odd' })).length).toBe(2);
    const page1 = await audit.list(ctxA, { limit: 2 });
    const page2 = await audit.list(ctxA, { limit: 2, before: page1.at(-1)?.createdAt });
    expect(page1.length).toBe(2);
    expect(page2.every((r) => r.createdAt < (page1.at(-1)?.createdAt ?? 0))).toBe(true);
    expect(all.find((r) => r.actorName)?.actorName).toBeTruthy();
  });
});

describe('sessions', () => {
  it('create, findActive: live only; a disabled person, an expired or a revoked session finds nothing', async () => {
    covers('sessions.create', 'sessions.findActive', 'sessions.revokeOne');
    await sessions.create(env.DB, hash('a'), adminA, NOW, 100);
    expect((await sessions.findActive(env.DB, hash('a'), NOW + 50))?.staffUserId).toBe(adminA);
    expect(await sessions.findActive(env.DB, hash('a'), NOW + 100)).toBeNull(); // expired
    expect(await sessions.findActive(env.DB, hash('z'), NOW)).toBeNull(); // unknown
    await sessions.create(env.DB, hash('b'), editorA, NOW, 100);
    await sessions.revokeOne(env.DB, hash('b'), NOW + 1);
    expect(await sessions.findActive(env.DB, hash('b'), NOW + 2)).toBeNull();
    const gone = await makeStaff(env.DB, 'gone@ist.test', []);
    await sessions.create(env.DB, hash('c'), gone, NOW, 100);
    await env.DB.prepare('UPDATE staff_users SET disabled_at = 1 WHERE id = ?1').bind(gone).run();
    expect(await sessions.findActive(env.DB, hash('c'), NOW + 2)).toBeNull();
  });

  it('listFor, revokeByHandle, revokeAllFor never touch another person\'s sessions', async () => {
    covers('sessions.listFor', 'sessions.revokeByHandle', 'sessions.revokeAllFor');
    await sessions.create(env.DB, hash('d'), adminB, NOW, 1000);
    await sessions.create(env.DB, hash('e'), adminB, NOW + 1, 1000);
    await sessions.create(env.DB, hash('f'), adminAB, NOW, 1000);
    const mine = await sessions.listFor(env.DB, adminB, hash('d'), NOW + 5);
    expect(mine.map((s) => s.current)).toEqual([true, false]);
    // adminAB tries adminB's handle: nothing happens.
    expect(await sessions.revokeByHandle(env.DB, adminAB, hash('d').slice(0, 12), NOW + 6)).toBe(0);
    expect(await sessions.findActive(env.DB, hash('d'), NOW + 7)).not.toBeNull();
    expect(await sessions.revokeByHandle(env.DB, adminB, hash('e').slice(0, 12), NOW + 6)).toBe(1);
    expect(await sessions.revokeAllFor(env.DB, adminB, NOW + 8)).toBe(1);
    expect(await sessions.findActive(env.DB, hash('f'), NOW + 9)).not.toBeNull(); // adminAB untouched
  });
});

describe('credentials (passkeys)', () => {
  const key = new Uint8Array([1, 2, 3, 4]);
  it('insert, findActive, listFor, countActive, recordUse', async () => {
    covers('credentials.insert', 'credentials.findActive', 'credentials.listFor', 'credentials.countActive', 'credentials.recordUse');
    await credentials.insert(env.DB, { id: 'cred-a1', staffUserId: adminA, publicKey: key, counter: 0, transports: 'internal', label: 'Phone' }, NOW);
    expect(await credentials.findActive(env.DB, 'cred-a1')).toMatchObject({ staffUserId: adminA, counter: 0 });
    expect(Array.from((await credentials.findActive(env.DB, 'cred-a1'))?.publicKey ?? [])).toEqual([1, 2, 3, 4]);
    await credentials.recordUse(env.DB, 'cred-a1', 7, NOW + 1);
    expect((await credentials.findActive(env.DB, 'cred-a1'))?.counter).toBe(7);
    expect((await credentials.listFor(env.DB, adminA)).map((c) => c.label)).toEqual(['Phone']);
    expect(await credentials.listFor(env.DB, adminB)).toEqual([]);
    expect(await credentials.countActive(env.DB, adminA)).toBe(1);
    expect(await credentials.findActive(env.DB, 'no-such')).toBeNull();
  });

  it('revoke: the last passkey stays; another person\'s passkey cannot be revoked or renamed', async () => {
    covers('credentials.revoke', 'credentials.rename', 'credentials.revokeAllFor');
    await credentials.insert(env.DB, { id: 'cred-a2', staffUserId: adminA, publicKey: key, counter: 0, transports: '', label: 'Key' }, NOW);
    await credentials.insert(env.DB, { id: 'cred-b1', staffUserId: adminB, publicKey: key, counter: 0, transports: '', label: 'B phone' }, NOW);
    expect(await credentials.revoke(env.DB, adminB, 'cred-b1', NOW)).toBe('last');
    expect(await credentials.revoke(env.DB, adminA, 'cred-b1', NOW)).toBe('missing'); // adminA has two, but this is not hers
    expect(await credentials.findActive(env.DB, 'cred-b1')).not.toBeNull();
    expect(await credentials.rename(env.DB, adminA, 'cred-b1', 'Hijacked')).toBe(false);
    expect((await credentials.listFor(env.DB, adminB))[0]?.label).toBe('B phone');
    expect(await credentials.rename(env.DB, adminA, 'cred-a2', 'Security key')).toBe(true);
    expect(await credentials.revoke(env.DB, adminA, 'cred-a2', NOW)).toBe('revoked');
    expect(await credentials.findActive(env.DB, 'cred-a2')).toBeNull();
    expect(await credentials.revokeAllFor(env.DB, adminA, NOW + 1)).toBe(1);
    expect(await credentials.countActive(env.DB, adminA)).toBe(0);
    expect(await credentials.countActive(env.DB, adminB)).toBe(1);
  });

  it('a disabled person\'s passkey cannot sign in', async () => {
    covers('credentials.findActive');
    const p = await makeStaff(env.DB, 'dis@ist.test', []);
    await credentials.insert(env.DB, { id: 'cred-dis', staffUserId: p, publicKey: key, counter: 0, transports: '', label: '' }, NOW);
    await env.DB.prepare('UPDATE staff_users SET disabled_at = 1 WHERE id = ?1').bind(p).run();
    expect(await credentials.findActive(env.DB, 'cred-dis')).toBeNull();
  });
});

describe('links and challenges', () => {
  it('invite and recovery links: inspect without using, use once, expire', async () => {
    covers('tokens.createInvite', 'tokens.createRecovery', 'tokens.inspect', 'tokens.consume');
    await tokens.createInvite(env.DB, { hash: hash('1'), email: 'i@ist.test', displayName: 'Ivy', propertyId: A.id, role: 'editor', createdBy: adminA }, NOW, 100);
    expect(await tokens.inspect(env.DB, hash('1'), NOW + 1)).toMatchObject({ purpose: 'invite', displayName: 'Ivy', propertyId: A.id, role: 'editor' });
    expect(await tokens.inspect(env.DB, hash('1'), NOW + 1)).not.toBeNull(); // inspecting does not use it
    expect(await tokens.consume(env.DB, hash('1'), NOW + 2)).not.toBeNull();
    expect(await tokens.consume(env.DB, hash('1'), NOW + 3)).toBeNull(); // single use
    expect(await tokens.inspect(env.DB, hash('1'), NOW + 3)).toBeNull();
    await tokens.createRecovery(env.DB, { hash: hash('2'), email: 'admin-a@ist.test', displayName: 'A', staffUserId: adminA, createdBy: adminAB }, NOW, 100);
    expect(await tokens.consume(env.DB, hash('2'), NOW + 100)).toBeNull(); // expired
    expect(await tokens.inspect(env.DB, hash('nope'), NOW)).toBeNull();
  });

  it('challenges are single use, expire, and cannot be spent on the other kind of ceremony', async () => {
    covers('challenges.create', 'challenges.consume');
    const id = newId();
    await challenges.create(env.DB, { id, challenge: 'abc', purpose: 'login', staffUserId: null, tokenHash: null }, NOW, 60);
    expect(await challenges.consume(env.DB, id, 'register', NOW + 1)).toBeNull(); // wrong purpose
    expect(await challenges.consume(env.DB, id, 'login', NOW + 1)).toMatchObject({ challenge: 'abc' });
    expect(await challenges.consume(env.DB, id, 'login', NOW + 2)).toBeNull(); // used
    const old = newId();
    await challenges.create(env.DB, { id: old, challenge: 'def', purpose: 'register', staffUserId: adminA, tokenHash: hash('3') }, NOW, 60);
    expect(await challenges.consume(env.DB, old, 'register', NOW + 60)).toBeNull(); // expired
  });
});

describe('rate limits', () => {
  it('counts per key and window, answers false past the limit, and forgets after a day', async () => {
    covers('ratelimit.hit');
    const k = hash('9');
    expect(await ratelimit.hit(env.DB, k, 2, 900, NOW)).toBe(true);
    expect(await ratelimit.hit(env.DB, k, 2, 900, NOW + 1)).toBe(true);
    expect(await ratelimit.hit(env.DB, k, 2, 900, NOW + 2)).toBe(false); // third hit in the window
    expect(await ratelimit.hit(env.DB, hash('8'), 2, 900, NOW + 2)).toBe(true); // another key is unaffected
    expect(await ratelimit.hit(env.DB, k, 2, 900, NOW + 901)).toBe(true); // a new window
    await ratelimit.hit(env.DB, hash('7'), 2, 900, NOW + 2 * 24 * 3600);
    const old = await env.DB.prepare('SELECT COUNT(*) AS n FROM rate_limits WHERE window_start < ?1').bind(NOW).first<{ n: number }>();
    expect(old?.n).toBe(0); // rows older than a day were removed on write
  });
});
