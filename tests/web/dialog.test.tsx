import { render } from 'preact';
import { act } from 'preact/test-utils';
import { useState } from 'preact/hooks';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Dialog } from '../../web/src/Dialog.tsx';
import { ToastRegion } from '../../web/src/context.tsx';

let container: HTMLElement;

function Harness({ startOpen = false }: { startOpen?: boolean }) {
  const [open, setOpen] = useState(startOpen);
  return (
    <>
      <button id="before">Before</button>
      <button id="opener" onClick={() => setOpen(true)}>
        Open
      </button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Settings">
        <button id="a">A</button>
        <input id="b" aria-label="B" />
        <button id="c">C</button>
      </Dialog>
    </>
  );
}

const $ = (sel: string) => document.querySelector(sel) as HTMLElement;
const key = (k: string, init: KeyboardEventInit = {}) =>
  act(() => {
    document.activeElement?.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...init }));
  });

async function openIt() {
  $('#opener').focus();
  await act(() => {
    $('#opener').click();
  });
}

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
});
afterEach(() => {
  render(null, container);
  container.remove();
  document.body.className = '';
});

describe('Dialog', () => {
  it('renders nothing while closed', () => {
    render(<Harness />, container);
    expect($('[role="dialog"]')).toBeNull();
  });

  it('is a labelled modal dialog', async () => {
    render(<Harness />, container);
    await openIt();
    const dialog = $('[role="dialog"]');
    expect(dialog).not.toBeNull();
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    const labelId = dialog.getAttribute('aria-labelledby') as string;
    expect(labelId).toBeTruthy();
    expect(document.getElementById(labelId)?.textContent).toBe('Settings');
  });

  it('moves focus into the dialog when it opens', async () => {
    render(<Harness />, container);
    await openIt();
    expect(document.activeElement?.id).toBe('a');
  });

  it('traps Tab: from the last control it wraps to the first', async () => {
    render(<Harness />, container);
    await openIt();
    $('#c').focus();
    await key('Tab');
    expect(document.activeElement?.id).toBe('a');
  });

  it('traps Shift+Tab: from the first control it wraps to the last', async () => {
    render(<Harness />, container);
    await openIt();
    $('#a').focus();
    await key('Tab', { shiftKey: true });
    expect(document.activeElement?.id).toBe('c');
  });

  it('pulls focus back in if it somehow sits outside the dialog', async () => {
    render(<Harness />, container);
    await openIt();
    $('#before').focus();
    await key('Tab');
    expect(document.activeElement?.id).toBe('a');
  });

  it('closes on Escape and returns focus to the control that opened it', async () => {
    render(<Harness />, container);
    await openIt();
    expect($('[role="dialog"]')).not.toBeNull();
    await key('Escape');
    expect($('[role="dialog"]')).toBeNull();
    expect(document.activeElement?.id).toBe('opener');
  });

  it('closes on a click on the backdrop but not on a click inside', async () => {
    render(<Harness />, container);
    await openIt();
    await act(() => {
      $('.sheet').dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    });
    expect($('[role="dialog"]')).not.toBeNull();
    await act(() => {
      $('.overlay').dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    });
    expect($('[role="dialog"]')).toBeNull();
    expect(document.activeElement?.id).toBe('opener');
  });

  it('locks page scroll while open and releases it on close', async () => {
    render(<Harness />, container);
    await openIt();
    expect(document.body.classList.contains('scroll-locked')).toBe(true);
    await key('Escape');
    expect(document.body.classList.contains('scroll-locked')).toBe(false);
  });

  it('can open and close repeatedly without losing the opener', async () => {
    render(<Harness />, container);
    for (let i = 0; i < 3; i += 1) {
      await openIt();
      expect(document.activeElement?.id).toBe('a');
      await key('Escape');
      expect(document.activeElement?.id).toBe('opener');
    }
  });
});

describe('Toast region', () => {
  it('is a polite live region that is in the DOM even when empty, and shows the message when set', async () => {
    render(<ToastRegion message="" />, container);
    const region = $('.toast-region');
    expect(region.tagName).toBe('OUTPUT'); // implicit role=status
    expect(region.getAttribute('aria-live')).toBe('polite');
    expect(region.textContent).toBe('');
    await act(() => render(<ToastRegion message="Language set to English" />, container));
    expect($('.toast-region').textContent).toBe('Language set to English');
  });
});
