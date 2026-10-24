import { createAuthClient } from 'better-auth/client';
import { passkeyClient } from '@better-auth/passkey/client';

// SPIKE client for Route 2: the library's own client plus the passkey plugin.
const authClient = createAuthClient({ plugins: [passkeyClient()] });
const status = document.getElementById('status') as HTMLElement;
const say = (t: string) => {
  status.textContent = t;
};

function fragmentToken(): string | null {
  const m = /^#(?:invite|recover)=([\w-]+)$/.exec(window.location.hash);
  return m ? (m[1] as string) : null;
}

async function register(name = 'spike passkey'): Promise<string> {
  const context = fragmentToken() ?? undefined;
  const res = await authClient.passkey.addPasskey({ name, context, createSession: true });
  if (context) history.replaceState(null, '', window.location.pathname);
  return res?.error ? `register-${res.error.status ?? 'error'}` : 'registered';
}
async function login(): Promise<string> {
  const res = await authClient.signIn.passkey();
  return res?.error ? `sign-in-${res.error.status ?? 'error'}` : 'signed-in';
}
async function logout(): Promise<string> {
  await authClient.signOut();
  return 'signed-out';
}
(window as unknown as { spikeBA: unknown }).spikeBA = { register, login, logout, authClient };
document.getElementById('register')?.addEventListener('click', () => void register().then(say));
document.getElementById('login')?.addEventListener('click', () => void login().then(say));
document.getElementById('logout')?.addEventListener('click', () => void logout().then(say));
