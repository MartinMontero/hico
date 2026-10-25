// Offline use (05 §12): which responses the service worker may keep, and how long it waits for the network.
//
// NETWORK_TIMEOUT_MS is ASSUMED, not set by Martin (D-35; listed in O-23): the longest the service worker waits for the
// network before showing the last copy it kept. A guest on poor wifi sees the kept copy after this long. This is the only
// place the number is written; web/sw/ imports it.
export const NETWORK_TIMEOUT_MS = 3000;

export const CACHE_NAMES = { content: 'content-v1', assets: 'assets-v1' } as const;

/**
 * The only API responses the service worker keeps: public reads. None of them sets a cookie or depends on one (a test calls
 * each and checks). Nothing under /api/staff, no POST, and nothing with a session cookie is ever matched here.
 */
export const CONTENT_API = /^\/api\/hosts\/properties$|^\/api\/p\/[a-z0-9-]+\/(config|activities|places|offers)$/;

/** Built files whose names carry a content hash, and the self-hosted fonts: kept once, served from the copy. */
export const ASSET_PATH = /^\/(assets|fonts)\//;

/** A file the operator can edit to switch the service worker off everywhere: `{"enabled": false}`. */
export const SW_STATUS_PATH = '/sw-status.json';