import { render } from 'preact';
import { act } from 'preact/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PublicProperty } from '../../shared/types.ts';
import { Consent } from '../../web/src/Consent.tsx';
import { UiProvider } from '../../web/src/context.tsx';
import { deleteDeviceData } from '../../web/src/deleteData.ts';
import { Privacy, PrivacyContact } from '../../web/src/Privacy.tsx';

// Settings and privacy (04 §4.3, 06 §1 and §5): every feature listed, every switch off and disabled, the privacy contact
// (or a visible placeholder), the reusable consent screen, and "Delete my data".

const base: PublicProperty = { slug: 'demo', name: { en: 'Demo', fr: 'Démo' }, timezone: 'America/Vancouver', languages: ['en', 'fr'], features: { common_room: false, connect: false }, privacyContact: { title: '', address: '' }, hasPlaceholders: false };
let container: HTMLElement;
const show = (node: preact.ComponentChild) => act(() => render(<UiProvider>{node}</UiProvider>, container));
beforeEach(() => {
  container = document.createElement('div');
  document.body.append(container);
  window.localStorage.clear();
});
afterEach(() => {
  render(null, container);
  container.remove();
  vi.restoreAllMocks();
});

describe('the privacy list', () => {
  it('lists every feature of the 06 §1.1 matrix; every switch is off and disabled; none is available yet', async () => {
    await show(<Privacy property={base} />);
    const names = [...container.querySelectorAll('li.card')].map((li) => li.querySelector('label span, strong')?.textContent);
    expect(names).toEqual([
      'Anonymous guest session', 'I am 18 or over', 'Common Room posting', 'Send signals', 'See nearby signals', 'Reply to a signal', 'Share my name on a reply', "Check I'm here", 'Wallet pass',
    ]);
    const switches = [...container.querySelectorAll<HTMLInputElement>('input[role="switch"]')];
    expect(switches).toHaveLength(7); // "Check I'm here" and the wallet pass are asked for each time: no standing switch (04 §4.3)
    for (const s of switches) {
      expect(s.checked).toBe(false);
      expect(s.disabled).toBe(true);
    }
    expect(container.textContent).toContain('Not available at this property yet');
    expect(container.textContent).toContain('No standing switch');
  });

  it('gives the five facts of each feature in the order of 06 §5', async () => {
    await show(<Privacy property={base} />);
    const first = container.querySelector('li.card details');
    expect([...(first?.querySelectorAll('dt') ?? [])].map((d) => d.textContent)).toEqual(['What it does', 'What is shared', 'With whom', 'For how long', 'How to stop']);
  });

  it('says in French what it says in English, with no English left over', async () => {
    window.localStorage.setItem('hc_lang', 'fr');
    await show(<Privacy property={base} />);
    expect(container.textContent).toContain('Pas encore offert');
    expect(container.textContent).not.toContain('(anglais seulement)'); // no string fell back to English
  });
});

describe('the privacy contact', () => {
  it('is shown when the property has one', async () => {
    await show(<PrivacyContact property={{ ...base, privacyContact: { title: 'Privacy officer', address: 'privacy@example.org' } }} />);
    expect(container.textContent).toContain('Privacy officer, privacy@example.org');
    expect(container.querySelector('[data-missing]')).toBeNull();
  });
  it('is a visible placeholder when it is empty, and is never invented', async () => {
    await show(<PrivacyContact property={base} />);
    expect(container.querySelector('[data-missing="privacy-contact"]')?.textContent).toBe('This property has not given a privacy contact yet.');
    expect(container.textContent).not.toMatch(/@/);
  });
  it('is the placeholder while the property is still loading', async () => {
    await show(<PrivacyContact property={null} />);
    expect(container.querySelector('[data-missing]')).not.toBeNull();
  });
});

describe('the consent screen', () => {
  const facts = { what: 'W', shared: 'S', with: 'H', kept: 'K', stop: 'T' };
  it('shows the five facts in order, the wording version, and two equal choices with nothing selected', async () => {
    const calls: string[] = [];
    await show(<Consent title="Send signals" facts={facts} version="2026-10-25.1" onNotNow={() => calls.push('no')} onTurnOn={() => calls.push('yes')} />);
    expect([...container.querySelectorAll('dt')].map((d) => d.textContent)).toEqual(['What it does', 'What is shared', 'With whom', 'For how long', 'How to stop']);
    expect([...container.querySelectorAll('dd')].map((d) => d.textContent)).toEqual(['W', 'S', 'H', 'K', 'T']);
    expect(container.textContent).toContain('Wording version 2026-10-25.1');
    const buttons = [...container.querySelectorAll('button')];
    expect(buttons.map((b) => b.textContent)).toEqual(['Not now', 'Turn on']);
    expect(buttons[0]?.className).toBe(buttons[1]?.className); // same size and visual weight
    expect(container.querySelector('input:checked')).toBeNull();
    expect(container.querySelector('[autofocus]')).toBeNull();
    await act(() => buttons[0]?.click());
    expect(calls).toEqual(['no']);
  });
  it('names who holds the data only when told to', async () => {
    await show(<Consent title="x" facts={facts} version="1" onNotNow={() => {}} onTurnOn={() => {}} />);
    expect(container.textContent).not.toContain('is held by');
    await show(<Consent title="x" facts={facts} version="1" holder="Cloudflare" onNotNow={() => {}} onTurnOn={() => {}} />);
    expect(container.textContent).toContain('Your data is held by Cloudflare.');
  });
});

describe('Delete my data', () => {
  it('clears local and session storage, every cache, every service worker, and tolerates a part that is blocked', async () => {
    window.localStorage.setItem('hc_lang', 'fr');
    window.localStorage.setItem('hc_plan:demo', '["a"]');
    window.sessionStorage.setItem('x', '1');
    const deletedCaches: string[] = [];
    const unregistered: string[] = [];
    const fake = {
      localStorage: window.localStorage,
      sessionStorage: window.sessionStorage,
      caches: { keys: async () => ['content-v1', 'assets-v1'], delete: async (k: string) => { deletedCaches.push(k); return true; } },
      navigator: { serviceWorker: { getRegistrations: async () => [{ unregister: async () => { unregistered.push('sw'); return true; } }] } },
      indexedDB: { databases: async () => [{ name: 'db1' }], deleteDatabase: vi.fn() },
    } as unknown as Window;
    await deleteDeviceData(fake);
    expect(window.localStorage.length).toBe(0);
    expect(window.sessionStorage.length).toBe(0);
    expect(deletedCaches).toEqual(['content-v1', 'assets-v1']);
    expect(unregistered).toEqual(['sw']);
    expect(fake.indexedDB.deleteDatabase).toHaveBeenCalledWith('db1');
  });

  it('still clears the rest when storage throws', async () => {
    vi.spyOn(Storage.prototype, 'clear').mockImplementation(() => { throw new Error('blocked'); });
    const deleted: string[] = [];
    const fake = { localStorage: window.localStorage, sessionStorage: window.sessionStorage, caches: { keys: async () => ['c'], delete: async (k: string) => { deleted.push(k); return true; } }, navigator: {} } as unknown as Window;
    await expect(deleteDeviceData(fake)).resolves.toBeUndefined();
    expect(deleted).toEqual(['c']);
  });
});