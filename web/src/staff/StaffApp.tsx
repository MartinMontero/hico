import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import type { StaffKey } from '../../../shared/i18n/staff-en.ts';
import { pick } from '../../../shared/i18n/index.ts';
import { useUi } from '../context.tsx';
import { Dialog } from '../Dialog.tsx';
import { Link, markMoved, navigate } from '../router.tsx';
import { AUTH, staffGet, staffPost, type Me } from './api.ts';
import { PropertyConsole } from './Console.tsx';
import { register, signIn, type Outcome } from './passkeys.ts';
import { useStaffT } from './t.ts';
import { Heading } from './ui.tsx';

export { useStaffT };

/** The signed-in person, or null when signed out. `reload` re-reads it after a sign-in or sign-out. */
function useMe() {
  const [state, setState] = useState<{ status: 'loading' } | { status: 'ready'; me: Me | null } | { status: 'error'; code: string }>({ status: 'loading' });
  const reload = useCallback(async () => {
    const res = await staffGet<Me>(`${AUTH}/me`);
    if (res.status === 200 && res.data) setState({ status: 'ready', me: res.data });
    else if (res.status === 401) setState({ status: 'ready', me: null });
    else setState({ status: 'error', code: res.status === 503 ? 'not_configured' : 'failed' });
  }, []);
  useEffect(() => {
    void reload();
  }, [reload]);
  return { state, reload };
}
function outcomeText(t: ReturnType<typeof useStaffT>, outcome: Outcome, prefix: 'signin' | 'accept'): string {
  if (outcome === 'cancelled') return t(`${prefix}.cancelled` as StaffKey);
  if (outcome === 'rate_limited') return t('staff.rateLimited');
  if (outcome === 'not_configured') return t('staff.notConfigured');
  if (outcome === 'invalid_link') return t('accept.invalid');
  if (outcome === 'existing_user') return t('accept.existing');
  return t(`${prefix}.failed` as StaffKey);
}

function SignIn({ onDone }: { onDone: () => void }) {
  const t = useStaffT();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const go = async () => {
    setBusy(true);
    setMessage('');
    const outcome = await signIn();
    setBusy(false);
    if (outcome === 'ok') onDone();
    else setMessage(outcomeText(t, outcome, 'signin'));
  };
  return (
    <main id="main">
      <Heading>{t('signin.title')}</Heading>
      <p>{t('signin.intro')}</p>
      <button type="button" class="btn btn-primary" onClick={go} disabled={busy}>
        {busy ? t('signin.working') : t('signin.button')}
      </button>
      {message ? (
        <p class="error" role="alert">
          {message}
        </p>
      ) : null}
      <p class="muted">{t('signin.lost')}</p>
    </main>
  );
}

interface LinkInfo {
  purpose: 'invite' | 'recovery';
  displayName: string;
  existingUser: boolean;
}

function readFragment(): { kind: 'invite' | 'recover'; token: string } | null {
  const m = /^#(invite|recover)=([A-Za-z0-9_-]{43})$/.exec(window.location.hash);
  return m ? { kind: m[1] as 'invite' | 'recover', token: m[2] as string } : null;
}

/** The page a handed-over link opens. The token stays in the fragment (never sent in a URL) and leaves the address bar when used. */
function Accept({ me, reload }: { me: Me | null; reload: () => Promise<void> }) {
  const t = useStaffT();
  const { toast } = useUi();
  const [link, setLink] = useState(readFragment);
  const [info, setInfo] = useState<LinkInfo | 'invalid' | 'loading'>(link ? 'loading' : 'invalid');

  // The same page can be opened again with another link (a hash-only change does not reload it).
  useEffect(() => {
    const onHash = () => {
      const next = readFragment();
      setLink(next);
      setInfo(next ? 'loading' : 'invalid');
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  const [label, setLabel] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!link) return;
    void staffPost<LinkInfo>(`${AUTH}/link/inspect`, { token: link.token }).then((res) => setInfo(res.data ?? 'invalid'));
  }, [link]);

  const finish = async () => {
    history.replaceState(null, '', window.location.pathname);
    await reload();
    navigate('/staff');
  };

  const create = async (event: Event) => {
    event.preventDefault();
    if (!link) return;
    setBusy(true);
    setMessage('');
    const outcome = await register(label.trim() || 'Passkey', link.token);
    setBusy(false);
    if (outcome === 'ok') await finish();
    else setMessage(outcomeText(t, outcome, 'accept'));
  };

  const join = async () => {
    if (!link) return;
    setBusy(true);
    const res = await staffPost<{ slug: string | null }>(`${AUTH}/link/accept`, { token: link.token });
    setBusy(false);
    if (res.status === 200) {
      toast(t('accept.joined'));
      await finish();
    } else setMessage(t('accept.wrongPerson'));
  };

  return (
    <main id="main">
      <Heading>{t('accept.title')}</Heading>
      {!link ? <p>{t('accept.none')}</p> : null}
      {info === 'loading' ? <output class="muted">{t('staff.loading')}</output> : null}
      {link && info === 'invalid' ? <p class="error">{t('accept.invalid')}</p> : null}
      {link && typeof info === 'object' && info.existingUser ? (
        <>
          <p>{t('accept.existing')}</p>
          {me ? (
            <button type="button" class="btn btn-primary" onClick={join} disabled={busy}>
              {t('accept.join')}
            </button>
          ) : (
            <Link class="btn btn-primary" href="/staff">
              {t('signin.button')}
            </Link>
          )}
        </>
      ) : null}
      {link && typeof info === 'object' && !info.existingUser ? (
        <form onSubmit={create}>
          <p>{t(info.purpose === 'invite' ? 'accept.invite' : 'accept.recovery', { name: info.displayName })}</p>
          <div class="field">
            <label for="passkey-label">{t('accept.label')}</label>
            <input id="passkey-label" name="label" type="text" maxLength={80} autoComplete="off" value={label} onInput={(e) => setLabel((e.target as HTMLInputElement).value)} aria-describedby="passkey-label-help" />
            <p id="passkey-label-help" class="muted">
              {t('accept.labelHelp')}
            </p>
          </div>
          <button type="submit" class="btn btn-primary" disabled={busy}>
            {busy ? t('accept.working') : t('accept.create')}
          </button>
        </form>
      ) : null}
      {message ? (
        <p class="error" role="alert">
          {message}
        </p>
      ) : null}
    </main>
  );
}

