// SPIKE (Phase 1b-1, Route 1): the WORKER HALF of Cloudflare Access, against a local stand-in.
// Cloudflare Access itself cannot be run here (it needs a login, a Zero Trust organisation and a zone).
// What Cloudflare documents the Worker must do (page read 2026-10-24, "Validate JWTs"):
//   - read the Cf-Access-Jwt-Assertion header (not the cookie: "not guaranteed to be passed"),
//   - fetch the team's keys from https://<team>.cloudflareaccess.com/cdn-cgi/access/certs and select by kid,
//   - verify RS256, the issuer (the team domain), the audience (the application's AUD tag) and expiry,
//   - read the person's email from the payload's `email` claim.
// This file does exactly that with `jose` and an injectable key set, so the checks are testable.
import { createLocalJWKSet, errors, jwtVerify, type JSONWebKeySet } from 'jose';

export interface AccessConfig {
  /** e.g. https://hico-demo.cloudflareaccess.com (the issuer) */
  teamDomain: string;
  /** the application's AUD tag */
  aud: string;
  /** returns the team's published keys; in production this is a cached fetch of /cdn-cgi/access/certs */
  getKeys: () => Promise<JSONWebKeySet>;
}

export type AccessResult = { ok: true; email: string } | { ok: false; reason: string };

export async function verifyAccessRequest(request: Request, config: AccessConfig): Promise<AccessResult> {
  const token = request.headers.get('Cf-Access-Jwt-Assertion');
  if (!token) return { ok: false, reason: 'missing_header' };
  try {
    const keys = createLocalJWKSet(await config.getKeys());
    const { payload } = await jwtVerify(token, keys, {
      issuer: config.teamDomain,
      audience: config.aud,
      algorithms: ['RS256'], // never "none", never HS256 with a public key as the secret
      clockTolerance: 5,
    });
    const email = typeof payload['email'] === 'string' ? payload['email'].toLowerCase() : '';
    if (!email) return { ok: false, reason: 'no_email_claim' };
    return { ok: true, email };
  } catch (e) {
    if (e instanceof errors.JWTExpired) return { ok: false, reason: 'expired' };
    if (e instanceof errors.JWTClaimValidationFailed) return { ok: false, reason: `claim_${e.claim}` };
    if (e instanceof errors.JWKSNoMatchingKey) return { ok: false, reason: 'unknown_key' };
    if (e instanceof errors.JWSSignatureVerificationFailed) return { ok: false, reason: 'bad_signature' };
    return { ok: false, reason: 'invalid' };
  }
}

/**
 * The mapping Access does NOT do for us: an email it vouches for becomes a staff identity only if
 * that email is a staff_users row, and the property role is still read from staff_memberships on every request.
 */
export async function resolveStaff(
  request: Request,
  config: AccessConfig,
  findStaffByEmail: (email: string) => Promise<{ staffUserId: string } | null>,
): Promise<{ staffUserId: string; email: string } | null> {
  const result = await verifyAccessRequest(request, config);
  if (!result.ok) return null;
  const person = await findStaffByEmail(result.email);
  return person ? { staffUserId: person.staffUserId, email: result.email } : null;
}
