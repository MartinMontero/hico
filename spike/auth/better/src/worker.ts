// SPIKE (Phase 1b-1, Route 2): Better Auth 1.7.12 + its passkey plugin on a Worker with local D1.
// Throwaway; never imported by worker/. Same seam as Route 3: the session becomes a StaffResolver.
import { Hono } from 'hono';
import { betterAuth } from 'better-auth';
import { getMigrations } from 'better-auth/db/migration';
import { passkey } from '@better-auth/passkey';
import { newId } from '../../../../worker/ids.ts';
import { writeGuards } from '../../../../worker/middleware/guards.ts';
import { requestLog, securityHeaders } from '../../../../worker/middleware/headers.ts';
import { staffTenant } from '../../../../worker/middleware/tenant.ts';
import { audit } from '../../../../worker/repositories/index.ts';
import { createTenantContext } from '../../../../worker/tenant.ts';

interface SpikeEnv extends Env {
  ORIGIN: string;
  RP_ID: string;
  SESSION_PEPPER: string;
  SPIKE_TEST?: string;
}

const TOKEN_SECONDS = 30 * 60;
const now = () => Math.floor(Date.now() / 1000);
const enc = new TextEncoder();
const b64url = (bytes: Uint8Array): string => btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
const randomToken = (): string => b64url(crypto.getRandomValues(new Uint8Array(32)));
async function hmacHex(pepper: string, value: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', enc.encode(pepper), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return Array.from(new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(value))), (b) => b.toString(16).padStart(2, '0')).join('');
}
const emailOk = (e: unknown): e is string => typeof e === 'string' && e.length <= 120 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

async function auditPerson(db: D1Database, staffUserId: string, action: string): Promise<void> {
  const { results } = await db
    .prepare('SELECT m.property_id, p.slug, p.timezone FROM staff_memberships m JOIN properties p ON p.id = m.property_id WHERE m.staff_user_id = ?1')
    .bind(staffUserId)
    .all<{ property_id: string; slug: string; timezone: string }>();
  for (const m of results) {
    await audit.append(createTenantContext(db, { propertyId: m.property_id, slug: m.slug, timezone: m.timezone }), { actorKind: 'staff', actorStaffId: staffUserId, action, targetType: 'staff', targetId: staffUserId }, now());
  }
}

/** Everything the invite or recovery token authorises, once the passkey ceremony has verified. */
async function afterRegistration(env: SpikeEnv, user: { id: string }, context: string | null | undefined): Promise<void> {
            if (!context) return;
            const t = await env.DB.prepare(
              'UPDATE staff_tokens SET used_at = ?2 WHERE token_hash = ?1 AND used_at IS NULL AND expires_at > ?2 RETURNING purpose, email, property_id, role',
            ).bind(await hmacHex(env.SESSION_PEPPER, context), now()).first<{ purpose: string; email: string; property_id: string | null; role: string | null }>();
            if (!t) throw new Error('invalid token');
            // Finding: with requireSession false the plugin does NOT create the library's own user row
            // (its table needs a unique email); the hook has to write it, in the library's table shape.
            const iso = new Date().toISOString();
            await env.DB.prepare('INSERT OR IGNORE INTO "user" (id, name, email, emailVerified, createdAt, updatedAt) VALUES (?1, ?2, ?2, 1, ?3, ?3)').bind(user.id, t.email, iso).run();
            const exists = await env.DB.prepare('SELECT id FROM staff_users WHERE id = ?1').bind(user.id).first();
            if (!exists) await env.DB.prepare('INSERT INTO staff_users (id, email, created_at) VALUES (?1, ?2, ?3)').bind(user.id, t.email, now()).run();
            if (t.purpose === 'invite' && t.property_id && t.role) {
              await env.DB.prepare('INSERT OR IGNORE INTO staff_memberships (staff_user_id, property_id, role) VALUES (?1, ?2, ?3)').bind(user.id, t.property_id, t.role).run();
              await auditPerson(env.DB, user.id, 'staff.invite.accepted');
            } else if (t.purpose === 'recovery') {
              // Better Auth has no recovery flow: replacing access is our code, against its tables.
              await env.DB.batch([
                env.DB.prepare('DELETE FROM session WHERE userId = ?1').bind(user.id),
                env.DB.prepare('DELETE FROM passkey WHERE userId = ?1 AND createdAt < ?2').bind(user.id, new Date(Date.now() - 1000).toISOString()),
              ]);
              await auditPerson(env.DB, user.id, 'staff.recovery.completed');
            }
}

