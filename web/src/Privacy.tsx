import type { PublicProperty } from '../../shared/types.ts';
import { useUi } from './context.tsx';

// 04 §4.3 and the matrix in 06 §1.1: every feature that would use anything about the guest. In Stage 0 none is available,
// so every switch is off and disabled. Features that are an action each time, not a standing switch, say so.
const FEATURES = [
  { id: 'session', hasSwitch: true },
  { id: 'adult', hasSwitch: true },
  { id: 'commonRoom', hasSwitch: true },
  { id: 'sendSignals', hasSwitch: true },
  { id: 'seeSignals', hasSwitch: true },
  { id: 'reply', hasSwitch: true },
  { id: 'shareName', hasSwitch: true },
  { id: 'checkHere', hasSwitch: false },
  { id: 'wallet', hasSwitch: false },
] as const;

export function PrivacyContact({ property }: { property: PublicProperty | null }) {
  const { t } = useUi();
  const c = property?.privacyContact;
  const set = c && (c.title !== '' || c.address !== '');
  return (
    <section aria-labelledby="privacy-contact-h">
      <h3 id="privacy-contact-h">{t('privacy.contact.title')}</h3>
      {set ? (
        <p>
          {c.title}
          {c.title && c.address ? ', ' : ''}
          {c.address}
        </p>
      ) : (
        <p class="band" role="note" data-missing="privacy-contact">
          {t('privacy.contact.none')}
        </p>
      )}
    </section>
  );
}

export function Privacy({ property }: { property: PublicProperty | null }) {
  const { t } = useUi();
  return (
    <section aria-labelledby="privacy-h">
      <h3 id="privacy-h">{t('settings.privacy')}</h3>
      <p>{t('privacy.stage0')}</p>
      <p class="muted">{t('privacy.intro')}</p>
      <ul class="cards">
        {FEATURES.map(({ id, hasSwitch }) => (
          <li key={id} class="card">
            {hasSwitch ? (
              <label class="radio" for={`feature-${id}`}>
                <input id={`feature-${id}`} type="checkbox" role="switch" aria-checked={false} checked={false} disabled aria-describedby={`feature-${id}-note`} />
                <span>{t(`feature.${id}.name`)}</span>
              </label>
            ) : (
              <p>
                <strong>{t(`feature.${id}.name`)}</strong>
              </p>
            )}
            <p id={`feature-${id}-note`} class="muted">
              {hasSwitch ? t('privacy.unavailable') : t('privacy.noSwitch')}
            </p>
            <details>
              <summary>{t('privacy.details')}</summary>
              <dl>
                {(['what', 'shared', 'with', 'kept', 'stop'] as const).map((fact) => (
                  <div key={fact}>
                    <dt>{t(`consent.${fact}`)}</dt>
                    <dd>{t(`feature.${id}.${fact}`)}</dd>
                  </div>
                ))}
              </dl>
            </details>
          </li>
        ))}
      </ul>
      <PrivacyContact property={property} />
    </section>
  );
}