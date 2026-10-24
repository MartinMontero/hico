import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SignJWT, exportJWK, generateKeyPair, type JSONWebKeySet } from 'jose';
import { resolveStaff, verifyAccessRequest, type AccessConfig } from './standin.ts';

// Local stand-in: a made-up team domain and a key pair generated here. Nothing is contacted.
const TEAM = 'https://spike-team.cloudflareaccess.com';
const AUD = 'a'.repeat(64);

async function keyPair(kid: string) {
  const { publicKey, privateKey } = await generateKeyPair('RS256', { extractable: true });
  const jwk = { ...(await exportJWK(publicKey)), kid, alg: 'RS256', use: 'sig' };
  return { privateKey, jwk };
}
async function token(privateKey: CryptoKey, kid: string, claims: Record<string, unknown> = {}, opts: { iss?: string; aud?: string; exp?: string | number } = {}) {
  return new SignJWT({ email: 'Staff@Example.org', ...claims })
    .setProtectedHeader({ alg: 'RS256', kid })
    .setIssuer(opts.iss ?? TEAM)
    .setAudience(opts.aud ?? AUD)
    .setIssuedAt()
    .setExpirationTime(opts.exp ?? '10m')
    .sign(privateKey);
}
const req = (jwt?: string) => new Request('https://hico.test/staff/p/a/me', { headers: jwt ? { 'Cf-Access-Jwt-Assertion': jwt } : {} });

test('Access Worker half: what is accepted and what is refused', async () => {
  const current = await keyPair('key-current');
  const other = await keyPair('key-other');
  const keys: JSONWebKeySet = { keys: [current.jwk] };
  const config: AccessConfig = { teamDomain: TEAM, aud: AUD, getKeys: async () => keys };

  // valid: the email claim is lower-cased
  assert.deepEqual(await verifyAccessRequest(req(await token(current.privateKey, 'key-current')), config), { ok: true, email: 'staff@example.org' });

  const refused = async (jwt: string | undefined, reason: string) => assert.deepEqual(await verifyAccessRequest(req(jwt), config), { ok: false, reason }, reason);
  await refused(undefined, 'missing_header');
  await refused(await token(current.privateKey, 'key-current', {}, { exp: Math.floor(Date.now() / 1000) - 60 }), 'expired');
  await refused(await token(current.privateKey, 'key-current', {}, { aud: 'b'.repeat(64) }), 'claim_aud');
  await refused(await token(current.privateKey, 'key-current', {}, { iss: 'https://someone-else.cloudflareaccess.com' }), 'claim_iss');
  await refused(await token(other.privateKey, 'key-current'), 'bad_signature'); // signed by a different key, claims to be ours
  await refused(await token(other.privateKey, 'key-other'), 'unknown_key'); // a kid we do not publish
  await refused('not.a.jwt', 'invalid');
  await refused(await new SignJWT({ email: 'staff@example.org' }).setProtectedHeader({ alg: 'HS256', kid: 'key-current' }).setIssuer(TEAM).setAudience(AUD).setExpirationTime('10m').sign(new TextEncoder().encode('x'.repeat(32))), 'invalid'); // algorithm confusion
  // an unsigned token (alg "none"), built by hand with valid claims
  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
  await refused(`${b64({ alg: 'none', kid: 'key-current' })}.${b64({ email: 'staff@example.org', iss: TEAM, aud: AUD, exp: Math.floor(Date.now() / 1000) + 600 })}.`, 'invalid');
  await refused(await token(current.privateKey, 'key-current', { email: undefined }), 'no_email_claim');

  // key rotation: the previous key stays valid beside the new one (Access keeps the old one for 7 days)
  const rotated: JSONWebKeySet = { keys: [other.jwk, current.jwk] };
  const afterRotation: AccessConfig = { ...config, getKeys: async () => rotated };
  assert.equal((await verifyAccessRequest(req(await token(current.privateKey, 'key-current')), afterRotation)).ok, true);
  assert.equal((await verifyAccessRequest(req(await token(other.privateKey, 'key-other')), afterRotation)).ok, true);
  // ...and once the old key is gone, tokens signed with it stop working
  const retired: JSONWebKeySet = { keys: [other.jwk] };
  assert.equal((await verifyAccessRequest(req(await token(current.privateKey, 'key-current')), { ...config, getKeys: async () => retired })).ok, false);
});

test('Access vouches for an email; the Worker still maps it to staff and reads the role itself', async () => {
  const current = await keyPair('key-current');
  const config: AccessConfig = { teamDomain: TEAM, aud: AUD, getKeys: async () => ({ keys: [current.jwk] }) };
  const staff = new Map([['staff@example.org', { staffUserId: 'u1' }]]);
  const find = async (email: string) => staff.get(email) ?? null;
  const good = await token(current.privateKey, 'key-current');
  assert.deepEqual(await resolveStaff(req(good), config, find), { staffUserId: 'u1', email: 'staff@example.org' });
  // A valid Access login for an address that is not staff gets nothing.
  assert.equal(await resolveStaff(req(await token(current.privateKey, 'key-current', { email: 'stranger@example.org' })), config, find), null);
  // Removing the staff row cuts access at once, without touching Access.
  staff.delete('staff@example.org');
  assert.equal(await resolveStaff(req(good), config, find), null);
});
