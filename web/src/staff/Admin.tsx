import { useEffect, useState } from 'preact/hooks';
import type { StaffKey } from '../../../shared/i18n/staff-en.ts';
import type { ImportIssue, ImportReport } from '../../../shared/import-schemas.ts';
import { asText, pick } from '../../../shared/i18n/index.ts';
import { useUi } from '../context.tsx';
import { Link } from '../router.tsx';
import { QRCode } from '../QRCode.tsx';
import { Api, useResource, type PropertyContext } from './data.ts';
import { Gate } from './Content.tsx';
import { useStaffT } from './t.ts';
import { Dialog, Field, Heading, Stamp, Submit, useForm } from './ui.tsx';

export function Zones({ api, ctx }: { api: Api; ctx: PropertyContext }) {
  const t = useStaffT();
  const { lang } = useUi();
  const zones = useResource<any[]>(api, '/zones');
  const [edit, setEdit] = useState<any | 'new' | null>(null);
  const admin = ctx.role === 'admin';
  return (
    <Gate state={zones.state} reload={zones.reload}>
      {(rows) => (
        <>
          <p>{t('zones.intro')}</p>
          {!admin && <p class="muted">{t('admin.only')}</p>}
          {admin && (
            <button class="btn" type="button" onClick={() => setEdit('new')}>
              {t('zones.add')}
            </button>
          )}
          {rows.length === 0 && <p>{t('zones.empty')}</p>}
          <ul class="cards">
            {rows.map((z) => (
              <li key={z.id} class="card">
                <h2>{pick(z.label, lang as 'en' | 'fr')}</h2>
                <p class="muted">
                  {t(z.ring)} · {z.activityCount} {t('zones.inUse')}
                </p>
                <Stamp {...z} />
                {admin && (
                  <button class="btn btn-quiet" type="button" onClick={() => setEdit(z)}>
                    {t('act.edit')}
                  </button>
                )}
              </li>
            ))}
          </ul>
          {edit && <ZoneDialog api={api} zone={edit === 'new' ? null : edit} close={() => { setEdit(null); zones.reload(); }} />}
        </>
      )}
    </Gate>
  );
}

function ZoneDialog({ api, zone, close }: { api: Api; zone: any | null; close: () => void }) {
  const t = useStaffT();
  const { f, set, busy, error, submit } = useForm({ labelEn: zone?.label.en ?? '', labelFr: zone?.label.fr ?? '', ring: zone?.ring ?? 'in_hostel', delete: false });
  return (
    <Dialog title={t(zone ? 'zones.edit' : 'zones.add')} close={close}>
      <form onSubmit={submit(async () => { await api(zone ? `/zones/${zone.id}` : '/zones', { labelEn: f.labelEn, labelFr: f.labelFr, ring: f.ring }, 'POST'); close(); })}>
        <Field id="zl-en" label={t('f.labelEn')} value={f.labelEn} set={set('labelEn')} required max={60} />
        <Field id="zl-fr" label={t('f.labelFr')} value={f.labelFr} set={set('labelFr')} max={60} />
        <label class="field">
          <span>{t('f.ring')}</span>
          <select value={f.ring} onChange={(e) => set('ring')(e.currentTarget.value)}>
            {(['in_hostel', 'short_walk', 'further'] as const).map((r) => <option key={r} value={r}>{t(r)}</option>)}
          </select>
        </label>
        {error && <p class="error">{t(error)}</p>}
        <Submit busy={busy} />
      </form>
      {zone && (
        <form onSubmit={submit(async () => { await api(`/zones/${zone.id}/delete`, {}); close(); })}>
          <label class="check">
            <input type="checkbox" checked={f.delete} onChange={(e) => set('delete')(e.currentTarget.checked)} />
            <span>{t('zones.confirmDelete', { name: zone.label.en })}</span>
          </label>
          {f.delete && <Submit busy={busy} label={t('act.delete')} danger />}
        </form>
      )}
    </Dialog>
  );
}

