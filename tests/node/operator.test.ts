import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { emailOf, hostOf, inviteSql, nameOf, newToken, recoverySql, slugOf, sqlText } from '../../scripts/operator-lib.ts';

describe('operator scripts: what they will and will not write', () => {
  it('quote text safely', () => {
    expect(sqlText("O'Brien")).toBe("'O''Brien'");
    expect(sqlText("x'); DROP TABLE staff_users; --")).toBe("'x''); DROP TABLE staff_users; --'");
  });

  it('make tokens like the Worker does: 256 random bits, 43 characters, the SHA-256 is what is stored', () => {
    const a = newToken();
    const b = newToken();
    expect(a.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(a.token).not.toBe(b.token);
    expect(a.hash).toBe(createHash('sha256').update(a.token).digest('hex'));
    expect(a.hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('use the app\'s own rules: what the app would refuse, the script refuses', () => {
    expect(() => slugOf('Bad Slug')).toThrow();
    expect(() => slugOf('x'.repeat(41))).toThrow();
    expect(slugOf('vancouver-downtown')).toBe('vancouver-downtown');
    expect(() => emailOf('nope')).toThrow();
    expect(emailOf('  Fawzie@Example.ORG ')).toBe('fawzie@example.org');
    expect(() => nameOf('')).toThrow();
    expect(() => nameOf('x'.repeat(81))).toThrow();
    expect(() => hostOf('has spaces.example')).toThrow();
    expect(hostOf('Hico.Builderworkshop.ca')).toBe('hico.builderworkshop.ca');
  });

  it('write an invite that carries only the hash and an audit row for the system', () => {
    const { token, hash } = newToken();
    const sql = inviteSql({ slug: 'demo-whistler', email: 'a@b.test', displayName: 'Ann', role: 'admin', hash, now: 1000 });
    expect(sql).toContain(hash);
    expect(sql).not.toContain(token);
    expect(sql).toContain("'operator.invite.created'");
    expect(sql).toContain('1000');
    expect(sql).toContain(String(1000 + 30 * 60));
  });

  it('write a recovery link only for an active person, with the hash', () => {
    const { token, hash } = newToken();
    const sql = recoverySql({ email: 'a@b.test', hash, now: 5 });
    expect(sql).toContain('disabled_at IS NULL');
    expect(sql).toContain(hash);
    expect(sql).not.toContain(token);
  });

  it('the command line refuses anything remote and unknown commands', () => {
    const run = (...args: string[]) => spawnSync(process.execPath, ['scripts/operator.ts', ...args], { encoding: 'utf8' });
    const remote = run('invite-first-admin', '--slug', 'x', '--email', 'a@b.test', '--name', 'A', '--remote');
    expect(remote.status).not.toBe(0);
    expect(`${remote.stderr}`).toMatch(/Remote use is not available/);
    expect(run('burn-it-down').status).not.toBe(0);
    expect(run('invite-first-admin', '--slug', 'BAD SLUG', '--email', 'a@b.test', '--name', 'A').status).not.toBe(0);
  });
});
