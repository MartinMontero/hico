// "Now" for the guest app. The stamp on an item ("Check at the desk") is compared with the SERVER's clock, read from the
// `Date` header of a live response, so a phone with a wrong clock cannot make an old item look fresh (D-35 point 6).
// Offline, or before any response, the phone's clock is the fallback. A response the service worker served from its
// cache carries `X-From-Cache` and is ignored here: its `Date` is from the day it was stored.

let offsetMs = 0;

export function noteServerDate(dateHeader: string | null, fromCache: boolean): void {
  if (fromCache || !dateHeader) return;
  const server = Date.parse(dateHeader);
  if (Number.isNaN(server)) return;
  offsetMs = server - Date.now();
}

export const nowMs = (): number => Date.now() + offsetMs;
export const nowSeconds = (): number => Math.floor(nowMs() / 1000);

/** For tests only. */
export function resetClock(): void {
  offsetMs = 0;
}