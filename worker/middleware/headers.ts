import type { MiddlewareHandler } from 'hono';

// 05 §14. Exact values; tests/worker/headers.test.ts compares them.
export const CSP = [
  "default-src 'none'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self'",
  "manifest-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'none'",
  "form-action 'self'",
].join('; ');

export const SECURITY_HEADERS: Record<string, string> = {
  'Content-Security-Policy': CSP,
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'Permissions-Policy': 'geolocation=(self), camera=(), microphone=(), payment=()',
};

export const securityHeaders: MiddlewareHandler = async (c, next) => {
  await next();
  const res = new Response(c.res.body, c.res);
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) res.headers.set(k, v);
  c.res = res;
};

/** Request log: id, route template, status, duration. Never cookies, tokens, queries or free text. */
export const requestLog: MiddlewareHandler = async (c, next) => {
  const started = Date.now();
  const id = crypto.randomUUID();
  await next();
  console.log(JSON.stringify({ id, route: c.req.routePath, status: c.res.status, ms: Date.now() - started }));
};
