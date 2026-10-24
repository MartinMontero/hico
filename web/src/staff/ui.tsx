import { useEffect, useId, useRef, useState } from 'preact/hooks';
import type { StaffKey } from '../../../shared/i18n/staff-en.ts';
import { Dialog } from '../Dialog.tsx';
import { consumeNavigation } from '../router.tsx';
import type { StaffResult } from './api.ts';
import { useStaffT, type StaffT } from './t.ts';

/** The page heading: the title, and where focus goes after a move to another screen. */
export function Heading({ children }: { children: string }) {
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    document.title = children;
    if (consumeNavigation()) ref.current?.focus({ preventScroll: true });
  }, [children]);
  return (
    <h1 ref={ref} tabIndex={-1} data-page-heading>
      {children}
    </h1>
  );
}

/** After a delete the control that opened the dialog is gone: focus goes to the page heading. */
export function focusHeading(): void {
  document.querySelector<HTMLElement>('[data-page-heading]')?.focus({ preventScroll: true });
}

/** Remembers the control that opened a dialog so focus can return to it (Safari does not focus buttons on click). */
export function useOpener() {
  const ref = useRef<HTMLElement | null>(null);
  return { ref, capture: (event: Event) => void (ref.current = event.currentTarget instanceof HTMLElement ? event.currentTarget : null) };
}

export type Values = Record<string, string | boolean>;
export interface Option {
  value: string;
  label: string;
}
export interface FieldSpec {
  key: string;
  label: StaffKey;
  kind: 'text' | 'area' | 'select' | 'check' | 'date' | 'time' | 'number';
  max?: number;
  options?: Option[];
  help?: StaffKey;
  show?: (values: Values) => boolean;
}

