import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import * as v from 'valibot';
import { LIMITS, TEXT_COLUMN_LIMITS } from '../../shared/limits.ts';
import { slugSchema } from '../../shared/schemas.ts';

// Every text column's CHECK must equal the limit in the shared schema (brief item 2), and every
// child must reference its tenant parent by (id, property_id) (05 §4 rule 3).

const sql = readdirSync('migrations')
  .filter((f) => f.endsWith('.sql'))
  .sort()
  .map((f) => readFileSync(`migrations/${f}`, 'utf8'))
  .join('\n');

interface Column { table: string; name: string; line: string }
const tables: { name: string; body: string; columns: Column[] }[] = [];
for (const m of sql.matchAll(/CREATE TABLE (\w+) \(\n([\s\S]*?)\n\);/g)) {
  const [, name, body] = m as unknown as [string, string, string];
  const columns: Column[] = [];
  for (const line of body.split('\n')) {
    const c = /^ {2}(\w+) (TEXT|INTEGER)\b/.exec(line);
    if (c && c[2] === 'TEXT') columns.push({ table: name, name: c[1] as string, line });
  }
  tables.push({ name, body, columns });
}

// Columns added later by ALTER TABLE x ADD COLUMN name TEXT ... (one per line) are held to the same rule.
const added: Column[] = [];
for (const m of sql.matchAll(/^ALTER TABLE (\w+) ADD COLUMN (\w+) TEXT\b.*$/gm)) {
  added.push({ table: m[1] as string, name: m[2] as string, line: `  ${m[2]} TEXT${m[0].slice(m[0].indexOf(' TEXT') + 5)}` });
}

describe('migration text columns carry the shared limits', () => {
  it('finds the tables, and the TEXT columns added by ALTER TABLE', () => {
    expect(tables.length).toBeGreaterThanOrEqual(15);
    expect(added.map((c) => c.table + '.' + c.name)).toEqual(['activities.change_note_en', 'activities.change_note_fr']);
  });

  const textColumns = [...tables.flatMap((t) => t.columns), ...added];

  it('every TEXT column is an enumeration or is listed with a limit, and its CHECK says the same number', () => {
    const problems: string[] = [];
    for (const col of textColumns) {
      const key = `${col.table}.${col.name}`;
      if (/\bIN \(/.test(col.line)) continue; // enumeration
      const limitName = TEXT_COLUMN_LIMITS[key];
      if (!limitName) {
        problems.push(`${key}: no entry in TEXT_COLUMN_LIMITS`);
        continue;
      }
      const m = new RegExp(`length\\(${col.name}\\) (<=|=) (\\d+)`).exec(col.line);
      if (!m) {
        problems.push(`${key}: no length CHECK`);
        continue;
      }
      if (Number(m[2]) !== LIMITS[limitName]) problems.push(`${key}: CHECK ${m[2]} but shared limit ${limitName} is ${LIMITS[limitName]}`);
    }
    expect(problems).toEqual([]);
  });

  it('every entry in TEXT_COLUMN_LIMITS names a real TEXT column', () => {
    const real = new Set(textColumns.map((c) => `${c.table}.${c.name}`));
    expect(Object.keys(TEXT_COLUMN_LIMITS).filter((k) => !real.has(k))).toEqual([]);
  });

  it('the shared schema agrees: slug schema stops at the same length as its CHECK', () => {
    expect(v.safeParse(slugSchema, 'a'.repeat(LIMITS.slug)).success).toBe(true);
    expect(v.safeParse(slugSchema, 'a'.repeat(LIMITS.slug + 1)).success).toBe(false);
    expect(LIMITS[TEXT_COLUMN_LIMITS['properties.slug'] as keyof typeof LIMITS]).toBe(LIMITS.slug);
  });

  it('every enumeration has a CHECK ... IN (...)', () => {
    for (const col of ['properties.languages', 'zones.ring', 'staff_memberships.role', 'activities.category', 'activities.status', 'places.category', 'property_features.feature', 'audit_log.actor_kind']) {
      const [t, c] = col.split('.') as [string, string];
      const line = textColumns.find((x) => x.table === t && x.name === c)?.line ?? '';
      expect(line, col).toMatch(/IN \(/);
    }
  });

  it('instants and flags are checked integers', () => {
    expect(sql).toMatch(/created_at INTEGER NOT NULL CHECK \(created_at >= 0\)/);
    expect(sql).toMatch(/is_placeholder INTEGER NOT NULL DEFAULT 0 CHECK \(is_placeholder IN \(0, 1\)\)/);
  });
});

describe('tenant keys (05 §4 rule 3)', () => {
  const tenantParents = ['zones', 'activities'];

  it('every parent that has a tenant column and an id is UNIQUE (id, property_id)', () => {
    // property_hosts is a lookup table nothing references; platform_flags has no tenant.
    const exempt = new Set(['property_hosts']);
    const missing = tables
      .filter((t) => /\n? {2}property_id /.test(t.body) && /^ {2}id /m.test(t.body) && !exempt.has(t.name))
      .filter((t) => !/UNIQUE \(id, property_id\)/.test(t.body))
      .map((t) => t.name);
    expect(missing).toEqual([]);
  });

  it('children of a tenant parent reference it by (id, property_id), never by id alone', () => {
    for (const parent of tenantParents) {
      expect(sql, parent).not.toMatch(new RegExp(`REFERENCES ${parent} \\(id\\)`));
      expect(sql, parent).toMatch(new RegExp(`REFERENCES ${parent} \\(id, property_id\\)`));
    }
  });

  it('the exception tables carry the owner in their composite key (D-23)', () => {
    expect(sql).toMatch(/FOREIGN KEY \(activity_id, owner_property_id\) REFERENCES activities \(id, property_id\)/);
    expect(sql).toMatch(/FOREIGN KEY \(activity_id, property_id\) REFERENCES activities \(id, property_id\)/);
  });

  it('ids are 128-bit hex', () => {
    expect(sql).toMatch(/length\(id\) = 32 AND id NOT GLOB '\*\[\^0-9a-f\]\*'/);
  });
});
