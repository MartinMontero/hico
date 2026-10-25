import type { ComponentChildren } from 'preact';
import { useState } from 'preact/hooks';
import { CHECK_LIMIT_DAYS } from '../../../shared/check-limits.ts';
import { LIMITS } from '../../../shared/limits.ts';
import { pick } from '../../../shared/i18n/index.ts';
import { ACTIVITY_CATEGORIES, PLACE_CATEGORIES } from '../../../shared/staff-content-schemas.ts';
import type { StaffActivity, StaffOffer, StaffPlace, StaffZone } from '../../../shared/types.ts';
import { useUi } from '../context.tsx';
import { Dialog } from '../Dialog.tsx';
import { Link } from '../router.tsx';
import type { Api, PropertyContext, Resource } from './data.ts';
import { useResource } from './data.ts';
import { formatDay, useStaffT, type StaffT } from './t.ts';
import { Confirm, EditDialog, errorText, focusHeading, useOpener, type FieldSpec, type Values } from './ui.tsx';

// The content screens: what guests read. Every save is stamped by the server with the signed-in person and the time.

interface Props {
  api: Api;
  ctx: PropertyContext;
}

/** A list state as text: loading, a failure with a retry, or nothing. */
export function Gate<T>({ state, reload, children }: { state: Resource<T>; reload: () => Promise<void>; children: (data: T) => ComponentChildren }) {
  const t = useStaffT();
  if (state.status === 'loading') return <output class="muted">{t('staff.loading')}</output>;
  if (state.status === 'error') {
    return (
      <>
        <p class="error" role="alert">
          {errorText(t, state.code, null)}
        </p>
        <button type="button" class="btn" onClick={() => void reload()}>
          {t('staff.retry')}
        </button>
      </>
    );
  }
  return <>{children(state.data)}</>;
}

/** "Checked <date> by <name>", with an "overdue" chip when the 09 §2 rule says the check is old. */
export function CheckedLine({ on, by, overdue, placeholder, tz }: { on: number | null; by: string | null; overdue: boolean; placeholder: boolean; tz: string }) {
  const t = useStaffT();
  const { lang } = useUi();
  return (
    <p class="card-meta">
      {on === null ? t('stamp.never') : t('stamp.line', { date: formatDay(on, lang, tz), name: by ?? '' })}
      {overdue ? <strong class="chip chip-warn"> {t('chip.overdue')}</strong> : null}
      {placeholder ? <strong class="chip"> {t('chip.sample')}</strong> : null}
    </p>
  );
}

const numberString = (n: number | null) => (n === null ? '' : String(n));

// ---- Board ----------------------------------------------------------------------------------------------------