/** One Better Auth instance per request: the D1 binding only exists inside a request on Workers. */
export function makeAuth(env: SpikeEnv) {
  return betterAuth({
    database: env.DB, // Better Auth 1.7.12 ships a D1 dialect: the binding is passed as it is
    baseURL: env.ORIGIN,
    secret: env.SESSION_PEPPER,
    trustedOrigins: [env.ORIGIN],
    emailAndPassword: { enabled: false },
    // Spike diagnostics: message text only (never request bodies, cookies or tokens).
    logger: { level: 'debug', log: (level, message) => console.log('BA', level, String(message).slice(0, 400)) },
    session: { expiresIn: 12 * 3600, updateAge: 3600 },
    plugins: [
      passkey({
        rpID: env.RP_ID,
        rpName: 'HI CO spike',
        origin: env.ORIGIN,
        authenticatorSelection: { residentKey: 'required', userVerification: 'required' },
        registration: {
          // Pre-auth registration: the "context" is OUR single-use invite or recovery token.
          requireSession: false,
          resolveUser: async ({ context }) => {
            if (!context) throw new Error('invite required');
            const t = await env.DB.prepare('SELECT email FROM staff_tokens WHERE token_hash = ?1 AND used_at IS NULL AND expires_at > ?2')
              .bind(await hmacHex(env.SESSION_PEPPER, context), now())
              .first<{ email: string }>();
            if (!t) throw new Error('invalid token');
            const existing = await env.DB.prepare('SELECT id FROM staff_users WHERE email = ?1').bind(t.email).first<{ id: string }>();
            return { id: existing?.id ?? newId(), name: t.email };
          },
          afterVerification: async ({ user, context }) => {
            console.log('HOOK afterVerification start');
            try {
              await afterRegistration(env, user, context);
            } catch (e) {
              console.log('HOOK afterVerification threw:', String((e as Error).message).slice(0, 300));
              throw e;
            }
            console.log('HOOK afterVerification done');
          },
        },
        authentication: {
          afterVerification: async ({ verification }) => {
            void verification; // the user is not in scope here: sign-in audit is written in the wrapper below
          },
        },
      }),
    ],
  });
}

type SessionLookup = { user: { id: string } } | null;
async function sessionOf(env: SpikeEnv, headers: Headers): Promise<SessionLookup> {
  return (await makeAuth(env).api.getSession({ headers })) as SessionLookup;
}

