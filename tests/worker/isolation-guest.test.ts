import { env } from 'cloudflare:workers';
import { beforeAll, describe, expect, it } from 'vitest';
import { makeProperty, type PropertyFixture } from '../support/fixtures.ts';
import { createTenantContext, type TenantContext } from '../../worker/tenant.ts';
import { codes } from '../../worker/repositories/index.ts';
import { purgeExpired } from '../../worker/repositories/purge.ts';

// Isolation suite, part 4: the guest-side QR label check and the retention purge.
// tests/node/meta.test.ts reads every isolation*.test.ts file for covers() calls.
function covers(...names: string[]): void {
  expect(names.length).toBeGreaterThan(0);
}

const ctxFor = (p: PropertyFixture) => createTenantContext(env.DB, { propertyId: p.id, slug: p.slug, timezone: 'America/Vancouver' });
let A: PropertyFixture, B: PropertyFixture;
let ctxA: TenantContext, ctxB: TenantContext;

beforeAll(async () => {
  A = await makeProperty(env.DB, 'isg-a');
  B = await makeProperty(env.DB, 'isg-b');
  [ctxA, ctxB] = [ctxFor(A), ctxFor(B)];
  await codes.insert(ctxA, 'desk', 1);
  await codes.insert(ctxB, 'rooftop', 1);
});

describe('codes.isActiveLabel', () => {
  it('knows only this property\'s own labels, never another\'s', async () => {
    covers('codes.isActiveLabel');
    expect(await codes.isActiveLabel(ctxA, 'desk')).toBe(true);
    expect(await codes.isActiveLabel(ctxA, 'rooftop')).toBe(false); // B's label, asked as A
    expect(await codes.isActiveLabel(ctxB, 'desk')).toBe(false); // A's label, asked as B
    expect(await codes.isActiveLabel(ctxB, 'rooftop')).toBe(true);
  });

  it('a retired label is no longer active', async () => {
    const id = (await env.DB.prepare('SELECT id FROM entry_codes WHERE property_id = ?1 AND label = ?2').bind(A.id, 'desk').first<{ id: string }>())?.id as string;
    expect(await codes.retire(ctxA, id, 2)).toBe(true);
    expect(await codes.isActiveLabel(ctxA, 'desk')).toBe(false);
  });
});

describe('purge.purgeExpired', () => {
  it('deletes by age across every property and leaves each property\'s live rows alone', async () => {
    covers('purge.purgeExpired');
    const NOW = Date.parse('2026-10-25T03:17:00Z') / 1000;
    const label = (p: PropertyFixture, name: string, revoked: number | null) =>
      env.DB.prepare("INSERT INTO entry_codes (id, property_id, label, token_hash, created_at, revoked_at) VALUES (?1, ?2, ?3, '', 1, ?4)").bind(crypto.randomUUID().replaceAll('-', ''), p.id, name, revoked).run();
    await label(A, 'a-live', null);
    await label(B, 'b-live', null);
    await label(A, 'a-old', 5); // retired long ago
    await label(B, 'b-old', 5);
    await purgeExpired(env.DB, NOW);
    const left = (await env.DB.prepare("SELECT property_id, label FROM entry_codes WHERE label IN ('a-live','b-live','a-old','b-old') ORDER BY label").all<{ property_id: string; label: string }>()).results;
    expect(left).toEqual([{ property_id: A.id, label: 'a-live' }, { property_id: B.id, label: 'b-live' }]);
  });
});