const weekdayName = (weekday: number, lang: string) => new Intl.DateTimeFormat(lang, { weekday: 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(2024, 0, 7 + weekday)));
const dayName = (date: string, lang: string) => new Intl.DateTimeFormat(lang, { dateStyle: 'full', timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`));

function scheduleText(a: StaffActivity, lang: string, t: StaffT): string {
  const s = a.schedule;
  const time = s.endLocal ? `${s.startLocal} – ${s.endLocal}` : s.startLocal;
  return s.kind === 'weekly' ? t('sched.weekly', { day: weekdayName(s.weekday, lang), time }) : t('sched.oneOff', { date: dayName(s.date, lang), time });
}

function activityToForm(a: StaffActivity): Values {
  const s = a.schedule;
  return {
    titleEn: a.title.en, titleFr: a.title.fr, descriptionEn: a.description.en, descriptionFr: a.description.fr, category: a.category, zoneId: a.zoneId ?? '',
    hostLabel: a.hostLabel, capacity: numberString(a.capacity), kind: s.kind, weekday: s.kind === 'weekly' ? String(s.weekday) : '1',
    date: s.kind === 'one_off' ? s.date : '', startLocal: s.startLocal, endLocal: s.endLocal ?? '',
  };
}
const emptyActivity: Values = {
  titleEn: '', titleFr: '', descriptionEn: '', descriptionFr: '', category: 'social', zoneId: '', hostLabel: '', capacity: '', kind: 'weekly', weekday: '1', date: '', startLocal: '19:00', endLocal: '',
};
function activityBody(v: Values) {
  const s = (k: string) => (typeof v[k] === 'string' ? (v[k] as string) : '');
  const end = s('endLocal') === '' ? null : s('endLocal');
  return {
    titleEn: s('titleEn'), titleFr: s('titleFr'), descriptionEn: s('descriptionEn'), descriptionFr: s('descriptionFr'), category: s('category'),
    zoneId: s('zoneId') === '' ? null : s('zoneId'), hostLabel: s('hostLabel'), capacity: s('capacity') === '' ? null : Number(s('capacity')),
    schedule: s('kind') === 'weekly' ? { kind: 'weekly', weekday: Number(s('weekday')), startLocal: s('startLocal'), endLocal: end } : { kind: 'one_off', date: s('date'), startLocal: s('startLocal'), endLocal: end },
  };
}

function activitySpecs(t: StaffT, lang: string, zones: StaffZone[]): FieldSpec[] {
  return [
    { key: 'titleEn', label: 'f.titleEn', kind: 'text', max: LIMITS.title },
    { key: 'titleFr', label: 'f.titleFr', kind: 'text', max: LIMITS.title, help: 'f.frHelp' },
    { key: 'descriptionEn', label: 'f.descEn', kind: 'area', max: LIMITS.description },
    { key: 'descriptionFr', label: 'f.descFr', kind: 'area', max: LIMITS.description },
    { key: 'category', label: 'f.category', kind: 'select', options: ACTIVITY_CATEGORIES.map((c) => ({ value: c, label: t(`cat.${c}`) })) },
    { key: 'zoneId', label: 'f.zone', kind: 'select', options: [{ value: '', label: t('f.noZone') }, ...zones.map((z) => ({ value: z.id, label: pick(z.label, lang as 'en' | 'fr') }))] },
    { key: 'hostLabel', label: 'f.host', kind: 'text', max: LIMITS.label },
    { key: 'capacity', label: 'f.capacity', kind: 'number' },
    { key: 'kind', label: 'f.repeat', kind: 'select', options: [{ value: 'weekly', label: t('f.repeat.weekly') }, { value: 'one_off', label: t('f.repeat.oneOff') }] },
    { key: 'weekday', label: 'f.weekday', kind: 'select', show: (v) => v['kind'] === 'weekly', options: [0, 1, 2, 3, 4, 5, 6].map((d) => ({ value: String(d), label: weekdayName(d, lang) })) },
    { key: 'date', label: 'f.date', kind: 'date', show: (v) => v['kind'] === 'one_off' },
    { key: 'startLocal', label: 'f.start', kind: 'time', help: 'f.timeHelp' },
    { key: 'endLocal', label: 'f.end', kind: 'time' },
  ];
}

type BoardDialog =
  | null
  | { kind: 'edit'; activity: StaffActivity | null }
  | { kind: 'dates'; activity: StaffActivity }
  | { kind: 'where'; activity: StaffActivity }
  | { kind: 'delete'; activity: StaffActivity };

export function Board({ api, ctx }: Props) {
  const t = useStaffT();
  const { lang, toast } = useUi();
  const list = useResource<StaffActivity[]>(api, '/activities');
  const zones = useResource<StaffZone[]>(api, '/zones');
  const [dialog, setDialog] = useState<BoardDialog>(null);
  const [message, setMessage] = useState('');
  const opener = useOpener();
  const open = (d: BoardDialog) => (e: Event) => {
    opener.capture(e);
    setDialog(d);
  };

  const run = async (a: StaffActivity, path: string, body: unknown, done: StaffKeyDone) => {
    setMessage('');
    const res = await api.post<StaffActivity>(`/activities/${a.id}${path}`, body);
    if (res.status === 200) toast(t(done));
    else setMessage(errorText(t, res.status, res.error));
    await list.reload();
  };

  return (
    <>
      <p class="actions">
        <button type="button" class="btn btn-primary" onClick={open({ kind: 'edit', activity: null })}>
          {t('board.add')}
        </button>
      </p>
      {message ? (
        <p class="error" role="alert">
          {message}
        </p>
      ) : null}
      <Gate state={list.state} reload={list.reload}>
        {(items) =>
          items.length === 0 ? (
            <p class="state">{t('board.empty')}</p>
          ) : (
            <ul class="cards">
              {items.map((a) => (
                <li key={a.id} class={`card${a.status === 'cancelled' ? ' cancelled' : ''}`}>
                  <h2 class="card-title">{pick(a.title, lang as 'en' | 'fr') || a.title.en}</h2>
                  <p class="card-meta">
                    {scheduleText(a, lang, t)}
                    {a.zone ? ` · ${pick(a.zone, lang as 'en' | 'fr')}` : ''}
                  </p>
                  <p class="card-meta">
                    {a.status === 'cancelled' ? <strong class="chip chip-warn">{t('chip.cancelled')} </strong> : null}
                    {a.offeredAt.length > 1 ? <span class="chip">{t('chip.shared', { n: String(a.offeredAt.length) })} </span> : null}
                    {!a.isOwner ? <span class="chip">{t('chip.ownedElsewhere')}</span> : null}
                  </p>
                  <CheckedLine on={a.verifiedOn} by={a.verifiedBy} overdue={a.check === 'overdue'} placeholder={a.isPlaceholder} tz={a.timezone} />
                  <p class="actions">
                    <button type="button" class="btn" onClick={open({ kind: 'edit', activity: a })}>
                      {t('act.edit')}
                      <span class="sr-only"> {a.title.en}</span>
                    </button>
                    <button type="button" class="btn" onClick={() => void run(a, '/reverify', { version: a.version }, 'toast.checked')}>
                      {t('act.stillCorrect')}
                      <span class="sr-only"> {a.title.en}</span>
                    </button>
                    <button type="button" class="btn" onClick={open({ kind: 'dates', activity: a })}>
                      {t('act.dates')}
                      <span class="sr-only"> {a.title.en}</span>
                    </button>
                    <button type="button" class="btn" onClick={() => void run(a, '/status', { version: a.version, status: a.status === 'active' ? 'cancelled' : 'active' }, 'toast.saved')}>
                      {a.status === 'active' ? t('act.cancelSeries') : t('act.resumeSeries')}
                      <span class="sr-only"> {a.title.en}</span>
                    </button>
                    <button type="button" class="btn" onClick={() => void run(a, '/duplicate', {}, 'toast.copied')}>
                      {t('act.copy')}
                      <span class="sr-only"> {a.title.en}</span>
                    </button>
                    <button type="button" class="btn" onClick={open({ kind: 'where', activity: a })}>
                      {t('act.where')}
                      <span class="sr-only"> {a.title.en}</span>
                    </button>
                    {a.canChangeList ? (
                      <button type="button" class="btn" onClick={open({ kind: 'delete', activity: a })}>
                        {t('act.delete')}
                        <span class="sr-only"> {a.title.en}</span>
                      </button>
                    ) : null}
                  </p>
                </li>
              ))}
            </ul>
          )
        }
      </Gate>

      {dialog?.kind === 'edit' ? (
        <EditDialog<StaffActivity>
          title={dialog.activity ? t('board.edit') : t('board.add')}
          specs={activitySpecs(t, lang, zones.state.status === 'ready' ? zones.state.data : [])}
          initial={dialog.activity ? activityToForm(dialog.activity) : emptyActivity}
          version={dialog.activity?.version ?? null}
          toBody={activityBody}
          toForm={activityToForm}
          send={(body, version) => (dialog.activity ? api.post(`/activities/${dialog.activity.id}`, { ...(body as object), version }) : api.post('/activities', body))}
          onSaved={() => {
            setDialog(null);
            toast(t('toast.saved'));
            void list.reload();
          }}
          onClose={() => setDialog(null)}
          returnFocusTo={opener.ref.current}
        />
      ) : null}
      {dialog?.kind === 'dates' ? <DatesDialog api={api} activity={dialog.activity} onClose={() => { setDialog(null); void list.reload(); }} returnFocusTo={opener.ref.current} /> : null}
      {dialog?.kind === 'where' ? <WhereDialog api={api} activity={dialog.activity} onClose={() => { setDialog(null); void list.reload(); }} returnFocusTo={opener.ref.current} /> : null}
      {dialog?.kind === 'delete' ? (
        <Confirm
          title={t('act.delete')}
          text={t('board.confirmDelete', { name: dialog.activity.title.en })}
          yes={t('act.delete')}
          returnFocusTo={opener.ref.current}
          onClose={() => setDialog(null)}
          onYes={async () => {
            const a = dialog.activity;
            setDialog(null);
            const res = await api.post(`/activities/${a.id}/delete`, { version: a.version });
            if (res.status === 200) toast(t('toast.deleted'));
            else setMessage(errorText(t, res.status, res.error));
            await list.reload();
            focusHeading();
          }}
        />
      ) : null}
      <p class="muted">{t('board.tz', { tz: ctx.timezone })}</p>
    </>
  );
}

type StaffKeyDone = 'toast.checked' | 'toast.saved' | 'toast.copied' | 'toast.deleted';

function DatesDialog({ api, activity, onClose, returnFocusTo }: { api: Api; activity: StaffActivity; onClose: () => void; returnFocusTo: HTMLElement | null }) {
  const t = useStaffT();
  const { lang } = useUi();
  const [current, setCurrent] = useState(activity);
  const [date, setDate] = useState('');
  const [error, setError] = useState('');
  const change = async (path: 'cancel-date' | 'restore-date', d: string) => {
    setError('');
    const res = await api.post<StaffActivity>(`/activities/${current.id}/${path}`, { date: d });
    if (res.status === 200 && res.data) setCurrent(res.data);
    else setError(res.status === 409 ? t('dates.already') : errorText(t, res.status, res.error));
  };
  return (
    <Dialog open onClose={onClose} title={t('dates.title')} returnFocusTo={returnFocusTo}>
      <p>{current.title.en}</p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (date) void change('cancel-date', date);
        }}
      >
        <div class="field">
          <label for="cancel-date">{t('dates.pick')}</label>
          <input id="cancel-date" type="date" value={date} onInput={(e) => setDate((e.target as HTMLInputElement).value)} />
        </div>
        <button type="submit" class="btn btn-primary" disabled={!date}>
          {t('dates.cancel')}
        </button>
      </form>
      {error ? (
        <p class="error" role="alert">
          {error}
        </p>
      ) : null}
      <h3>{t('dates.list')}</h3>
      {current.cancelledDates.length === 0 ? (
        <p class="muted">{t('dates.none')}</p>
      ) : (
        <ul class="cards">
          {current.cancelledDates.map((d) => (
            <li key={d} class="card">
              <p>{dayName(d, lang)}</p>
              <button type="button" class="btn" onClick={() => void change('restore-date', d)}>
                {t('dates.restore')}
                <span class="sr-only"> {dayName(d, lang)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <p class="actions">
        <button type="button" class="btn" onClick={onClose}>
          {t('form.close')}
        </button>
      </p>
    </Dialog>
  );
}

function WhereDialog({ api, activity, onClose, returnFocusTo }: { api: Api; activity: StaffActivity; onClose: () => void; returnFocusTo: HTMLElement | null }) {
  const t = useStaffT();
  const { lang } = useUi();
  const [current, setCurrent] = useState(activity);
  const options = useResource<{ slug: string; name: { en: string; fr: string } }[]>(api, `/activities/${activity.id}/offered-at/options`, activity.canChangeList);
  const [error, setError] = useState('');
  const change = async (path: 'add' | 'remove', slug: string) => {
    setError('');
    const res = await api.post<StaffActivity>(`/activities/${current.id}/offered-at/${path}`, { slug });
    if (res.status === 200 && res.data) {
      setCurrent(res.data);
      await options.reload();
    } else setError(errorText(t, res.status, res.error));
  };
  return (
    <Dialog open onClose={onClose} title={t('where.title')} returnFocusTo={returnFocusTo}>
      <p>{t(current.isOwner ? 'where.owner' : 'where.notOwner')}</p>
      <ul class="cards">
        {current.offeredAt.map((o, i) => (
          <li key={o.slug} class="card">
            <p>
              {pick(o.name, lang as 'en' | 'fr')}
              {i === 0 ? <span class="muted"> · {t('where.ownerTag')}</span> : null}
            </p>
            {current.canChangeList && i > 0 ? (
              <button type="button" class="btn" onClick={() => void change('remove', o.slug)}>
                {t('where.remove')}
                <span class="sr-only"> {pick(o.name, lang as 'en' | 'fr')}</span>
              </button>
            ) : null}
          </li>
        ))}
      </ul>
      {current.canChangeList ? (
        <>
          <h3>{t('where.add')}</h3>
          {options.state.status === 'ready' && options.state.data.length === 0 ? <p class="muted">{t('where.noMore')}</p> : null}
          {options.state.status === 'ready' ? (
            <ul class="cards">
              {options.state.data.map((o) => (
                <li key={o.slug} class="card">
                  <p>{pick(o.name, lang as 'en' | 'fr')}</p>
                  <button type="button" class="btn" onClick={() => void change('add', o.slug)}>
                    {t('where.addButton')}
                    <span class="sr-only"> {pick(o.name, lang as 'en' | 'fr')}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </>
      ) : null}
      {error ? (
        <p class="error" role="alert">
          {error}
        </p>
      ) : null}
      <p class="actions">
        <button type="button" class="btn" onClick={onClose}>
          {t('form.close')}
        </button>
      </p>
    </Dialog>
  );
}

// ---- Places ---------------------------------------------------------------------------------------------------

const placeToForm = (p: StaffPlace): Values => ({
  category: p.category, name: p.name, staffPick: p.staffPick, noteEn: p.note.en, noteFr: p.note.fr, walkTimeEn: p.walkTime.en, walkTimeFr: p.walkTime.fr,
  hoursEn: p.hours.en, hoursFr: p.hours.fr, phone: p.phone ?? '', mapsAddress: p.mapsAddress,
});
const emptyPlace: Values = { category: 'food', name: '', staffPick: false, noteEn: '', noteFr: '', walkTimeEn: '', walkTimeFr: '', hoursEn: '', hoursFr: '', phone: '', mapsAddress: '' };
function placeBody(v: Values) {
  const s = (k: string) => (typeof v[k] === 'string' ? (v[k] as string) : '');
  return {
    category: s('category'), name: s('name'), staffPick: v['staffPick'] === true, noteEn: s('noteEn'), noteFr: s('noteFr'), walkTimeEn: s('walkTimeEn'), walkTimeFr: s('walkTimeFr'),
    hoursEn: s('hoursEn'), hoursFr: s('hoursFr'), phone: s('phone').trim() === '' ? null : s('phone'), mapsAddress: s('mapsAddress'),
  };
}
function placeSpecs(t: StaffT): FieldSpec[] {
  return [
    { key: 'name', label: 'f.name', kind: 'text', max: LIMITS.name },
    { key: 'category', label: 'f.category', kind: 'select', options: PLACE_CATEGORIES.map((c) => ({ value: c, label: t(`pcat.${c}`) })) },
    { key: 'staffPick', label: 'f.staffPick', kind: 'check' },
    { key: 'noteEn', label: 'f.noteEn', kind: 'area', max: LIMITS.note },
    { key: 'noteFr', label: 'f.noteFr', kind: 'area', max: LIMITS.note, help: 'f.frHelp' },
    { key: 'walkTimeEn', label: 'f.walkEn', kind: 'text', max: LIMITS.shortText },
    { key: 'walkTimeFr', label: 'f.walkFr', kind: 'text', max: LIMITS.shortText },
    { key: 'hoursEn', label: 'f.hoursEn', kind: 'text', max: LIMITS.hoursText },
    { key: 'hoursFr', label: 'f.hoursFr', kind: 'text', max: LIMITS.hoursText },
    { key: 'phone', label: 'f.phone', kind: 'text', max: LIMITS.phone },
    { key: 'mapsAddress', label: 'f.address', kind: 'text', max: LIMITS.address, help: 'f.addressHelp' },
  ];
}

export function Places({ api, ctx }: Props) {
  const t = useStaffT();
  const { lang, toast } = useUi();
  const list = useResource<StaffPlace[]>(api, '/places');
  const [dialog, setDialog] = useState<null | { kind: 'edit'; place: StaffPlace | null } | { kind: 'delete'; place: StaffPlace }>(null);
  const [message, setMessage] = useState('');
  const opener = useOpener();
  const admin = ctx.role === 'admin';
  return (
    <>
      <p class="actions">
        <button type="button" class="btn btn-primary" onClick={(e) => { opener.capture(e); setDialog({ kind: 'edit', place: null }); }}>
          {t('places.add')}
        </button>
      </p>
      <p class="muted">{t('places.order')}</p>
      {message ? <p class="error" role="alert">{message}</p> : null}
      <Gate state={list.state} reload={list.reload}>
        {(items) =>
          items.length === 0 ? (
            <p class="state">{t('places.empty')}</p>
          ) : (
            <ul class="cards">
              {items.map((p) => (
                <li key={p.id} class="card">
                  <h2 class="card-title">{p.name}</h2>
                  <p class="card-meta">
                    {t(`pcat.${p.category}`)}
                    {p.staffPick ? ` · ${t('chip.pick')}` : ''}
                  </p>
                  <p>{pick(p.note, lang as 'en' | 'fr')}</p>
                  <CheckedLine on={p.verifiedOn} by={p.verifiedBy} overdue={p.check === 'overdue'} placeholder={p.isPlaceholder} tz={ctx.timezone} />
                  <p class="actions">
                    <button type="button" class="btn" onClick={(e) => { opener.capture(e); setDialog({ kind: 'edit', place: p }); }}>
                      {t('act.edit')}<span class="sr-only"> {p.name}</span>
                    </button>
                    <button
                      type="button"
                      class="btn"
                      onClick={async () => {
                        setMessage('');
                        const res = await api.post(`/places/${p.id}/reverify`, { version: p.version });
                        if (res.status === 200) toast(t('toast.checked'));
                        else setMessage(errorText(t, res.status, res.error));
                        await list.reload();
                      }}
                    >
                      {t('act.stillCorrect')}<span class="sr-only"> {p.name}</span>
                    </button>
                    {admin ? (
                      <button type="button" class="btn" onClick={(e) => { opener.capture(e); setDialog({ kind: 'delete', place: p }); }}>
                        {t('act.delete')}<span class="sr-only"> {p.name}</span>
                      </button>
                    ) : null}
                  </p>
                </li>
              ))}
            </ul>
          )
        }
      </Gate>
      {dialog?.kind === 'edit' ? (
        <EditDialog<StaffPlace>
          title={dialog.place ? t('places.edit') : t('places.add')}
          specs={placeSpecs(t)}
          initial={dialog.place ? placeToForm(dialog.place) : emptyPlace}
          version={dialog.place?.version ?? null}
          toBody={placeBody}
          toForm={placeToForm}
          send={(body, version) => (dialog.place ? api.post(`/places/${dialog.place.id}`, { ...(body as object), version }) : api.post('/places', body))}
          onSaved={() => { setDialog(null); toast(t('toast.saved')); void list.reload(); }}
          onClose={() => setDialog(null)}
          returnFocusTo={opener.ref.current}
        />
      ) : null}
      {dialog?.kind === 'delete' ? (
        <Confirm
          title={t('act.delete')}
          text={t('places.confirmDelete', { name: dialog.place.name })}
          yes={t('act.delete')}
          returnFocusTo={opener.ref.current}
          onClose={() => setDialog(null)}
          onYes={async () => {
            const p = dialog.place;
            setDialog(null);
            const res = await api.post(`/places/${p.id}/delete`, { version: p.version });
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

// ---- Offers ---------------------------------------------------------------------------------------------------

const offerToForm = (o: StaffOffer): Values => ({
  partnerName: o.partnerName, termsEn: o.terms.en, termsFr: o.terms.fr, validFrom: o.validFrom ?? '', validTo: o.validTo ?? '', requiresMembership: o.requiresMembership,
  howWeKnowEn: o.howWeKnow.en, howWeKnowFr: o.howWeKnow.fr,
});
const emptyOffer: Values = { partnerName: '', termsEn: '', termsFr: '', validFrom: '', validTo: '', requiresMembership: false, howWeKnowEn: '', howWeKnowFr: '' };
function offerBody(v: Values) {
  const s = (k: string) => (typeof v[k] === 'string' ? (v[k] as string) : '');
  return {
    partnerName: s('partnerName'), termsEn: s('termsEn'), termsFr: s('termsFr'), validFrom: s('validFrom') === '' ? null : s('validFrom'), validTo: s('validTo') === '' ? null : s('validTo'),
    requiresMembership: v['requiresMembership'] === true, howWeKnowEn: s('howWeKnowEn'), howWeKnowFr: s('howWeKnowFr'),
  };
}
const offerSpecs: FieldSpec[] = [
  { key: 'partnerName', label: 'f.partner', kind: 'text', max: LIMITS.name },
  { key: 'termsEn', label: 'f.termsEn', kind: 'area', max: LIMITS.terms },
  { key: 'termsFr', label: 'f.termsFr', kind: 'area', max: LIMITS.terms, help: 'f.frHelp' },
  { key: 'validFrom', label: 'f.validFrom', kind: 'date' },
  { key: 'validTo', label: 'f.validTo', kind: 'date', help: 'f.validHelp' },
  { key: 'requiresMembership', label: 'f.membership', kind: 'check' },
  { key: 'howWeKnowEn', label: 'f.howEn', kind: 'area', max: LIMITS.note, help: 'f.howHelp' },
  { key: 'howWeKnowFr', label: 'f.howFr', kind: 'area', max: LIMITS.note },
];

export function Offers({ api, ctx }: Props) {
  const t = useStaffT();
  const { lang, toast } = useUi();
  const list = useResource<StaffOffer[]>(api, '/offers');
  const [dialog, setDialog] = useState<null | { kind: 'edit'; offer: StaffOffer | null } | { kind: 'delete'; offer: StaffOffer }>(null);
  const [message, setMessage] = useState('');
  const opener = useOpener();
  const admin = ctx.role === 'admin';
  return (
    <>
      <p class="actions">
        <button type="button" class="btn btn-primary" onClick={(e) => { opener.capture(e); setDialog({ kind: 'edit', offer: null }); }}>
          {t('offers.add')}
        </button>
      </p>
      <p class="muted">{t('offers.rule', { days: String(CHECK_LIMIT_DAYS.offers) })}</p>
      {message ? <p class="error" role="alert">{message}</p> : null}
      <Gate state={list.state} reload={list.reload}>
        {(items) =>
          items.length === 0 ? (
            <p class="state">{t('offers.empty')}</p>
          ) : (
            <ul class="cards">
              {items.map((o) => (
                <li key={o.id} class="card">
                  <h2 class="card-title">{o.partnerName}</h2>
                  <p>{pick(o.terms, lang as 'en' | 'fr')}</p>
                  <p class="card-meta">
                    {o.validFrom || o.validTo ? t('offers.valid', { from: o.validFrom ?? '…', to: o.validTo ?? '…' }) : t('offers.noDates')}
                  </p>
                  <p class="card-meta">
                    <strong class={`chip${o.guestState === 'shown' ? '' : ' chip-warn'}`}>{t(`guest.${o.guestState}`, { days: String(CHECK_LIMIT_DAYS.offers) })}</strong>
                  </p>
                  <CheckedLine on={o.verifiedOn} by={o.verifiedBy} overdue={false} placeholder={o.isPlaceholder} tz={ctx.timezone} />
                  <p class="actions">
                    <button type="button" class="btn" onClick={(e) => { opener.capture(e); setDialog({ kind: 'edit', offer: o }); }}>
                      {t('act.edit')}<span class="sr-only"> {o.partnerName}</span>
                    </button>
                    <button
                      type="button"
                      class="btn"
                      onClick={async () => {
                        setMessage('');
                        const res = await api.post(`/offers/${o.id}/reverify`, { version: o.version });
                        if (res.status === 200) toast(t('toast.checked'));
                        else setMessage(errorText(t, res.status, res.error));
                        await list.reload();
                      }}
                    >
                      {t('act.stillCorrect')}<span class="sr-only"> {o.partnerName}</span>
                    </button>
                    {admin ? (
                      <button type="button" class="btn" onClick={(e) => { opener.capture(e); setDialog({ kind: 'delete', offer: o }); }}>
                        {t('act.delete')}<span class="sr-only"> {o.partnerName}</span>
                      </button>
                    ) : null}
                  </p>
                </li>
              ))}
            </ul>
          )
        }
      </Gate>
      {dialog?.kind === 'edit' ? (
        <EditDialog<StaffOffer>
          title={dialog.offer ? t('offers.edit') : t('offers.add')}
          specs={offerSpecs}
          initial={dialog.offer ? offerToForm(dialog.offer) : emptyOffer}
          version={dialog.offer?.version ?? null}
          toBody={offerBody}
          toForm={offerToForm}
          send={(body, version) => (dialog.offer ? api.post(`/offers/${dialog.offer.id}`, { ...(body as object), version }) : api.post('/offers', body))}
          onSaved={() => { setDialog(null); toast(t('toast.saved')); void list.reload(); }}
          onClose={() => setDialog(null)}
          returnFocusTo={opener.ref.current}
        />
      ) : null}
      {dialog?.kind === 'delete' ? (
        <Confirm
          title={t('act.delete')}
          text={t('offers.confirmDelete', { name: dialog.offer.partnerName })}
          yes={t('act.delete')}
          returnFocusTo={opener.ref.current}
          onClose={() => setDialog(null)}
          onYes={async () => {
            const o = dialog.offer;
            setDialog(null);
            const res = await api.post(`/offers/${o.id}/delete`, { version: o.version });
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

// ---- Translations and the property home -----------------------------------------------------------------------

/** Everything with an empty French field, so a small team can see what is left. Read-only: the edit forms hold the fix. */
export function Translations({ api, ctx }: Props) {
  const t = useStaffT();
  const acts = useResource<StaffActivity[]>(api, '/activities');
  const places = useResource<StaffPlace[]>(api, '/places');
  const offers = useResource<StaffOffer[]>(api, '/offers');
  const reload = async () => {
    await Promise.all([acts.reload(), places.reload(), offers.reload()]);
  };
  if (acts.state.status === 'error' || places.state.status === 'error' || offers.state.status === 'error') return <Gate state={{ status: 'error', code: 0 }} reload={reload}>{() => null}</Gate>;
  if (acts.state.status !== 'ready' || places.state.status !== 'ready' || offers.state.status !== 'ready') return <output class="muted">{t('staff.loading')}</output>;
  const missing: { key: string; name: string; where: 'board' | 'places' | 'offers'; what: string[] }[] = [];
  for (const a of acts.state.data) {
    const what = [a.title.fr === '' && t('f.titleFr'), a.description.en !== '' && a.description.fr === '' && t('f.descFr')].filter((x): x is string => typeof x === 'string');
    if (what.length) missing.push({ key: a.id, name: a.title.en, where: 'board', what });
  }
  for (const p of places.state.data) {
    const what = [p.note.en !== '' && p.note.fr === '' && t('f.noteFr'), p.hours.en !== '' && p.hours.fr === '' && t('f.hoursFr'), p.walkTime.en !== '' && p.walkTime.fr === '' && t('f.walkFr')].filter((x): x is string => typeof x === 'string');
    if (what.length) missing.push({ key: p.id, name: p.name, where: 'places', what });
  }
  for (const o of offers.state.data) {
    const what = [o.terms.fr === '' && t('f.termsFr')].filter((x): x is string => typeof x === 'string');
    if (what.length) missing.push({ key: o.id, name: o.partnerName, where: 'offers', what });
  }
  return (
    <>
      <p>{t('tr.intro')}</p>
      {missing.length === 0 ? (
        <p class="state">{t('tr.done')}</p>
      ) : (
        <ul class="cards">
          {missing.map((m) => (
            <li key={m.key} class="card">
              <h2 class="card-title">{m.name}</h2>
              <p class="card-meta">{m.what.join(', ')}</p>
              <Link class="btn" href={`/staff/p/${ctx.slug}/${m.where}`}>
                {t(`nav.${m.where}`)}
                <span class="sr-only">: {m.name}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

/** The first screen of a property: what needs checking, and where to go. */
export function PropertyHome({ api, ctx }: Props) {
  const t = useStaffT();
  const acts = useResource<StaffActivity[]>(api, '/activities');
  const places = useResource<StaffPlace[]>(api, '/places');
  const offers = useResource<StaffOffer[]>(api, '/offers');
  const slug = ctx.slug;
  if (acts.state.status === 'error' || places.state.status === 'error' || offers.state.status === 'error') {
    return <Gate state={{ status: 'error', code: 0 }} reload={async () => { await Promise.all([acts.reload(), places.reload(), offers.reload()]); }}>{() => null}</Gate>;
  }
  if (acts.state.status !== 'ready' || places.state.status !== 'ready' || offers.state.status !== 'ready') return <output class="muted">{t('staff.loading')}</output>;
  const rows = [
    { where: 'board', label: t('home.board', { n: String(acts.state.data.filter((a) => a.check === 'overdue').length) }) },
    { where: 'places', label: t('home.places', { n: String(places.state.data.filter((p) => p.check === 'overdue').length) }) },
    { where: 'offers', label: t('home.offers', { n: String(offers.state.data.filter((o) => o.guestState !== 'shown').length) }) },
  ];
  return (
    <>
      <p>{t('home.intro')}</p>
      <ul class="cards">
        {rows.map((r) => (
          <li key={r.where} class="card">
            <Link class="card-link" href={`/staff/p/${slug}/${r.where}`}>
              {r.label}
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
