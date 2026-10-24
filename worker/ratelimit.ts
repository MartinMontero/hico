import { ratelimit } from './repositories/index.ts';
import { hmacHex } from './security.ts';

// Abuse control for the staff endpoints (plan decision 7). The counter key is a keyed hash of the network
// address and the endpoint name, with a key that changes every UTC day (HMAC of the date under
// RATE_LIMIT_SECRET), so counters cannot be linked across days and no address is stored.
// CF-Connecting-IP is set by Cloudflare at the edge; here it is used only to count, never to decide a tenant.

let fallbackSecret: string | null = null;

async function dailyKey(secret: string, now: number): Promise<string> {
  const day = new Date(now * 1000).toISOString().slice(0, 10);
  return hmacHex(secret, `day:${day}`);
}

export async function allow(
  env: Env,
  request: Request,
  endpoint: string,
  limit: number,
  windowSeconds: number,
  now: number,
): Promise<boolean> {
  // No secret bound (local development): a per-isolate random one still counts, it just resets on restart.
  const secret = env.RATE_LIMIT_SECRET?.trim() || (fallbackSecret ??= crypto.randomUUID());
  const address = request.headers.get('CF-Connecting-IP') ?? 'local';
  const key = await hmacHex(await dailyKey(secret, now), `${endpoint}:${address}`);
  return ratelimit.hit(env.DB, key, limit, windowSeconds, now);
}
