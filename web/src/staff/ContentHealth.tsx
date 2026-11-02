import type { ContentHealthReport } from '../../../shared/content-health.ts';
import { Gate } from './Content.tsx';
import { useResource, type Api } from './data.ts';
import { useStaffT } from './t.ts';

/** Admin-only, read-only content health for the property already scoped by useApi. */
export function ContentHealth({ api }: { api: Api }) {
  const t = useStaffT();
  const report = useResource<ContentHealthReport>(api, '/content-health');
  return (
    <>
      <p>{t('health.intro')}</p>
      <Gate state={report.state} reload={report.reload}>
        {(data) => (
          <>
            <ul class="cards" aria-label={t('health.summary')}>
              {data.summaries.map((summary) => (
                <li class="card" key={summary.kind}>
                  <h2 class="card-title">{t(`health.kind.${summary.kind}`)}</h2>
                  <p>{summary.missing ? t('health.missing') : t('health.total', { n: String(summary.total) })}</p>
                  {summary.kind !== 'zones' ? <p class="card-meta">
                    {t('health.checks', {
                      unverified: String(summary.unverified), stale: String(summary.stale), placeholder: String(summary.placeholder),
                    })}
                  </p> : null}
                </li>
              ))}
            </ul>
            <h2>{t('health.items')}</h2>
            {data.items.length === 0 ? <p class="state">{t('health.done')}</p> : (
              <ul class="cards">
                {data.items.map((item) => (
                  <li class="card" key={`${item.kind}-${item.id}`}>
                    <h3 class="card-title">{item.title}</h3>
                    <p class="card-meta">{t(`health.kind.${item.kind}`)}</p>
                    <p>{item.reasons.map((reason) => t(`health.reason.${reason}`)).join(' · ')}</p>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </Gate>
    </>
  );
}