export function Codes({ api, ctx }: { api: Api; ctx: PropertyContext }) {
  const t = useStaffT();
  const codes = useResource<any[]>(api, '/codes');
  const [label, setLabel] = useState('');
  const [error, setError] = useState('');
  const [show, setShow] = useState<any | null>(null);
  const admin = ctx.role === 'admin';
  const add = async (e: Event) => {
    e.preventDefault();
    const r = await api('/codes', { label }, 'POST');
    if (r.status === 409) { setError('codes.exists'); return; }
    if (!r.ok) { setError('codes.badLabel'); return; }
    setLabel(''); setError(''); codes.reload();
  };
  return (
    <Gate state={codes.state} reload={codes.reload}>
      {(rows) => (
        <>
          <p>{t('codes.intro')}</p>
          {!admin && <p class="muted">{t('admin.only')}</p>}
          {admin && (
            <form onSubmit={add}>
              <label class="field">
                <span>{t('codes.label')}</span>
                <input value={label} onInput={(e) => setLabel(e.currentTarget.value)} required maxLength={40} pattern="[a-z0-9-]+" />
                <small>{t('codes.labelHelp')}</small>
              </label>
              {error && <p class="error">{t(error as StaffKey)}</p>}
              <button class="btn" type="submit">{t('codes.add')}</button>
            </form>
          )}
          {rows.length === 0 && <p>{t('codes.empty')}</p>}
          <ul class="cards">
            {rows.map((c) => (
              <li key={c.id} class="card">
                <h2>{c.label}</h2>
                <p class="muted">{c.retiredOn ? t('codes.retired', { date: c.retiredOn }) : t('codes.active')}</p>
                <button class="btn btn-quiet" type="button" onClick={() => setShow(c)}>{t('codes.show')}</button>
                {admin && !c.retiredOn && <button class="btn btn-quiet danger" type="button" onClick={async () => { if (confirm(t('codes.confirmRetire', { label: c.label }))) { await api(`/codes/${c.id}/retire`, {}); codes.reload(); } }}>{t('codes.retire')}</button>}
              </li>
            ))}
          </ul>
          <p class="muted">{t('codes.stage2')}</p>
          {show && (
            <Dialog title={t('codes.qrTitle', { label: show.label })} close={() => setShow(null)}>
              <QRCode path={`/p/${ctx.slug}/qr/${show.label}`} label={t('codes.qrAlt', { label: show.label })} />
              <button class="btn" type="button" onClick={() => print()}>{t('codes.print')}</button>
            </Dialog>
          )}
        </>
      )}
    </Gate>
  );
}

