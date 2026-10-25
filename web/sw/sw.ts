/// <reference lib="webworker" />
import { CACHE_NAMES, SW_STATUS_PATH } from '../../shared/offline.ts';
import { classify, handle, SHELL, switchedOff } from './logic.ts';

// The service worker (05 §12). Built on its own into /sw.js (vite.sw.config.ts) so it is one plain script, not a module.
declare const self: ServiceWorkerGlobalScope;

const names = { content: CACHE_NAMES.content, assets: CACHE_NAMES.assets };

self.addEventListener('install', (event) => {
  // Keep the shell so the first offline visit has something to open. A failure here (offline at install) is fine.
  event.waitUntil(
    (async () => {
      try {
        const res = await fetch(SHELL);
        if (res.ok) await (await caches.open(names.content)).put(SHELL, res);
      } catch {
        /* no network now: the shell is kept on the next online visit */
      }
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // The operator's off switch: unregister and forget everything.
      if (await switchedOff(() => fetch(SW_STATUS_PATH, { cache: 'no-store' }))) {
        for (const key of await caches.keys()) await caches.delete(key);
        await self.registration.unregister();
        return;
      }
      const keep: string[] = [names.content, names.assets];
      for (const key of await caches.keys()) if (!keep.includes(key)) await caches.delete(key);
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const plan = classify(event.request, self.location.origin);
  if (!plan) return; // not ours: the browser handles it as if there were no service worker
  event.respondWith(
    handle(
      event.request,
      plan,
      {
        caches,
        fetch: (req) => fetch(req),
        timeout: (ms) => new Promise((resolve) => setTimeout(() => resolve('timeout'), ms)),
        waitUntil: (p) => event.waitUntil(p),
      },
      names,
    ),
  );
});