function Home({ me, reload }: { me: Me; reload: () => Promise<void> }) {
  const t = useStaffT();
  const { lang } = useUi();
  return (
    <main id="main">
      <Heading>{t('home.title')}</Heading>
      <p>{t('account.name', { name: me.displayName || me.email })}</p>
      {me.passkeys < 2 ? (
        <p class="band" role="note">
          {t('home.nudge')}
        </p>
      ) : null}
      {me.properties.length === 0 ? (
        <p class="state">{t('home.none')}</p>
      ) : (
        <>
          <p>{t('home.choose')}</p>
          <ul class="cards">
            {me.properties.map((p) => (
              <li key={p.slug} class="card">
                <Link class="card-link" href={`/staff/p/${p.slug}`}>
                  {pick(p.name, lang)}
                </Link>
                <p class="muted">{t(p.role === 'admin' ? 'home.role.admin' : 'home.role.editor')}</p>
              </li>
            ))}
          </ul>
        </>
      )}
      <p class="actions">
        <Link class="btn" href="/staff/account">
          {t('home.account')}
        </Link>
        <button
          type="button"
          class="btn"
          onClick={async () => {
            markMoved(); // the sign-in screen replaces this one: its heading takes focus
            await staffPost(`${AUTH}/logout`);
            await reload();
          }}
        >
          {t('home.signout')}
        </button>
      </p>
    </main>
  );
}

interface SessionRow {
  handle: string;
  createdAt: number;
  current: boolean;
}
interface PasskeyRow {
  id: string;
  label: string;
  createdAt: number;
  lastUsedAt: number | null;
}

function when(epoch: number, lang: string): string {
  return new Intl.DateTimeFormat(lang, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(epoch * 1000));
}

