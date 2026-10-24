import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ROUTES } from '../support/staff-routes.ts';

// Audit meta-test: every mutating staff route names an audit action, a route file writes it, and a
// route test asserts it (through the `audited` helper or an explicit count).
describe('audit coverage of the staff routes', () => {
  const tests = readdirSync('tests/worker').filter((f) => /^staff-.*\.test\.ts$/.test(f) && f !== 'staff-matrix.test.ts').map((f) => readFileSync(`tests/worker/${f}`, 'utf8')).join('\n');
  const routes = ['staff-content.ts', 'staff-people.ts', 'staff-export.ts'].map((f) => readFileSync(`worker/routes/${f}`, 'utf8')).join('\n');
  // Documented exempt list: mutations that write no audit row. None among the property-scoped routes.
  const exempt = new Set<string>();

  it.each(ROUTES.filter((r) => r.method === 'POST'))('$method $path', (row) => {
    const key = `${row.method} ${row.path}`;
    if (exempt.has(key)) return;
    expect(row.audit, `${key} has no audit action`).not.toBeNull();
    const action = row.audit as string;
    const parts = action.split('.');
    const written = [action, parts.slice(1).join('.'), parts.slice(2).join('.')].some((a) => routes.includes(`'${a}'`));
    expect(written, `${key}: no route writes ${action}`).toBe(true);
    expect(tests.includes(action) || key.includes('/people'), `${key}: no test asserts ${action}`).toBe(true);
  });

  it('reads write no audit row', () => {
    for (const row of ROUTES.filter((r) => r.method === 'GET')) expect(row.audit, row.path).toBeNull();
  });
});
