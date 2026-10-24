import { useEffect, useState } from 'preact/hooks';
import { LIMITS } from '../../../shared/limits.ts';
import { pick } from '../../../shared/i18n/index.ts';
import { staffEn, type StaffKey } from '../../../shared/i18n/staff-en.ts';
import { RINGS } from '../../../shared/staff-content-schemas.ts';
import type { StaffAuditEntry, StaffCode, StaffZone } from '../../../shared/types.ts';
import { useUi } from '../context.tsx';
import { Dialog } from '../Dialog.tsx';
import type { Api, PropertyContext } from './data.ts';
import { useResource } from './data.ts';
import { Gate } from './Content.tsx';
import { QrCode } from './qr.tsx';
import { formatMoment, useStaffT } from './t.ts';
import { Confirm, EditDialog, errorText, focusHeading, useOpener, type FieldSpec, type Values } from './ui.tsx';

interface Props {
  api: Api;
  ctx: PropertyContext;
}

// ---- Zones ----------------------------------------------------------------------------------------------------

const zoneToForm = (z: StaffZone): Values => ({ labelEn: z.label.en, labelFr: z.label.fr, ring: z.ring });

export function Zones({ api, ctx }: Props) {
  const t = useStaffT();
  const { lang, toast } = useUi();
  const list = useResource<StaffZone[]>(api, '/zones');
  const [dialog, setDialog] = useState<null | { kind: 'edit'; zone: StaffZone | null } | { kind: 'delete'; zone: StaffZone }>(null);
  const [message, setMessage] = useState('');
  const opener = useOpener();
  const admin = ctx.role === 'admin';
  const specs: FieldSpec[] = [
    { key: 'labelEn', label: 'f.labelEn', kind: 'text', max: LIMITS.label },
    { key: 'labelFr', label: 'f.labelFr', kind: 'text', max: LIMITS.label, help: 'f.frHelp' },
    { key: 'ring', label: 'f.ring', kind: 'select', options: RINGS.map((r) => ({ value: r, label: t(`ring.${r}`) })) },
  ];
  return (
    <>
      <p>{t('zones.intro')}</p>
      {admin ? (
        <p class="actions">
          <button type="button" class="btn btn-primary" onClick={(e) => { opener.capture(e); setDialog({ kind: 'edit', zone: null }); }}>
            {t('zones.add')}
          </button>
        </p>
      ) : (
        <p class="muted">{t('admin.only')}</p>
      )}
      {message ? <p class="error" role="alert">{message}</p> : null}
      <Gate state={list.state} reload={list.reload}>
        {(items) =>
          items.length === 0 ? (
            <p class="state">{t('zones.empty')}</p>
          ) : (
            <ul class="cards">
              {items.map((z) => (
                <li key={z.id} class="card">
                  <h2 class="card-title">{pick(z.label, lang as 'en' | 'fr') || z.label.en}</h2>
                  <p class="card-meta">
                    {t(`ring.${z.ring}`)}
                    {z.inUse ? ` · ${t('zones.inUse')}` : ''}
                  </p>
                  {admin ? (
                    <p class="actions">
                      <button type="button" class="btn" onClick={(e) => { opener.capture(e); setDialog({ kind: 'edit', zone: z }); }}>
                        {t('act.edit')}<span class="sr-only"> {z.label.en}</span>
                      </button>
                      <button type="button" class="btn" onClick={(e) => { opener.capture(e); setMessage(''); setDialog({ kind: 'delete', zone: z }); }}>
                        {t('act.delete')}<span class="sr-only"> {z.label.en}</span>
                      </button>
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          )
        }
      </Gate>
      {dialog?.kind === 'edit' ? (
        <EditDialog<StaffZone>
          title={dialog.zone ? t('zones.edit') : t('zones.add')}
          specs={specs}
          initial={dialog.zone ? zoneToForm(dialog.zone) : { labelEn: '', labelFr: '', ring: 'in_hostel' }}
          version={dialog.zone?.version ?? null}
          toBody={(v) => ({ labelEn: v['labelEn'], labelFr: v['labelFr'], ring: v['ring'] })}
          toForm={zoneToForm}
          send={(body, version) => (dialog.zone ? api.post(`/zones/${dialog.zone.id}`, { ...(body as object), version }) : api.post('/zones', body))}
          onSaved={() => { setDialog(null); toast(t('toast.saved')); void list.reload(); }}
          onClose={() => setDialog(null)}
          returnFocusTo={opener.ref.current}
        />
      ) : null}
      {dialog?.kind === 'delete' ? (
        <Confirm
          title={t('act.delete')}
          text={t('zones.confirmDelete', { name: dialog.zone.label.en })}
          yes={t('act.delete')}
          returnFocusTo={opener.ref.current}
          onClose={() => setDialog(null)}
          onYes={async () => {
            const z = dialog.zone;
            setDialog(null);
            const res = await api.post(`/zones/${z.id}/delete`, { version: z.version });
            if (res.status === 200) toast(t('toast.deleted'));
            else setMessage(errorText(t, res.status, res.error));
            await list.reload();
            focusHeading();
          }}
        />
      ) : null}
    </>
  );
}

// ---- QR labels (Stage 0: labelled links only) -----------------------------------------------------------------

export function Codes({ api, ctx }: Props) {
  const t = useStaffT();
  const { lang, toast } = useUi();
  const list = useResource<StaffCode[]>(api, '/codes');
  const [label, setLabel] = useState('');
  const [message, setMessage] = useState('');
  const [show, setShow] = useState<StaffCode | null>(null);
  const [retire, setRetire] = useState<StaffCode | null>(null);
  const opener = useOpener();
  const admin = ctx.role === 'admin';
  const linkFor = (c: StaffCode) => `${window.location.origin}/p/${ctx.slug}#l=${c.label}`;

  const add = async (event: Event) => {
    event.preventDefault();
    setMessage('');
    const res = await api.post('/codes', { label });
    if (res.status === 200) {
      setLabel('');
      toast(t('codes.added'));
    } else setMessage(res.status === 409 ? t('codes.exists') : res.status === 400 ? t('codes.badLabel') : errorText(t, res.status, res.error));
    await list.reload();
  };

  return (
    <>
      <p>{t('codes.intro')}</p>
      {admin ? (
        <form onSubmit={add}>
          <div class="field">
            <label for="code-label">{t('codes.label')}</label>
            <input id="code-label" type="text" maxLength={40} autoComplete="off" value={label} aria-describedby="code-label-help" onInput={(e) => setLabel((e.target as HTMLInputElement).value)} />
            <p id="code-label-help" class="muted">{t('codes.labelHelp')}</p>
          </div>
          <button type="submit" class="btn btn-primary" disabled={label.trim() === ''}>
            {t('codes.add')}
          </button>
        </form>
      ) : (
        <p class="muted">{t('admin.only')}</p>
      )}
      {message ? <p class="error" role="alert">{message}</p> : null}
      <Gate state={list.state} reload={list.reload}>
        {(items) =>
          items.length === 0 ? (
            <p class="state">{t('codes.empty')}</p>
          ) : (
            <ul class="cards">
              {items.map((c) => (
                <li key={c.id} class="card">
                  <h2 class="card-title">{c.label}</h2>
                  <p class="card-meta">
                    {c.retiredAt ? t('codes.retired', { date: formatMoment(c.retiredAt, lang, ctx.timezone) }) : t('codes.active')}
                  </p>
                  {!c.retiredAt ? (
                    <p class="actions">
                      <button type="button" class="btn" onClick={(e) => { opener.capture(e); setShow(c); }}>
                        {t('codes.show')}<span class="sr-only"> {c.label}</span>
                      </button>
                      {admin ? (
                        <button type="button" class="btn" onClick={(e) => { opener.capture(e); setRetire(c); }}>
                          {t('codes.retire')}<span class="sr-only"> {c.label}</span>
                        </button>
                      ) : null}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          )
        }
      </Gate>
      <p class="muted">{t('codes.stage2')}</p>
      {show ? (
        <Dialog open onClose={() => setShow(null)} title={t('codes.qrTitle', { label: show.label })} returnFocusTo={opener.ref.current}>
          <div class="qr-sheet">
            <QrCode text={linkFor(show)} label={t('codes.qrAlt', { label: show.label })} />
            <p class="qr-label">{show.label}</p>
            <p class="muted qr-link">{linkFor(show)}</p>
          </div>
          <p class="actions no-print">
            <button type="button" class="btn btn-primary" onClick={() => window.print()}>
              {t('codes.print')}
            </button>
            <button type="button" class="btn" onClick={() => setShow(null)}>
              {t('form.close')}
            </button>
          </p>
        </Dialog>
      ) : null}
      {retire ? (
        <Confirm
          title={t('codes.retire')}
          text={t('codes.confirmRetire', { label: retire.label })}
          yes={t('codes.retire')}
          returnFocusTo={opener.ref.current}
          onClose={() => setRetire(null)}
          onYes={async () => {
            const c = retire;
            setRetire(null);
            const res = await api.post(`/codes/${c.id}/retire`);
            if (res.status === 200) toast(t('codes.retiredToast'));
            else setMessage(errorText(t, res.status, res.error));
            await list.reload();
            focusHeading();
          }}
        />
      ) : null}
    </>
  );
}

// ---- Feature switches -----------------------------------------------------------------------------------------

export function Switches({ api, ctx }: Props) {
  const t = useStaffT();
  const { toast } = useUi();
  const list = useResource<Record<'common_room' | 'connect', boolean>>(api, '/features');
  const [message, setMessage] = useState('');
  const admin = ctx.role === 'admin';
  return (
    <>
      <p>{t('sw.intro')}</p>
      {admin ? null : <p class="muted">{t('admin.only')}</p>}
      {message ? <p class="error" role="alert">{message}</p> : null}
      <Gate state={list.state} reload={list.reload}>
        {(flags) => (
          <ul class="cards">
            {(['common_room', 'connect'] as const).map((name) => (
              <li key={name} class="card">
                <label class="radio" for={`sw-${name}`}>
                  <input
                    id={`sw-${name}`}
                    type="checkbox"
                    checked={flags[name]}
                    disabled={!admin}
                    aria-describedby={`sw-${name}-help`}
                    onChange={async (e) => {
                      const enabled = (e.target as HTMLInputElement).checked;
                      setMessage('');
                      const res = await api.post(`/features/${name}`, { enabled });
                      if (res.status === 200) toast(t(enabled ? 'sw.on' : 'sw.off', { name: t(`sw.${name}`) }));
                      else setMessage(errorText(t, res.status, res.error));
                      await list.reload();
                    }}
                  />
                  <span>{t(`sw.${name}`)}</span>
                </label>
                <p id={`sw-${name}-help`} class="muted">{t(`sw.${name}.help`)}</p>
              </li>
            ))}
          </ul>
        )}
      </Gate>
    </>
  );
}

// ---- People ---------------------------------------------------------------------------------------------------

interface Person {
  id: string;
  displayName: string;
  email: string;
  role: 'editor' | 'admin';
  passkeys: number;
  lastSignInAt: number | null;
}
interface HandOver {
  title: string;
  url: string;
  expiresAt: number;
}

export function People({ api, ctx }: Props) {
  const t = useStaffT();
  const { lang, toast } = useUi();
  const list = useResource<Person[]>(api, '/people');
  const [invite, setInvite] = useState({ displayName: '', email: '', role: 'editor' });
  const [message, setMessage] = useState('');
  const [link, setLink] = useState<HandOver | null>(null);
  const [ask, setAsk] = useState<null | { kind: 'remove' | 'sessions' | 'recovery'; person: Person }>(null);
  const opener = useOpener();

  const origin = window.location.origin;
  const showLink = (title: string, kind: 'invite' | 'recover', token: string, expiresAt: number) => setLink({ title, url: `${origin}/staff/accept#${kind}=${token}`, expiresAt });

  const send = async (event: Event) => {
    event.preventDefault();
    setMessage('');
    const res = await api.post<{ token: string; expiresAt: number }>('/people/invite', invite);
    if (res.status === 200 && res.data) {
      showLink(t('people.linkFor', { name: invite.displayName }), 'invite', res.data.token, res.data.expiresAt);
      setInvite({ displayName: '', email: '', role: 'editor' });
      await list.reload();
    } else setMessage(errorText(t, res.status, res.error));
  };

  const setRole = async (p: Person, role: 'editor' | 'admin') => {
    setMessage('');
    const res = await api.post(`/people/${p.id}/role`, { role });
    if (res.status === 200) toast(t('toast.saved'));
    else setMessage(errorText(t, res.status, res.error));
    await list.reload();
  };

  const doAsk = async () => {
    const a = ask;
    setAsk(null);
    if (!a) return;
    setMessage('');
    if (a.kind === 'remove') {
      const res = await api.post(`/people/${a.person.id}/remove`);
      if (res.status === 200) toast(t('people.removed'));
      else setMessage(errorText(t, res.status, res.error));
      await list.reload();
      focusHeading();
    } else if (a.kind === 'sessions') {
      const res = await api.post(`/people/${a.person.id}/revoke-sessions`);
      if (res.status === 200) toast(t('people.sessionsEnded'));
      else setMessage(errorText(t, res.status, res.error));
    } else {
      const res = await api.post<{ token: string; expiresAt: number }>(`/people/${a.person.id}/recovery`);
      if (res.status === 200 && res.data) showLink(t('people.recoveryFor', { name: a.person.displayName }), 'recover', res.data.token, res.data.expiresAt);
      else setMessage(errorText(t, res.status, res.error));
    }
  };

  return (
    <>
      <p>{t('people.intro')}</p>
      <section aria-labelledby="invite-h">
        <h2 id="invite-h">{t('people.invite')}</h2>
        <form onSubmit={send}>
          <div class="field">
            <label for="inv-name">{t('people.name')}</label>
            <input id="inv-name" type="text" maxLength={LIMITS.person} autoComplete="off" value={invite.displayName} onInput={(e) => setInvite({ ...invite, displayName: (e.target as HTMLInputElement).value })} />
          </div>
          <div class="field">
            <label for="inv-email">{t('people.email')}</label>
            <input id="inv-email" type="email" maxLength={LIMITS.email} autoComplete="off" value={invite.email} aria-describedby="inv-email-help" onInput={(e) => setInvite({ ...invite, email: (e.target as HTMLInputElement).value })} />
            <p id="inv-email-help" class="muted">{t('people.emailHelp')}</p>
          </div>
          <div class="field">
            <label for="inv-role">{t('people.role')}</label>
            <select id="inv-role" value={invite.role} onChange={(e) => setInvite({ ...invite, role: (e.target as HTMLSelectElement).value })}>
              <option value="editor">{t('home.role.editor')}</option>
              <option value="admin">{t('home.role.admin')}</option>
            </select>
          </div>
          <button type="submit" class="btn btn-primary" disabled={invite.displayName.trim() === '' || invite.email.trim() === ''}>
            {t('people.createLink')}
          </button>
        </form>
      </section>
      {message ? <p class="error" role="alert">{message}</p> : null}
      <section aria-labelledby="people-h">
        <h2 id="people-h">{t('people.list')}</h2>
        <Gate state={list.state} reload={list.reload}>
          {(items) => (
            <ul class="cards">
              {items.map((p) => (
                <li key={p.id} class="card">
                  <h3 class="card-title">{p.displayName}</h3>
                  <p class="card-meta">{p.email}</p>
                  <p class="card-meta">
                    {t(p.role === 'admin' ? 'home.role.admin' : 'home.role.editor')} · {t('people.passkeys', { n: String(p.passkeys) })} ·{' '}
                    {p.lastSignInAt ? t('people.lastIn', { when: formatMoment(p.lastSignInAt, lang, ctx.timezone) }) : t('people.neverIn')}
                  </p>
                  <p class="actions">
                    <button type="button" class="btn" onClick={() => void setRole(p, p.role === 'admin' ? 'editor' : 'admin')}>
                      {t(p.role === 'admin' ? 'people.makeEditor' : 'people.makeAdmin')}
                      <span class="sr-only"> {p.displayName}</span>
                    </button>
                    <button type="button" class="btn" onClick={(e) => { opener.capture(e); setAsk({ kind: 'recovery', person: p }); }}>
                      {t('people.recovery')}<span class="sr-only"> {p.displayName}</span>
                    </button>
                    <button type="button" class="btn" onClick={(e) => { opener.capture(e); setAsk({ kind: 'sessions', person: p }); }}>
                      {t('people.endSessions')}<span class="sr-only"> {p.displayName}</span>
                    </button>
                    <button type="button" class="btn" onClick={(e) => { opener.capture(e); setAsk({ kind: 'remove', person: p }); }}>
                      {t('people.remove')}<span class="sr-only"> {p.displayName}</span>
                    </button>
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Gate>
      </section>
      {ask ? (
        <Confirm
          title={t(ask.kind === 'remove' ? 'people.remove' : ask.kind === 'sessions' ? 'people.endSessions' : 'people.recovery')}
          text={t(ask.kind === 'remove' ? 'people.confirmRemove' : ask.kind === 'sessions' ? 'people.confirmSessions' : 'people.confirmRecovery', { name: ask.person.displayName })}
          yes={t('account.confirmYes')}
          returnFocusTo={opener.ref.current}
          onClose={() => setAsk(null)}
          onYes={() => void doAsk()}
        />
      ) : null}
      {link ? (
        <Dialog open onClose={() => setLink(null)} title={link.title} returnFocusTo={opener.ref.current}>
          <p>{t('people.linkHelp', { time: formatMoment(link.expiresAt, lang, ctx.timezone) })}</p>
          <div class="qr-sheet">
            <QrCode text={link.url} label={t('people.qrAlt')} size={192} />
          </div>
          <div class="field">
            <label for="hand-link">{t('people.linkLabel')}</label>
            <input id="hand-link" type="text" readOnly value={link.url} onFocus={(e) => (e.target as HTMLInputElement).select()} />
          </div>
          <p class="actions">
            <button
              type="button"
              class="btn btn-primary"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(link.url);
                  toast(t('people.copied'));
                } catch {
                  toast(t('people.copyFailed'));
                }
              }}
            >
              {t('people.copy')}
            </button>
            <button type="button" class="btn" onClick={() => setLink(null)}>
              {t('form.close')}
            </button>
          </p>
        </Dialog>
      ) : null}
    </>
  );
}

// ---- Audit log ------------------------------------------------------------------------------------------------

export function Audit({ api, ctx }: Props) {
  const t = useStaffT();
  const { lang } = useUi();
  const [rows, setRows] = useState<StaffAuditEntry[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [more, setMore] = useState(false);
  const PAGE = 50;
  const load = async (before?: number) => {
    const res = await api.get<StaffAuditEntry[]>(`/audit?limit=${PAGE}${before ? `&before=${before}` : ''}`);
    if (res.status !== 200 || !res.data) {
      setStatus('error');
      return;
    }
    const page = res.data;
    setRows((cur) => (before ? [...cur, ...page] : page));
    setMore(page.length === PAGE);
    setStatus('ready');
  };
  useEffect(() => {
    void load();
    // loads once when the screen opens; `load` is re-created each render but reads nothing that changes
  }, []);
  // An action this build has no sentence for (a newer server) is shown as its code rather than failing.
  const name = (a: string) => {
    const key = `audit.${a}`;
    return key in staffEn ? t(key as StaffKey) : a;
  };
  return (
    <>
      <p>{t('audit.intro')}</p>
      {status === 'loading' ? <output class="muted">{t('staff.loading')}</output> : null}
      {status === 'error' ? (
        <>
          <p class="error" role="alert">{t('staff.error')}</p>
          <button type="button" class="btn" onClick={() => void load()}>{t('staff.retry')}</button>
        </>
      ) : null}
      {status === 'ready' && rows.length === 0 ? <p class="state">{t('audit.empty')}</p> : null}
      <ul class="cards">
        {rows.map((r) => (
          <li key={r.id} class="card">
            <p>
              <strong>{name(r.action)}</strong>
            </p>
            <p class="card-meta">
              {formatMoment(r.createdAt, lang, ctx.timezone)} · {r.actorName ?? t('audit.system')}
            </p>
          </li>
        ))}
      </ul>
      {more ? (
        <button type="button" class="btn" onClick={() => void load(rows[rows.length - 1]?.createdAt)}>
          {t('audit.more')}
        </button>
      ) : null}
    </>
  );
}

// ---- Export ---------------------------------------------------------------------------------------------------

export function Export({ api }: Props) {
  const t = useStaffT();
  const { toast } = useUi();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const download = async () => {
    setBusy(true);
    setMessage('');
    try {
      const res = await fetch(`${api.base}/export`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      if (!res.ok) {
        setMessage(errorText(t, res.status, null));
      } else {
        const blob = await res.blob();
        const match = /filename="([^"]+)"/.exec(res.headers.get('Content-Disposition') ?? '');
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = match?.[1] ?? 'export.json';
        document.body.append(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        toast(t('export.done'));
      }
    } catch {
      setMessage(t('staff.error'));
    }
    setBusy(false);
  };
  return (
    <>
      <p>{t('export.intro')}</p>
      <ul>
        <li>{t('export.has')}</li>
        <li>{t('export.hasNot')}</li>
      </ul>
      <button type="button" class="btn btn-primary" onClick={() => void download()} disabled={busy}>
        {busy ? t('form.saving') : t('export.button')}
      </button>
      {message ? <p class="error" role="alert">{message}</p> : null}
    </>
  );
}
