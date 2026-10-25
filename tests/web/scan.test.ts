import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { captureScanLabel, takeScanLabel } from '../../web/src/scan.ts';

// A labelled QR link: the label leaves the address bar at once, is handed over once, and nothing is stored.

const at = (url: string) => window.history.replaceState(null, '', url);
beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
  takeScanLabel();
});
afterEach(() => at('/'));

describe('captureScanLabel', () => {
  it('reads the label from a property address, removes the fragment, and hands the label over once', () => {
    at('/p/demo-whistler#l=front-desk');
    captureScanLabel();
    expect(window.location.hash).toBe('');
    expect(window.location.pathname).toBe('/p/demo-whistler');
    expect(takeScanLabel()).toBe('front-desk');
    expect(takeScanLabel()).toBeNull();
  });

  it('keeps the path and query, stores nothing and sets no cookie', () => {
    at('/p/demo-whistler/explore?x=1#l=desk');
    captureScanLabel();
    expect(window.location.pathname + window.location.search).toBe('/p/demo-whistler/explore?x=1');
    expect(window.localStorage.length).toBe(0);
    expect(window.sessionStorage.length).toBe(0);
    expect(document.cookie).toBe('');
  });

  it('ignores anything that is not a label, and any address that is not a property', () => {
    for (const url of ['/p/demo#l=Desk', '/p/demo#l=a_b', `/p/demo#l=${'x'.repeat(41)}`, '/p/demo#other=1', '/#l=desk', '/staff/accept#invite=abc']) {
      at(url);
      captureScanLabel();
      expect(takeScanLabel(), url).toBeNull();
    }
    at('/staff/accept#invite=abc');
    captureScanLabel();
    expect(window.location.hash).toBe('#invite=abc'); // a staff link keeps its fragment for the staff screen
  });
});