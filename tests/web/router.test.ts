import { describe, expect, it } from 'vitest';
import { parseRoute, tabPath } from '../../web/src/router.tsx';

describe('routes', () => {
  it('parses the root, a property, and each of the four tabs', () => {
    expect(parseRoute('/')).toEqual({ name: 'root' });
    expect(parseRoute('/p/demo-whistler')).toEqual({ name: 'property', slug: 'demo-whistler' });
    for (const tab of ['whats-on', 'explore', 'common-room', 'connect'] as const) {
      expect(parseRoute(`/p/demo-whistler/${tab}`)).toEqual({ name: 'tab', slug: 'demo-whistler', tab });
    }
    expect(parseRoute('/p/demo-whistler/explore/')).toEqual({ name: 'tab', slug: 'demo-whistler', tab: 'explore' });
  });

  it('treats anything else as unknown', () => {
    for (const path of ['/x', '/p/', '/p/UPPER/explore', '/p/a/nope', '/p/a/explore/extra', '/staff/p/a/me']) {
      expect(parseRoute(path).name, path).toBe('unknown');
    }
  });

  it('builds tab paths', () => {
    expect(tabPath('vancouver-downtown', 'whats-on')).toBe('/p/vancouver-downtown/whats-on');
  });
});
