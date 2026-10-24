import { startAuthentication, startRegistration } from '@simplewebauthn/browser';

// SPIKE client: the smallest page that uses the real browser helper. Tests drive window.spikeAuth.
async function post(path: string, body: unknown = {}): Promise<{ status: number; json: unknown }> {
  const res = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  return { status: res.status, json: await res.json().catch(() => null) };
}
const status = document.getElementById('status') as HTMLElement;
const say = (text: string) => {
  status.textContent = text;
};

function fragmentToken(): { kind: 'invite' | 'recover'; token: string } | null {
  const m = /^#(invite|recover)=([\w-]+)$/.exec(window.location.hash);
  return m ? { kind: m[1] as 'invite' | 'recover', token: m[2] as string } : null;
}

async function register(label = 'spike passkey', useFragment = true): Promise<string> {
  const frag = useFragment ? fragmentToken() : null;
  const opts = (await post('/auth/register/options', frag ? { token: frag.token } : {})) as { status: number; json: { challengeId: string; options: never } };
  if (opts.status !== 200) return `options-${opts.status}`;
  const response = await startRegistration({ optionsJSON: opts.json.options });
  const done = await post('/auth/register/verify', { challengeId: opts.json.challengeId, response, label });
  if (frag) history.replaceState(null, '', window.location.pathname); // the token leaves the address bar
  return done.status === 200 ? 'registered' : `register-${done.status}`;
}

async function login(): Promise<string> {
  const opts = (await post('/auth/login/options')) as { status: number; json: { challengeId: string; options: never } };
  const response = await startAuthentication({ optionsJSON: opts.json.options });
  const done = await post('/auth/login/verify', { challengeId: opts.json.challengeId, response });
  return done.status === 200 ? 'signed-in' : `sign-in-${done.status}`;
}

/** The two halves of a sign-in, so a test can act between them (for example to revoke a credential). */
async function loginParts(): Promise<{ challengeId: string; response: unknown }> {
  const opts = (await post('/auth/login/options')) as { json: { challengeId: string; options: never } };
  return { challengeId: opts.json.challengeId, response: await startAuthentication({ optionsJSON: opts.json.options }) };
}

(window as unknown as { spikeAuth: unknown }).spikeAuth = { register, login, loginParts, post, fragmentToken };

document.getElementById('register')?.addEventListener('click', () => void register().then(say));
document.getElementById('login')?.addEventListener('click', () => void login().then(say));
document.getElementById('logout')?.addEventListener('click', () => void post('/auth/logout').then(() => say('signed-out')));
