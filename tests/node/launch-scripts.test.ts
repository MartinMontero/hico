import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const launch = readFileSync('scripts/launch-check.ps1', 'utf8');
const verify = readFileSync('scripts/verify-deploy.ps1', 'utf8');

describe('preview launch scripts', () => {
  it('run full local validation against a deliberately limited preview hostname', () => {
    expect(launch).toContain('#Requires -Version 7.4');
    expect(launch).toContain('& npm run validate');
    expect(launch).toContain("^hico-preview\\.[a-z0-9-]+\\.workers\\.dev$");
    expect(launch).toContain("'Local launch checks passed. No remote resource was changed.'");
    expect(launch).toContain('Replace the preview D1 placeholder ID locally before launch.');
  });

  it('verify only the unauthenticated gate and leave authorized testing to a person', () => {
    expect(verify).toContain('Get-PreviewResponse');
    expect(verify).toContain('-Method Get');
    expect(verify).toContain('expected 404');
    expect(verify).toContain('private, no-store');
    expect(verify).toContain('Disallow: /');
    expect(verify).toContain('authorized human test checklist');
    expect(verify).not.toMatch(/ACCESS_KEY|hc_preview|[?&]k=/);
  });

  it('contain no deployment, DNS, secret or remote-database write path', () => {
    for (const text of [launch, verify]) {
      expect(text).not.toMatch(/wrangler\s+(deploy|versions|d1|secret)|Invoke-Operator|--remote|custom.?domain|Add-Dns|Set-Dns/i);
    }
  });
});