function Account({ me, reload }: { me: Me; reload: () => Promise<void> }) {
  const t = useStaffT();
  const { lang, toast } = useUi();
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [passkeys, setPasskeys] = useState<PasskeyRow[]>([]);
  const [label, setLabel] = useState('');
  const [message, setMessage] = useState('');
  const [confirm, setConfirm] = useState<null | { kind: 'all' } | { kind: 'remove'; id: string }>(null);
  const opener = useRef<HTMLElement | null>(null);

  const refresh = useCallback(async () => {
    const [s, p] = await Promise.all([staffGet<SessionRow[]>(`${AUTH}/sessions`), staffGet<PasskeyRow[]>(`${AUTH}/credentials`)]);
    setSessions(s.data ?? []);
    setPasskeys(p.data ?? []);
  }, []);
  useEffect(() => {
    void refresh();
  }, [refresh]);

  const add = async (event: Event) => {
    event.preventDefault();
    setMessage('');
    const outcome = await register(label.trim() || 'Passkey');
    if (outcome === 'ok') {
      setLabel('');
      toast(t('account.added'));
      await refresh();
      await reload();
    } else setMessage(outcomeText(t, outcome, 'accept'));
  };

  const doConfirmed = async () => {
    const what = confirm;
    setConfirm(null);
    if (!what) return;
    if (what.kind === 'all') {
      markMoved();
      await staffPost(`${AUTH}/logout-all`);
      await reload();
      navigate('/staff');
    } else {
      const res = await staffPost(`${AUTH}/credentials/revoke`, { id: what.id });
      if (res.status === 409) setMessage(t('account.lastPasskey'));
      else toast(t('account.removed'));
      await refresh();
      await reload();
    }
  };

  return (
    <main id="main">
      <Heading>{t('account.title')}</Heading>
      <p>{t('account.name', { name: me.displayName || me.email })}</p>

      <section aria-labelledby="sessions-h">
        <h2 id="sessions-h">{t('account.sessions')}</h2>
        <p class="muted">{t('account.sessionsHelp')}</p>
        <ul class="cards">
          {sessions.map((s) => (
            <li key={s.handle} class="card">
              <p>
                {s.current ? <strong>{t('account.thisSession')}. </strong> : null}
                {t('account.started', { when: when(s.createdAt, lang) })}
              </p>
              {!s.current ? (
                <button
                  type="button"
                  class="btn"
                  onClick={async () => {
                    await staffPost(`${AUTH}/sessions/revoke`, { handle: s.handle });
                    toast(t('account.sessionEnded'));
                    await refresh();
                  }}
                >
                  {t('account.endSession')}
                </button>
              ) : null}
            </li>
          ))}
        </ul>
        <button
          type="button"
          class="btn"
          onClick={(e) => {
            opener.current = e.currentTarget;
            setConfirm({ kind: 'all' });
          }}
        >
          {t('account.signoutAll')}
        </button>
      </section>

      <section aria-labelledby="passkeys-h">
        <h2 id="passkeys-h">{t('account.passkeys')}</h2>
        <ul class="cards">
          {passkeys.map((p) => (
            <li key={p.id} class="card">
              <p>
                <strong>{p.label || '—'}</strong>
              </p>
              <p class="muted">{p.lastUsedAt ? t('account.lastUsed', { when: when(p.lastUsedAt, lang) }) : t('account.neverUsed')}</p>
              <button
                type="button"
                class="btn"
                onClick={(e) => {
                  opener.current = e.currentTarget;
                  setConfirm({ kind: 'remove', id: p.id });
                }}
              >
                {t('account.revoke')}
                <span class="sr-only"> {p.label}</span>
              </button>
            </li>
          ))}
        </ul>
        <form onSubmit={add}>
          <div class="field">
            <label for="new-passkey-label">{t('accept.label')}</label>
            <input id="new-passkey-label" type="text" maxLength={80} autoComplete="off" value={label} onInput={(e) => setLabel((e.target as HTMLInputElement).value)} aria-describedby="add-help" />
            <p id="add-help" class="muted">
              {t('account.addHelp')}
            </p>
          </div>
          <button type="submit" class="btn btn-primary">
            {t('account.addPasskey')}
          </button>
        </form>
        {message ? (
          <p class="error" role="alert">
            {message}
          </p>
        ) : null}
      </section>

      <p>
        <Link class="btn" href="/staff">
          {t('staff.back')}
        </Link>
      </p>

      <Dialog open={confirm !== null} onClose={() => setConfirm(null)} title={confirm?.kind === 'all' ? t('account.signoutAll') : t('account.revoke')} returnFocusTo={opener.current}>
        <p>{confirm?.kind === 'all' ? t('account.confirmSignoutAll') : t('account.confirmRemove')}</p>
        <p class="actions">
          <button type="button" class="btn btn-primary" onClick={doConfirmed}>
            {t('account.confirmYes')}
          </button>
          <button type="button" class="btn" onClick={() => setConfirm(null)}>
            {t('account.confirmNo')}
          </button>
        </p>
      </Dialog>
    </main>
  );
}

/** The staff console: loaded only when a guest-facing path starts with /staff, so guests never download it. */
export default function StaffApp({ path }: { path: string }) {
  const t = useStaffT();
  const { state, reload } = useMe();

  if (state.status === 'loading') {
    return (
      <main id="main">
        <output class="muted">{t('staff.loading')}</output>
      </main>
    );
  }
  if (state.status === 'error') {
    return (
      <main id="main">
        <Heading>{t('signin.title')}</Heading>
        <p class="error" role="alert">
          {state.code === 'not_configured' ? t('staff.notConfigured') : t('staff.error')}
        </p>
        <button type="button" class="btn" onClick={() => void reload()}>
          {t('staff.retry')}
        </button>
      </main>
    );
  }
  const me = state.me;
  if (path.startsWith('/staff/accept')) return <Accept me={me} reload={reload} />;
  if (!me) return <SignIn onDone={() => void reload()} />;
  if (path === '/staff/account') return <Account me={me} reload={reload} />;
  if (path.startsWith('/staff/p/')) return <PropertyConsole path={path} me={me} onSignedOut={() => void reload()} />;
  return <Home me={me} reload={reload} />;
}
