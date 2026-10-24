import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import * as repositories from '../../worker/repositories/index.ts';

// Meta-test (05 §4 rule 6): every exported repository function must be named in a
// covers('module.function') call in the isolation suite. Add a function without a test and this fails.

const suite = readFileSync('tests/worker/isolation.test.ts', 'utf8');
const covered = new Set<string>();
for (const call of suite.matchAll(/covers\(([^)]*)\)/g)) {
  for (const name of (call[1] ?? '').matchAll(/'([\w.]+)'/g)) covered.add(name[1] as string);
}

const exported: string[] = [];
for (const [moduleName, mod] of Object.entries(repositories)) {
  for (const [fn, value] of Object.entries(mod)) {
    if (typeof value === 'function') exported.push(`${moduleName}.${fn}`);
  }
}

describe('isolation coverage', () => {
  it('finds the repository functions', () => {
    expect(exported.length).toBeGreaterThanOrEqual(16);
  });

  it('every exported repository function has an isolation test', () => {
    expect(exported.filter((name) => !covered.has(name))).toEqual([]);
  });

  it('every covers() names a function that exists (no stale names)', () => {
    expect([...covered].filter((name) => !exported.includes(name))).toEqual([]);
  });

  it('append-only and increment-only tables export no update or delete function', () => {
    expect(Object.keys(repositories.audit)).toEqual(['append']);
    expect(Object.keys(repositories.events).sort()).toEqual(['countFor', 'increment']);
  });

  it('no repository function is named like a write unless it is on the reviewed list', () => {
    const writeLike = exported.filter((n) => /\.(update|delete|remove|create|insert|set|change|save|put)/i.test(n));
    expect(writeLike).toEqual([]);
  });

  it('write functions for activities must call a guard (none exist in Phase 1)', () => {
    // When one is added, this reminds the author: it must call canEditActivity or canChangeOfferedAt.
    expect(Object.keys(repositories.activities).sort()).toEqual(['canChangeOfferedAt', 'canEditActivity', 'getVisible', 'listVisible']);
  });
});
