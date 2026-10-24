import type { MiddlewareHandler } from 'hono';
import { parseLanguage, type Language } from '../../shared/schemas.ts';
import { flags } from '../repositories/index.ts';

const MESSAGES: Record<Language, string> = {
  en: 'This app is read-only right now. You can still look around; try again soon.',
  fr: 'Cette application est en lecture seule pour le moment. Vous pouvez toujours consulter; réessayez bientôt.',
};

export function requestLanguage(acceptLanguage: string | undefined): Language {
  return parseLanguage(acceptLanguage ?? null) ?? 'en';
}

// The flag is read on each request; a few seconds of caching in the isolate is allowed (brief 11).
const TTL_MS = 5000;
let cached: { value: boolean; at: number } | null = null;
export function resetReadOnlyCache(): void {
  cached = null;
}

async function isReadOnly(db: D1Database): Promise<boolean> {
  const now = Date.now();
  if (cached && now - cached.at < TTL_MS) return cached.value;
  const value = (await flags.getFlag(db, 'read_only')) === 'on';
  cached = { value, at: now };
  return value;
}

const SAFE = new Set(['GET', 'HEAD', 'OPTIONS']);

/** 503 for every state-changing request while platform_flags.read_only is "on". Reads keep working. */
export const readOnlySwitch: MiddlewareHandler<{ Bindings: Env }> = async (c, next) => {
  if (SAFE.has(c.req.method)) return next();
  if (await isReadOnly(c.env.DB)) {
    const lang = requestLanguage(c.req.header('Accept-Language'));
    return c.json({ error: 'read_only', message: MESSAGES[lang] }, 503, { 'Retry-After': '60' });
  }
  return next();
};

/** 05 §4 rule 9: writes need an Origin that matches the site and a JSON content type. */
export const writeGuards: MiddlewareHandler<{ Bindings: Env }> = async (c, next) => {
  if (SAFE.has(c.req.method)) return next();
  const origin = c.req.header('Origin');
  if (!origin || origin !== new URL(c.req.url).origin) {
    return c.json({ error: 'forbidden' }, 403);
  }
  const type = c.req.header('Content-Type') ?? '';
  if (!type.toLowerCase().startsWith('application/json')) {
    return c.json({ error: 'unsupported_media_type' }, 415);
  }
  return next();
};
