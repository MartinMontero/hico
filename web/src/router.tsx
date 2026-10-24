import type { ComponentChildren } from 'preact';
import { useEffect, useState } from 'preact/hooks';

// A small History-API router. No dependency; focus is moved to the page heading on change.

type Listener = () => void;
const listeners = new Set<Listener>();

export function currentPath(): string {
  return window.location.pathname;
}

// True once the guest has moved to another page (a link or Back), so the new page's heading takes
// focus. A first load or a redirect does not move focus: screen readers start at the top.
let moved = false;
export function consumeNavigation(): boolean {
  const was = moved;
  moved = false;
  return was;
}

/** The next screen replaces the one the guest was on (for example after signing out): its heading takes focus. */
export function markMoved(): void {
  moved = true;
}

export function navigate(path: string, replace = false): void {
  if (path === currentPath()) return;
  if (replace) window.history.replaceState(null, '', path);
  else {
    window.history.pushState(null, '', path);
    moved = true;
  }
  for (const l of listeners) l();
}

export function usePath(): string {
  const [path, setPath] = useState(currentPath());
  useEffect(() => {
    const update = () => setPath(currentPath());
    const onPop = () => {
      moved = true;
      update();
    };
    listeners.add(update);
    window.addEventListener('popstate', onPop);
    return () => {
      listeners.delete(update);
      window.removeEventListener('popstate', onPop);
    };
  }, []);
  return path;
}

export interface LinkProps {
  href: string;
  class?: string;
  'aria-current'?: 'page' | undefined;
  onClick?: (event: MouseEvent) => void;
  children?: ComponentChildren;
}

export function Link({ href, children, onClick, ...rest }: LinkProps) {
  return (
    <a
      class={rest.class}
      aria-current={rest['aria-current']}
      href={href}
      onClick={(event) => {
        // Let the browser handle new-tab clicks and modified clicks.
        if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        navigate(href);
        onClick?.(event);
      }}
    >
      {children}
    </a>
  );
}

export type Route =
  | { name: 'root' }
  | { name: 'tab'; slug: string; tab: Tab }
  | { name: 'property'; slug: string }
  | { name: 'staff' }
  | { name: 'unknown' };

export const TABS = ['whats-on', 'explore', 'common-room', 'connect'] as const;
export type Tab = (typeof TABS)[number];

export function parseRoute(path: string): Route {
  if (path === '/' || path === '') return { name: 'root' };
  // The staff console is its own lazily loaded chunk: /staff, /staff/accept, /staff/account, /staff/p/<slug>/...
  if (path === '/staff' || path.startsWith('/staff/')) return { name: 'staff' };
  const m = /^\/p\/([a-z0-9-]+)(?:\/([a-z-]+))?\/?$/.exec(path);
  if (!m || !m[1]) return { name: 'unknown' };
  if (!m[2]) return { name: 'property', slug: m[1] };
  return (TABS as readonly string[]).includes(m[2]) ? { name: 'tab', slug: m[1], tab: m[2] as Tab } : { name: 'unknown' };
}

export function tabPath(slug: string, tab: Tab): string {
  return `/p/${slug}/${tab}`;
}
