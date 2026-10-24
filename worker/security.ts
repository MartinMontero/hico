const encoder = new TextEncoder();

export function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export function b64url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

/** A random 256-bit token as 43 URL-safe characters. Session cookies, invite and recovery links. */
export function randomToken(): string {
  return b64url(crypto.getRandomValues(new Uint8Array(32)));
}

/**
 * Staff tokens are random 256-bit values, so a plain SHA-256 is enough to store (decision 6 of the
 * Phase 1b-2 plan): nothing can be guessed from the hash, and the operator scripts can issue a link
 * without the Worker's secrets.
 */
export async function sha256Hex(value: string): Promise<string> {
  return toHex(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value))));
}

export async function hmacHex(key: string | Uint8Array, value: string): Promise<string> {
  const raw: Uint8Array<ArrayBuffer> = typeof key === 'string' ? encoder.encode(key) : new Uint8Array(key);
  const k = await crypto.subtle.importKey('raw', raw, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return toHex(new Uint8Array(await crypto.subtle.sign('HMAC', k, encoder.encode(value))));
}

export function bytesOf(value: unknown): Uint8Array {
  return new Uint8Array(value as ArrayBuffer | number[]);
}
