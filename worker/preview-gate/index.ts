// Copied and adapted from C:\Users\User\dev\Serendipty\packages\gate\index.js (not imported).
// Same contract: ?k=<secret> that matches ACCESS_KEY sets a cookie holding the SHA-256 of
// the secret and 302s to the same path without k. Anything else is a flat 404, never a 401
// or a login form. A Worker with no ACCESS_KEY serves nothing (fail closed).
// Differences from the original: it is Hono middleware that runs first, so it covers /api/*
// as well as assets; it is active only when PREVIEW_GATE is "on"; the cookie is hc_preview.

import type { MiddlewareHandler } from 'hono';

export const GATE_COOKIE = 'hc_preview';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30;
const ROBOTS_TXT = 'User-agent: *\nDisallow: /\n';
const SECURITY_HEADERS: Record<string, string> = {
  'X-Robots-Tag': 'noindex, nofollow, noarchive',
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
};

const encoder = new TextEncoder();

async function sha256hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(value));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Both sides are reduced to a 64-character digest first, so length does not leak. */
async function timingSafeEqual(a: string, b: string): Promise<boolean> {
  const [ha, hb] = await Promise.all([sha256hex(a), sha256hex(b)]);
  let diff = 0;
  for (let i = 0; i < ha.length; i += 1) diff |= ha.charCodeAt(i) ^ hb.charCodeAt(i);
  return diff === 0;
}

function readCookie(header: string | null, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() === name) return part.slice(eq + 1).trim();
  }
  return null;
}

function hardened(body: BodyInit | null, init: ResponseInit, extra: Record<string, string>): Response {
  const headers = new Headers(init.headers);
  for (const [k, v] of Object.entries({ ...SECURITY_HEADERS, ...extra })) headers.set(k, v);
  return new Response(body, { ...init, headers });
}

function notFound(): Response {
  return hardened(
    'Not Found\n',
    { status: 404, headers: { 'Content-Type': 'text/plain; charset=utf-8' } },
    { 'Cache-Control': 'private, no-store' },
  );
}

export const previewGate: MiddlewareHandler<{ Bindings: Env }> = async (c, next) => {
  if (c.env.PREVIEW_GATE !== 'on') return next();

  const url = new URL(c.req.url);

  // Answered ahead of the gate so crawlers are told to go away rather than met with a bare 404.
  if (url.pathname === '/robots.txt') {
    return hardened(
      ROBOTS_TXT,
      { status: 200, headers: { 'Content-Type': 'text/plain; charset=utf-8' } },
      { 'Cache-Control': 'public, max-age=3600' },
    );
  }

  // Secrets are read with whitespace trimmed (a value piped from PowerShell can carry a newline).
  const accessKey = typeof c.env.ACCESS_KEY === 'string' ? c.env.ACCESS_KEY.trim() : '';
  if (accessKey.length === 0) return notFound();

  const expected = await sha256hex(accessKey);

  const presented = url.searchParams.get('k');
  if (presented !== null) {
    if (!(await timingSafeEqual(presented, accessKey))) return notFound();
    const target = new URL(url);
    target.searchParams.delete('k');
    // A relative Location keeps the visitor on whatever host they used; k is gone from it.
    return hardened(
      null,
      {
        status: 302,
        headers: {
          Location: `${target.pathname}${target.search}`,
          'Set-Cookie': `${GATE_COOKIE}=${expected}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${COOKIE_MAX_AGE}`,
        },
      },
      { 'Cache-Control': 'private, no-store' },
    );
  }

  const cookie = readCookie(c.req.header('Cookie') ?? null, GATE_COOKIE);
  if (cookie !== null && (await timingSafeEqual(cookie, expected))) {
    await next();
    // Authorised responses are never cached by shared caches or indexed.
    const res = new Response(c.res.body, c.res);
    for (const [k, v] of Object.entries(SECURITY_HEADERS)) res.headers.set(k, v);
    res.headers.set('Cache-Control', 'private, no-store');
    c.res = res;
    return;
  }

  return notFound();
};
