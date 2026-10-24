import type { Context } from 'hono';
import { sessions } from '../repositories/index.ts';
import { sha256Hex } from '../security.ts';
import type { StaffResolver } from './tenant.ts';

export const STAFF_COOKIE = 'hc_staff';
export const SESSION_SECONDS = 12 * 3600; // 12 hours from sign-in, no sliding window (plan decision 5)

function readCookie(header: string | null | undefined, name: string): string | null {
  for (const part of (header ?? '').split(';')) {
    const eq = part.indexOf('=');
    if (eq !== -1 && part.slice(0, eq).trim() === name) return part.slice(eq + 1).trim();
  }
  return null;
}

export function sessionCookie(token: string, maxAge: number): string {
  return `${STAFF_COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}

export const clearedSessionCookie = sessionCookie('', 0);

export interface StaffSession {
  staffUserId: string;
  sessionId: string;
}

/** The live session behind this request's cookie, or null. The cookie holds a random token; only its hash is stored. */
export async function readStaffSession(db: D1Database, request: Request, now: number): Promise<StaffSession | null> {
  const token = readCookie(request.headers.get('Cookie'), STAFF_COOKIE);
  if (!token || token.length > 128) return null;
  return sessions.findActive(db, await sha256Hex(token), now);
}

/** The default StaffResolver: the session cookie. Phase 1's injected resolver stays available for tests. */
export function cookieResolver(now: () => number): StaffResolver {
  return async (c) => {
    const s = await readStaffSession(c.env.DB, c.req.raw, now());
    return s ? { staffUserId: s.staffUserId } : null;
  };
}

export type AnyContext = Context<{ Bindings: Env }>;
