import { startAuthentication, startRegistration } from '@simplewebauthn/browser';
import { AUTH, staffPost } from './api.ts';

// The browser half of the WebAuthn ceremonies. Each function returns a short code the screens turn into text.
export type Outcome = 'ok' | 'cancelled' | 'failed' | 'rate_limited' | 'not_configured' | 'existing_user' | 'invalid_link';

function fromError(e: unknown): Outcome {
  const name = e instanceof Error ? e.name : '';
  return name === 'NotAllowedError' || name === 'AbortError' ? 'cancelled' : 'failed';
}

function fromStatus(status: number, error: string | null): Outcome {
  if (status === 429) return 'rate_limited';
  if (status === 503) return 'not_configured';
  if (error === 'existing_user') return 'existing_user';
  if (error === 'invalid_link') return 'invalid_link';
  return 'failed';
}

interface Challenge {
  challengeId: string;
  options: Parameters<typeof startAuthentication>[0]['optionsJSON'];
}

export async function signIn(): Promise<Outcome> {
  const opts = await staffPost<Challenge>(`${AUTH}/login/options`);
  if (!opts.data) return fromStatus(opts.status, opts.error);
  try {
    const response = await startAuthentication({ optionsJSON: opts.data.options });
    const done = await staffPost(`${AUTH}/login/verify`, { challengeId: opts.data.challengeId, response });
    return done.status === 200 ? 'ok' : fromStatus(done.status, done.error);
  } catch (e) {
    return fromError(e);
  }
}

/** Register a passkey with an invite or recovery link (token) or, signed in, add another one (no token). */
export async function register(label: string, token?: string): Promise<Outcome> {
  const opts = await staffPost<{ challengeId: string; options: Parameters<typeof startRegistration>[0]['optionsJSON'] }>(`${AUTH}/register/options`, token ? { token } : {});
  if (!opts.data) return fromStatus(opts.status, opts.error);
  try {
    const response = await startRegistration({ optionsJSON: opts.data.options });
    const done = await staffPost(`${AUTH}/register/verify`, { challengeId: opts.data.challengeId, response, label });
    return done.status === 200 ? 'ok' : fromStatus(done.status, done.error);
  } catch (e) {
    return fromError(e);
  }
}
