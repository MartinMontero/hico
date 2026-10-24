import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { buildSeedSql, whistlerActivities, whistlerPlaces, vancouverSharedActivities } from '../../seed/data.ts';
import { assertLocalOnly } from '../../seed/guard.ts';

const sql = buildSeedSql(1_800_000_000);
const inserts = (table: string) => sql.split('\n').filter((l) => l.startsWith(`INSERT INTO ${table} `));

describe('seed content', () => {
  it('is built from the prototype: 10 activities and 24 places for Whistler', () => {
    expect(whistlerActivities).toHaveLength(10);
    expect(whistlerPlaces).toHaveLength(24);
  });

  it('marks every activity and place as a placeholder and leaves verification empty', () => {
    for (const table of ['activities', 'places']) {
      for (const line of inserts(table)) {
        expect(line, line.slice(0, 60)).toMatch(/\b1, \d+, \d+\);$/); // is_placeholder = 1, created_at, updated_at
        expect(line).not.toMatch(/verified_on|verified_by/);
      }
    }
    expect(inserts('activities').length).toBe(10 + vancouverSharedActivities.length);
    expect(inserts('places').length).toBe(24);
    expect(inserts('offers')).toHaveLength(0);
  });

  it("spells the Whistler cafe Cheaky's Cafe (D-14), never Cheekye's", () => {
    expect(sql).toContain("Cheaky''s Cafe");
    expect(sql).not.toMatch(/Cheekye/);
  });

  it('has no ratings, no guest names, no dorm names, no HI mark, no unverified claims (02 rows 1, 2, 8, 9, 10)', () => {
    expect(sql).not.toMatch(/rating|stars?\b/i);
    expect(sql).not.toMatch(/Lisa K|Marco P|Yuki S|Anja B|Dev M|Clara M|Kenji|Sof[ií]a R/);
    expect(sql).not.toMatch(/dorm/i);
    expect(sql).not.toMatch(/\bHI\b/);
    expect(sql).not.toMatch(/\$\d|5\.95|938\.9333|\bmembership\b/i);
  });

  it('shares three sample activities between the two Vancouver hostels (D-15, D-25)', () => {
    const offered = inserts('activity_offered_at');
    expect(offered.length).toBe(10 + 2 * vancouverSharedActivities.length);
    const owners = new Set(inserts('properties'));
    expect(owners.size).toBe(3);
  });

  it('seeds the hostels with names that carry no HI (D-25) and local hosts only', () => {
    expect(sql).toContain("'Vancouver Downtown'");
    expect(sql).toContain("'Vancouver Jericho Beach'");
    const hosts = inserts('property_hosts').join('\n');
    expect(hosts).toMatch(/'localhost'/);
    expect(hosts).not.toMatch(/workers\.dev|builderworkshop/);
  });

  it('every French field is present for activities and places', () => {
    for (const a of [...whistlerActivities, ...vancouverSharedActivities]) {
      expect(a.titleFr.length, a.key).toBeGreaterThan(0);
      expect(a.descFr.length, a.key).toBeGreaterThan(0);
    }
    for (const p of whistlerPlaces) expect(p.noteFr.length, p.name).toBeGreaterThan(0);
  });
});

describe('the seed refuses anything but a local database', () => {
  it('accepts only --local', () => {
    expect(() => assertLocalOnly(['--local'], {})).not.toThrow();
    expect(() => assertLocalOnly([], {})).not.toThrow();
  });

  it.each([['--remote'], ['--preview'], ['--env=prod'], ['-e'], ['--persist-to=somewhere'], ['--database-id=abc'], ['--config'], ['whatever']])('refuses %s', (arg) => {
    expect(() => assertLocalOnly([arg], {})).toThrow(/Refusing to seed/);
  });

  it('refuses when Cloudflare credentials are in the environment', () => {
    expect(() => assertLocalOnly(['--local'], { CLOUDFLARE_API_TOKEN: 'x' })).toThrow(/credentials/);
    expect(() => assertLocalOnly(['--local'], { CLOUDFLARE_API_KEY: 'x' })).toThrow(/credentials/);
  });

  it('the runner exits non-zero for --remote before touching anything', () => {
    const r = spawnSync(process.execPath, ['seed/run.ts', '--remote'], { encoding: 'utf8' });
    expect(r.status).not.toBe(0);
    expect(`${r.stderr}${r.stdout}`).toMatch(/Refusing to seed/);
  });
});
