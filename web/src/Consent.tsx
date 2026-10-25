import { useUi } from './context.tsx';

// The consent screen pattern of 06 §5, built once and not wired to anything: consent rows are written when guest sessions
// exist (Phase 5). Five facts in a fixed order; "Not now" and "Turn on" are the same size and weight; nothing is
// pre-selected; the wording version is shown (it will be stored with the consent, so a change re-asks).
export interface ConsentFacts {
  what: string;
  shared: string;
  with: string;
  kept: string;
  stop: string;
}

export function Consent(props: {
  title: string;
  facts: ConsentFacts;
  /** The version of this wording. */
  version: string;
  /** Who holds the data, when the Quebec Act applies (06 §3, counsel `[U]`); omitted until then. */
  holder?: string;
  onTurnOn: () => void;
  onNotNow: () => void;
}) {
  const { t } = useUi();
  const rows = [
    ['consent.what', props.facts.what],
    ['consent.shared', props.facts.shared],
    ['consent.with', props.facts.with],
    ['consent.kept', props.facts.kept],
    ['consent.stop', props.facts.stop],
  ] as const;
  return (
    <section aria-labelledby="consent-title" class="consent">
      <h2 id="consent-title">{props.title}</h2>
      <dl>
        {rows.map(([key, text]) => (
          <div key={key}>
            <dt>{t(key)}</dt>
            <dd>{text}</dd>
          </div>
        ))}
      </dl>
      {props.holder ? <p class="muted">{t('consent.holder', { holder: props.holder })}</p> : null}
      <p class="muted">{t('consent.version', { version: props.version })}</p>
      <p class="actions">
        <button type="button" class="btn consent-choice" onClick={props.onNotNow}>
          {t('consent.notNow')}
        </button>
        <button type="button" class="btn consent-choice" onClick={props.onTurnOn}>
          {t('consent.turnOn')}
        </button>
      </p>
    </section>
  );
}