export function createSpikeApp(): Hono<{ Bindings: SpikeEnv }> {
  const app = new Hono<{ Bindings: SpikeEnv }>();
  app.use('*', requestLog);
  app.use('*', securityHeaders);
  app.use('/api/auth/*', writeGuards);
  // Spike diagnostics: the library's 500s carry no detail otherwise. Message only, never the request.
  app.onError((err, c) => {
    console.log('SPIKE-ERROR', c.req.path, String(err.message).slice(0, 400));
    return c.json({ error: 'internal' }, 500);
  });

  app.post('/api/auth/invite', async () => new Response('not here', { status: 404 })); // placeholder to show our routes sit beside the library's

  // Sign-in and sign-out audit: the library owns these routes, so we wrap them.
  app.post('/api/auth/sign-out', async (c, next) => {
    const s = await sessionOf(c.env, c.req.raw.headers);
    await next();
    if (s && c.res.status === 200) await auditPerson(c.env.DB, s.user.id, 'staff.signout');
  });
  app.post('/api/auth/passkey/verify-authentication', async (c, next) => {
    await next();
    if (c.res.status === 200) {
      const cookie = c.res.headers.get('set-cookie');
      if (cookie) {
        const s = await sessionOf(c.env, new Headers({ cookie: cookie.split(';')[0] ?? '' }));
        if (s) await auditPerson(c.env.DB, s.user.id, 'staff.signin');
      }
    }
  });
  app.on(['GET', 'POST'], '/api/auth/*', (c) => makeAuth(c.env).handler(c.req.raw));

  // ---- our own routes beside the library's: invite and recover (same as Route 3) ----
  app.post('/ours/invite', async (c) => {
    const s = await sessionOf(c.env, c.req.raw.headers);
    if (!s) return c.json({ error: 'unauthorized' }, 401);
    const body = (await c.req.json().catch(() => null)) as { slug?: string; email?: string; role?: string } | null;
    if (!body || !emailOk(body.email) || typeof body.slug !== 'string' || (body.role !== 'editor' && body.role !== 'admin')) return c.json({ error: 'bad_request' }, 400);
    const access = await (await import('../../../../worker/repositories/index.ts')).staff.roleAtSlug(c.env.DB, s.user.id, body.slug);
    if (!access || access.role !== 'admin') return c.json({ error: 'forbidden' }, 403);
    const token = randomToken();
    await c.env.DB.prepare(`INSERT INTO staff_tokens (token_hash, purpose, email, property_id, role, created_by, created_at, expires_at) VALUES (?1, 'invite', ?2, ?3, ?4, ?5, ?6, ?7)`)
      .bind(await hmacHex(c.env.SESSION_PEPPER, token), body.email.toLowerCase(), access.propertyId, body.role, s.user.id, now(), now() + TOKEN_SECONDS).run();
    await c.env.DB.prepare('INSERT INTO email_capture (to_email, subject, body, created_at) VALUES (?1, ?2, ?3, ?4)').bind(body.email, 'You are invited', `${c.env.ORIGIN}/#invite=${token}`, now()).run();
    await audit.append(createTenantContext(c.env.DB, access), { actorKind: 'staff', actorStaffId: s.user.id, action: 'staff.invite.created', targetType: 'invite', targetId: null }, now());
    return c.json({ ok: true });
  });

  app.post('/ours/recover', async (c) => {
    const body = (await c.req.json().catch(() => null)) as { email?: string } | null;
    if (body && emailOk(body.email)) {
      const user = await c.env.DB.prepare('SELECT id FROM staff_users WHERE email = ?1 AND disabled_at IS NULL').bind(body.email.toLowerCase()).first<{ id: string }>();
      if (user) {
        const token = randomToken();
        await c.env.DB.prepare(`INSERT INTO staff_tokens (token_hash, purpose, email, created_at, expires_at) VALUES (?1, 'recovery', ?2, ?3, ?4)`).bind(await hmacHex(c.env.SESSION_PEPPER, token), body.email.toLowerCase(), now(), now() + TOKEN_SECONDS).run();
        await c.env.DB.prepare('INSERT INTO email_capture (to_email, subject, body, created_at) VALUES (?1, ?2, ?3, ?4)').bind(body.email, 'Recover your access', `${c.env.ORIGIN}/#recover=${token}`, now()).run();
        await auditPerson(c.env.DB, user.id, 'staff.recovery.requested');
      }
    }
    return c.json({ ok: true });
  });

  // ---- the seam ----
  const staffRoutes = new Hono<{ Bindings: SpikeEnv }>();
  staffRoutes.use('*', staffTenant(async (c) => {
    const s = await sessionOf(c.env as SpikeEnv, c.req.raw.headers);
    return s ? { staffUserId: s.user.id } : null;
  }) as never);
  staffRoutes.get('/me', (c) => c.json({ role: (c as unknown as { get: (k: string) => { role: string } }).get('staff').role }));
  app.route('/staff/p/:slug', staffRoutes);

  // ---- test support ----
  app.use('/__test/*', async (c, next) => (c.env.SPIKE_TEST === 'on' ? next() : c.json({ error: 'not_found' }, 404)));
  app.post('/__test/migrate', async (c) => {
    const { toBeCreated, toBeAdded, runMigrations } = await getMigrations(makeAuth(c.env).options);
    await runMigrations();
    return c.json({ created: toBeCreated.map((t) => t.table), added: toBeAdded.map((t) => t.table) });
  });
  app.post('/__test/seed', async (c) => {
    const out: Record<string, string> = {};
    for (const slug of ['spike-a', 'spike-b']) {
      const id = newId();
      await c.env.DB.prepare("INSERT INTO properties (id, slug, name_en, name_fr, timezone, address, languages, created_at) VALUES (?1, ?2, ?3, ?3, 'America/Vancouver', '', 'en,fr', 1)").bind(id, slug, slug).run();
      out[slug] = id;
    }
    return c.json(out);
  });
  app.post('/__test/operator-invite', async (c) => {
    const b = (await c.req.json()) as { email: string; slug: string; role: 'editor' | 'admin' };
    const p = await c.env.DB.prepare('SELECT id FROM properties WHERE slug = ?1').bind(b.slug).first<{ id: string }>();
    const token = randomToken();
    await c.env.DB.prepare(`INSERT INTO staff_tokens (token_hash, purpose, email, property_id, role, created_at, expires_at) VALUES (?1, 'invite', ?2, ?3, ?4, ?5, ?6)`).bind(await hmacHex(c.env.SESSION_PEPPER, token), b.email.toLowerCase(), p?.id, b.role, now(), now() + TOKEN_SECONDS).run();
    return c.json({ token });
  });
  app.post('/__test/sql', async (c) => {
    const b = (await c.req.json()) as { sql: string; params?: unknown[] };
    return c.json((await c.env.DB.prepare(b.sql).bind(...(b.params ?? [])).all()).results);
  });
  app.get('/__test/capture', async (c) => c.json((await c.env.DB.prepare('SELECT to_email, subject, body FROM email_capture ORDER BY id').all()).results));
  app.get('/__test/audit', async (c) => c.json((await c.env.DB.prepare('SELECT p.slug, a.action FROM audit_log a JOIN properties p ON p.id = a.property_id ORDER BY a.created_at, a.rowid').all()).results));

  app.all('*', (c) => c.env.ASSETS.fetch(c.req.raw));
  return app;
}

const app = createSpikeApp();
export default { fetch: (request: Request, env: SpikeEnv, ctx: ExecutionContext) => app.fetch(request, env, ctx) };