/** One form control with its visible label and, when there is one, its help text tied to it. */
function Control({ spec, value, set }: { spec: FieldSpec; value: string | boolean; set: (v: string | boolean) => void }) {
  const t = useStaffT();
  const id = useId();
  const helpId = `${id}-help`;
  const describedBy = spec.help ? helpId : undefined;
  const help = spec.help ? (
    <p id={helpId} class="muted">
      {t(spec.help)}
    </p>
  ) : null;
  if (spec.kind === 'check') {
    return (
      <div class="field">
        <label class="radio" for={id}>
          <input id={id} type="checkbox" checked={value === true} aria-describedby={describedBy} onChange={(e) => set((e.target as HTMLInputElement).checked)} />
          <span>{t(spec.label)}</span>
        </label>
        {help}
      </div>
    );
  }
  const text = typeof value === 'string' ? value : '';
  return (
    <div class="field">
      <label for={id}>{t(spec.label)}</label>
      {spec.kind === 'area' ? (
        <textarea id={id} maxLength={spec.max} value={text} aria-describedby={describedBy} onInput={(e) => set((e.target as HTMLTextAreaElement).value)} />
      ) : spec.kind === 'select' ? (
        <select id={id} value={text} aria-describedby={describedBy} onChange={(e) => set((e.target as HTMLSelectElement).value)}>
          {(spec.options ?? []).map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      ) : (
        <input
          id={id}
          // Preact's union of input attribute sets cannot take a computed type; the kinds here are all plain input types.
          type={spec.kind as 'text'}
          maxLength={spec.max}
          value={text}
          autoComplete="off"
          aria-describedby={describedBy}
          onInput={(e) => set((e.target as HTMLInputElement).value)}
        />
      )}
      {help}
    </div>
  );
}

export function Fields({ specs, values, set }: { specs: FieldSpec[]; values: Values; set: (key: string, v: string | boolean) => void }) {
  return (
    <>
      {specs
        .filter((s) => !s.show || s.show(values))
        .map((s) => (
          <Control key={s.key} spec={s} value={values[s.key] ?? ''} set={(v) => set(s.key, v)} />
        ))}
    </>
  );
}

/** Plain-language text for what a failed request means. */
export function errorText(t: StaffT, status: number, code: string | null): string {
  if (status === 401) return t('err.signedOut');
  if (status === 403) return t('err.forbidden');
  if (status === 404) return t('err.gone');
  if (status === 429) return t('staff.rateLimited');
  if (code === 'bad_zone') return t('err.badZone');
  if (code === 'end_before_start') return t('err.endBeforeStart');
  if (code === 'owner_only') return t('err.ownerOnly');
  if (code === 'in_use') return t('err.inUse');
  if (code === 'last_admin') return t('err.lastAdmin');
  if (code === 'needs_operator') return t('err.needsOperator');
  if (code === 'already_member') return t('err.alreadyMember');
  if (status === 400) return t('err.invalid');
  if (status === 409) return t('err.conflictPlain');
  return t('staff.error');
}

function show(t: StaffT, value: string | boolean | undefined): string {
  if (value === true) return t('diff.yes');
  if (value === false) return t('diff.no');
  return value === undefined || value === '' ? t('diff.empty') : value;
}

interface EditDialogProps<T extends { version: number }> {
  title: string;
  specs: FieldSpec[];
  initial: Values;
  version: number | null;
  toBody: (values: Values) => unknown;
  toForm: (entity: T) => Values;
  send: (body: unknown, version: number | null) => Promise<StaffResult<T>>;
  onSaved: (entity: T) => void;
  onClose: () => void;
  returnFocusTo: HTMLElement | null;
}

/**
 * The create and edit form. The save carries the version the person started from; if someone else saved first
 * the server answers 409 with the current record, and the person sees both side by side and chooses.
 */
export function EditDialog<T extends { version: number }>(props: EditDialogProps<T>) {
  const t = useStaffT();
  const [values, setValues] = useState<Values>(props.initial);
  const [version, setVersion] = useState(props.version);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [conflict, setConflict] = useState<T | null>(null);

  const submit = async (event: Event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    const res = await props.send(props.toBody(values), version);
    setBusy(false);
    if (res.status === 200 && res.data) props.onSaved(res.data);
    else if (res.status === 409 && res.error === 'conflict' && res.body && typeof res.body === 'object' && 'current' in res.body) setConflict((res.body as { current: T }).current);
    else setError(errorText(t, res.status, res.error));
  };

  if (conflict) {
    const theirs = props.toForm(conflict);
    const differing = props.specs.filter((s) => (!s.show || s.show(values) || s.show(theirs)) && (values[s.key] ?? '') !== (theirs[s.key] ?? ''));
    return (
      <Dialog key="conflict" open onClose={props.onClose} title={t('conflict.title')} returnFocusTo={props.returnFocusTo}>
        <p>{t('conflict.intro')}</p>
        {differing.length === 0 ? <p class="muted">{t('conflict.same')}</p> : null}
        <ul class="cards">
          {differing.map((s) => (
            <li key={s.key} class="card">
              <p>
                <strong>{t(s.label)}</strong>
              </p>
              <p>
                <span class="muted">{t('conflict.yours')}: </span>
                {show(t, values[s.key])}
              </p>
              <p>
                <span class="muted">{t('conflict.saved')}: </span>
                {show(t, theirs[s.key])}
              </p>
            </li>
          ))}
        </ul>
        <p class="actions">
          <button
            type="button"
            class="btn btn-primary"
            onClick={() => {
              setVersion(conflict.version);
              setConflict(null);
            }}
          >
            {t('conflict.keepMine')}
          </button>
          <button
            type="button"
            class="btn"
            onClick={() => {
              setValues(theirs);
              setVersion(conflict.version);
              setConflict(null);
            }}
          >
            {t('conflict.useSaved')}
          </button>
          <button type="button" class="btn" onClick={props.onClose}>
            {t('form.cancel')}
          </button>
        </p>
        <p class="muted">{t('conflict.keepHelp')}</p>
      </Dialog>
    );
  }

  return (
    <Dialog key="form" open onClose={props.onClose} title={props.title} returnFocusTo={props.returnFocusTo}>
      <form onSubmit={submit}>
        <Fields specs={props.specs} values={values} set={(k, v) => setValues((cur) => ({ ...cur, [k]: v }))} />
        {error ? (
          <p class="error" role="alert">
            {error}
          </p>
        ) : null}
        <p class="actions">
          <button type="submit" class="btn btn-primary" disabled={busy}>
            {busy ? t('form.saving') : t('form.save')}
          </button>
          <button type="button" class="btn" onClick={props.onClose}>
            {t('form.cancel')}
          </button>
        </p>
      </form>
    </Dialog>
  );
}

/** A yes/no question in a dialog. */
export function Confirm(props: { title: string; text: string; yes: string; onYes: () => void; onClose: () => void; returnFocusTo: HTMLElement | null; error?: string }) {
  const t = useStaffT();
  return (
    <Dialog open onClose={props.onClose} title={props.title} returnFocusTo={props.returnFocusTo}>
      <p>{props.text}</p>
      {props.error ? (
        <p class="error" role="alert">
          {props.error}
        </p>
      ) : null}
      <p class="actions">
        <button type="button" class="btn btn-primary" onClick={props.onYes}>
          {props.yes}
        </button>
        <button type="button" class="btn" onClick={props.onClose}>
          {t('form.cancel')}
        </button>
      </p>
    </Dialog>
  );
}
