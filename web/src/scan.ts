// A labelled QR link (Stage 0, 04 §3, 05 §7): /p/<slug>#l=<label>. The page reads the label, removes it from the address
// bar at once, and reports it ONCE as an anonymous count for that property. No cookie is set and nothing is stored about
// the guest; the fragment never reaches the server except in that one count request.
import { parseRoute } from './router.tsx';

const LABEL = /^#l=([a-z0-9-]{1,40})$/;
let pending: string | null = null;

/** Called once at start-up, before the first render. Only a property address can carry a label. */
export function captureScanLabel(win: Window = window): void {
  const route = parseRoute(win.location.pathname);
  if (route.name !== 'tab' && route.name !== 'property') return;
  const match = LABEL.exec(win.location.hash);
  if (!match?.[1]) return;
  pending = match[1];
  win.history.replaceState(null, '', win.location.pathname + win.location.search);
}

/** The captured label, once. */
export function takeScanLabel(): string | null {
  const label = pending;
  pending = null;
  return label;
}