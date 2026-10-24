import type { ComponentChildren } from 'preact';
import { useId, useLayoutEffect, useRef } from 'preact/hooks';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function focusables(root: HTMLElement | null): HTMLElement[] {
  return root ? Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)) : [];
}

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ComponentChildren;
  /**
   * The control to give focus back to. Pass it when the page behind the dialog is made inert in the
   * same render that opens the dialog: the browser then blurs the opener at once, so
   * document.activeElement is already the body when this component's effect runs.
   */
  returnFocusTo?: HTMLElement | null;
}

/**
 * Accessible modal: role=dialog, labelled by its title, focus moves in on open and returns to
 * the opener on close, Tab and Shift+Tab are trapped, Escape and a click on the backdrop close.
 * The page behind it is made inert by the caller (see App).
 */
export function Dialog({ open, onClose, title, children, returnFocusTo }: DialogProps) {
  const titleId = useId();
  const panel = useRef<HTMLDivElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // A layout effect, not a passive one: the Escape listener and the move of focus must exist the moment the dialog is on screen.
  // A passive effect can run a frame later, and a key pressed in that gap would be lost.
  useLayoutEffect(() => {
    if (!open) return undefined;
    opener.current = returnFocusTo ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
    document.body.classList.add('scroll-locked');
    (focusables(panel.current)[0] ?? panel.current)?.focus();

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab') return;
      const items = focusables(panel.current);
      if (items.length === 0) {
        event.preventDefault();
        panel.current?.focus();
        return;
      }
      const first = items[0] as HTMLElement;
      const last = items[items.length - 1] as HTMLElement;
      const active = document.activeElement;
      if (!panel.current?.contains(active)) {
        event.preventDefault();
        first.focus();
      } else if (event.shiftKey && (active === first || active === panel.current)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.classList.remove('scroll-locked');
      opener.current?.focus();
    };
    // returnFocusTo is read when the dialog opens; a later change must not re-run this effect.
  }, [open]);

  if (!open) return null;
  return (
    <div
      class="overlay"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      {/* The brief and 04 §6 require role="dialog" on a labelled modal; focus handling is in this file. */}
      {/* oxlint-disable-next-line jsx-a11y/prefer-tag-over-role */}
      <div class="sheet" role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} ref={panel}>
        <h2 id={titleId} class="sheet-title">
          {title}
        </h2>
        {children}
      </div>
    </div>
  );
}