export function Switches({ api, ctx }: { api: Api; ctx: PropertyContext }) {
  const t = useStaffT();
  const features = useResource<any[]>(api, '/features');
  const admin = ctx.role === 'admin';
  return (
    <Gate state={features.state} reload={features.reload}>
      {(rows) => (
        <>
          <p>{t('sw.intro')}</p>
          {!admin && <p class="muted">{t('admin.only')}</p>}
          <ul class="cards">
            {rows.map((f) => (
              <li key={f.feature} class="card">
                <h2>{t(`sw.${f.feature}` as StaffKey)}</h2>
                <p>{t(`sw.${f.feature}.help` as StaffKey)}</p>
                <p class="muted">{t(f.enabled ? 'sw.on' : 'sw.off', { name: t(`sw.${f.feature}` as StaffKey) })}</p>
                {admin && (
                  <button class="btn" type="button" onClick={async () => { await api(`/features/${f.feature}`, { enabled: !f.enabled }); features.reload(); }}>
                    {t(f.enabled ? 'sw.off' : 'sw.on', { name: t(`sw.${f.feature}` as StaffKey) })}
                  </button>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </Gate>
  );
}

export function People({ api }: { api: Api; ctx: PropertyContext }) {
  const t = useStaffT();
  const people = useResource<any[]>(api, '/people');
  const [invite, setInvite] = useState<any | null>(null);
  const [showLink, setShowLink] = useState<{ name: string; url: string; recovery: boolean } | null>(null);
  return (
    <Gate state={people.state} reload={people.reload}>
      {(rows) => (
        <>
          <p>{t('people.intro')}</p>
          <button class="btn" type="button" onClick={() => setInvite({})}>{t('people.invite')}</button>
          <h2>{t('people.list')}</h2>
          <ul class="cards">
            {rows.map((p) => (
              <li key={p.staffUserId} class="card">
                <h2>{p.displayName}</h2>
                <p>{p.email}</p>
                <p class="muted">{t(`role.${p.role}` as StaffKey)} · {t('people.passkeys', { n: p.passkeyCount })}</p>
                <p class="muted">{p.lastSeenAt ? t('people.lastIn', { when: new Date(p.lastSeenAt * 1000).toLocaleString() }) : t('people.neverIn')}</p>
                {p.canChangeRole && <button class="btn btn-quiet" type="button" onClick={async () => { await api(`/people/${p.staffUserId}/role`, { role: p.role === 'admin' ? 'editor' : 'admin' }); people.reload(); }}>{t(p.role === 'admin' ? 'people.makeEditor' : 'people.makeAdmin')}</button>}
                {p.canRemove && <button class="btn btn-quiet danger" type="button" onClick={async () => { if (confirm(t('people.confirmRemove', { name: p.displayName }))) { await api(`/people/${p.staffUserId}/remove`, {}); people.reload(); } }}>{t('people.remove')}</button>}
                {p.canManageSessions && <button class="btn btn-quiet" type="button" onClick={async () => { if (confirm(t('people.confirmSessions', { name: p.displayName }))) { await api(`/people/${p.staffUserId}/revoke-sessions`, {}); people.reload(); } }}>{t('people.endSessions')}</button>}
                {p.canIssueRecovery && <button class="btn btn-quiet" type="button" onClick={async () => { if (!confirm(t('people.confirmRecovery', { name: p.displayName }))) return; const r = await api(`/people/${p.staffUserId}/recovery`, {}); if (r.ok) setShowLink({ name: p.displayName, url: (await r.json()).url, recovery: true }); }}>{t('people.recovery')}</button>}
              </li>
            ))}
          </ul>
          {invite && <InviteDialog api={api} close={() => { setInvite(null); people.reload(); }} show={(name, url) => setShowLink({ name, url, recovery: false })} />}
          {showLink && <LinkDialog data={showLink} close={() => setShowLink(null)} />}
        </>
      )}
    </Gate>
  );
}

function InviteDialog({ api, close, show }: { api: Api; close: () => void; show: (name: string, url: string) => void }) {
  const t = useStaffT();
  const { f, set, busy, error, submit } = useForm({ email: '', displayName: '', role: 'editor' });
  return (
    <Dialog title={t('people.invite')} close={close}>
      <form onSubmit={submit(async () => { const r = await api('/people/invite', f); if (r.ok) { show(f.displayName, (await r.json()).url); close(); } })}>
        <Field id="inv-name" label={t('people.name')} value={f.displayName} set={set('displayName')} required max={80} />
        <Field id="inv-email" label={t('people.email')} value={f.email} set={set('email')} required max={254} type="email" />
        <label class="field">
          <span>{t('people.role')}</span>
          <select value={f.role} onChange={(e) => set('role')(e.currentTarget.value)}>
            <option value="editor">{t('role.editor')}</option>
            <option value="admin">{t('role.admin')}</option>
          </select>
        </label>
        {error && <p class="error">{t(error)}</p>}
        <Submit busy={busy} label={t('people.createLink')} />
      </form>
    </Dialog>
  );
}

function LinkDialog({ data, close }: { data: { name: string; url: string; recovery: boolean }; close: () => void }) {
  const t = useStaffT();
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(data.url); setCopied(true); } catch { setFailed(true); }
  };
  return (
    <Dialog title={t(data.recovery ? 'people.recoveryFor' : 'people.linkFor', { name: data.name })} close={close}>
      <p>{t('people.linkHelp', { time: new Date(Date.now() + 24 * 3600 * 1000).toLocaleString() })}</p>
      <QRCode value={data.url} label={t('people.qrAlt')} />
      <label class="field"><span>{t('people.linkLabel')}</span><input readOnly value={data.url} onFocus={(e) => e.currentTarget.select()} /></label>
      <button class="btn" type="button" onClick={copy}>{t('people.copy')}</button>
      {copied && <p role="status">{t('people.copied')}</p>}
      {failed && <p class="error">{t('people.copyFailed')}</p>}
    </Dialog>
  );
}

export function Audit({ api }: { api: Api; ctx: PropertyContext }) {
  const t = useStaffT();
  const { lang } = useUi();
  const audit = useResource<any[]>(api, '/audit');
  const [rows, setRows] = useState<any[]>([]);
  const [before, setBefore] = useState<number | null>(null);
  const [done, setDone] = useState(false);
  useEffect(() => {
    if (audit.state.status === 'ready') { setRows(audit.state.data); setDone(audit.state.data.length < 50); }
  }, [audit.state]);
  const more = async () => {
    if (!before) return;
    const r = await api(`/audit?before=${before}`);
    if (!r.ok) return;
    const older = await r.json();
    setRows((all) => [...all, ...older]);
    setBefore(older.at(-1)?.id ?? null);
    setDone(older.length < 50);
  };
  return (
    <Gate state={audit.state} reload={audit.reload}>
      {() => (
        <>
          <p>{t('audit.intro')}</p>
          {rows.length === 0 && <p>{t('audit.empty')}</p>}
          <ol class="audit">
            {rows.map((r) => {
              const key = `audit.${r.action}`;
              const action = asText(lang as 'en' | 'fr', key, key) || r.action;
              return (
                <li key={r.id}>
                  <time>{new Date(r.at * 1000).toLocaleString()}</time> · {action} · {r.actorName ?? t('audit.system')}
                  {r.changeNote && <p>{pick(r.changeNote, lang as 'en' | 'fr')}</p>}
                </li>
              );
            })}
          </ol>
          {!done && <button class="btn btn-quiet" type="button" onClick={more}>{t('audit.more')}</button>}
        </>
      )}
    </Gate>
  );
}

interface CountRow {
  day: string;
  event: string;
  count: number;
}

/** Property-scoped aggregate counters. The API returns no guest, device or session fields. */
export function Counts({ api }: { api: Api; ctx: PropertyContext }) {
  const t = useStaffT();
  const [day, setDay] = useState('');
  const counts = useResource<CountRow[]>(api, `/counts${day ? `?day=${day}` : ''}`);
  return (
    <Gate state={counts.state} reload={counts.reload}>
      {(rows) => (
        <>
          <p>{t('counts.intro')}</p>
          <label class="field">
            <span>{t('counts.day')}</span>
            <input type="date" value={day} onChange={(e) => setDay(e.currentTarget.value)} />
          </label>
          {day && <button class="btn btn-quiet" type="button" onClick={() => setDay('')}>{t('counts.allDays')}</button>}
          {rows.length === 0 ? <p>{t('counts.empty')}</p> : (
            <table>
              <thead><tr><th scope="col">{t('counts.day')}</th><th scope="col">{t('counts.event')}</th><th scope="col">{t('counts.total')}</th></tr></thead>
              <tbody>{rows.map((row) => <tr key={`${row.day}-${row.event}`}><td>{row.day}</td><td>{row.event}</td><td>{row.count}</td></tr>)}</tbody>
            </table>
          )}
        </>
      )}
    </Gate>
  );
}

/** Two-step, new-content-only import. The server, not this screen, decides what is valid. */
export function Import({ api }: { api: Api; ctx: PropertyContext }) {
  const t = useStaffT();
  const [document, setDocument] = useState<unknown | null>(null);
  const [report, setReport] = useState<ImportReport | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<number | null>(null);

  const read = async (file: File | undefined) => {
    setReport(null); setDone(null); setError(''); setDocument(null);
    if (!file) return;
    try { setDocument(JSON.parse(await file.text())); } catch { setError('import.invalid'); }
  };

  const dryRun = async () => {
    if (!document) return;
    setBusy(true); setError(''); setDone(null);
    try {
      const r = await api('/import', { mode: 'dry_run', document });
      if (r.ok) setReport(await r.json()); else setError('import.invalid');
    } finally { setBusy(false); }
  };

  const apply = async () => {
    if (!document || !report?.valid || !report.confirmation) return;
    setBusy(true); setError(''); setDone(null);
    try {
      const r = await api('/import', { mode: 'apply', document, confirmation: report.confirmation });
      if (r.ok) {
        const body = await r.json();
        setDone(body.imported); setDocument(null); setReport(null);
      } else if (r.status === 409 || r.status === 400) {
        setReport(null); setError('import.confirmationRequired');
      } else setError('import.invalid');
    } finally { setBusy(false); }
  };

  return (
    <>
      <p>{t('import.intro')}</p>
      <label class="field">
        <span>{t('import.file')}</span>
        <input type="file" accept="application/json,.json" disabled={busy} onChange={(e) => read(e.currentTarget.files?.[0])} />
      </label>
      <p>
        <button class="btn" type="button" disabled={!document || busy} onClick={dryRun}>{t('import.dryRun')}</button>{' '}
        <button class="btn" type="button" disabled={!report?.valid || !report.confirmation || busy} onClick={apply}>{t('import.apply')}</button>
      </p>
      {busy && <p role="status">{t('form.saving')}</p>}
      {error && <p class="error">{t(error as StaffKey)}</p>}
      {done !== null && <p role="status">{t('import.done', { n: done })}</p>}
      {report && (
        <output class={`card ${report.valid ? '' : 'error'}`}>
          <p>{t(report.valid ? 'import.valid' : 'import.invalid', { n: report.itemCount })}</p>
          {report.issues.length > 0 && <ul>{report.issues.map((issue: ImportIssue, i: number) => <li key={`${issue.item}-${issue.code}-${i}`}>{t('import.item', { n: issue.item + 1, code: issue.code })}</li>)}</ul>}
        </output>
      )}
    </>
  );
}

export function Export({ api }: { api: Api; ctx: PropertyContext }) {
  const t = useStaffT();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const download = async () => {
    setBusy(true); setDone(false);
    try {
      const r = await api('/export', {}, 'POST');
      if (!r.ok) return;
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${ctx.slug}-export.json`;
      a.click();
      URL.revokeObjectURL(url);
      setDone(true);
    } finally { setBusy(false); }
  };
  return (
    <>
      <Heading>{t('nav.export')}</Heading>
      <p>{t('export.intro')}</p>
      <p>{t('export.has')}</p>
      <p>{t('export.hasNot')}</p>
      <button class="btn" type="button" disabled={busy} onClick={download}>{t('export.button')}</button>
      {done && <p role="status">{t('export.done')}</p>}
    </>
  );
}
