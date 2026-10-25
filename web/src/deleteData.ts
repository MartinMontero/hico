// "Delete my data" (04 §4.3, D-35 point 5): clear everything this site stored on the device. In Stage 0 the server holds
// nothing about a guest, so there is nothing to delete there. Each step is wrapped: blocked storage must not stop the rest.

export async function deleteDeviceData(win: Window = window): Promise<void> {
  try {
    win.localStorage.clear();
  } catch {
    /* blocked: nothing was stored */
  }
  try {
    win.sessionStorage.clear();
  } catch {
    /* blocked */
  }
  try {
    if ('caches' in win) for (const name of await win.caches.keys()) await win.caches.delete(name);
  } catch {
    /* no Cache Storage */
  }
  try {
    for (const registration of (await win.navigator.serviceWorker?.getRegistrations()) ?? []) await registration.unregister();
  } catch {
    /* no service worker */
  }
  try {
    const dbs = (await win.indexedDB?.databases?.()) ?? [];
    for (const db of dbs) if (db.name) win.indexedDB.deleteDatabase(db.name);
  } catch {
    /* no IndexedDB */
  }
}