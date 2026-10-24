import type { ComponentChildren } from 'preact';
import { useEffect, useMemo, useState } from 'preact/hooks';
import type { PublicActivity, PublicPlace, PublicProperty, PlaceCategory } from '../../shared/types.ts';
import { pick } from '../../shared/i18n/index.ts';
import { api } from './api.ts';
import { useUi } from './context.tsx';
import { useLoad, type Loaded } from './load.ts';
import { formatDay, formatLocalTime, occurrencesOn, weekFrom, ymdInZone } from './time.ts';

export function LoadState<T>({ loaded, children }: { loaded: Loaded<T>; children: (data: T) => ComponentChildren }) {
  const { t } = useUi();
  if (loaded.status === 'loading') {
    return (
      <output class="muted">{t('state.loading')}</output>
    );
  }
  if (loaded.status === 'error') {
    return (
      <div class="state">
        <p>{navigator.onLine ? t('state.error') : t('state.offline')}</p>
        <button type="button" class="btn" onClick={loaded.retry}>
          {t('state.retry')}
        </button>
      </div>
    );
  }
  return <>{children(loaded.data)}</>;
}

function Stamp({ verifiedOn, verifiedBy, timeZone }: { verifiedOn: number | null; verifiedBy: string | null; timeZone: string }) {
  const { t, lang } = useUi();
  if (verifiedOn === null) return <p class="stamp">{t('stamp.notChecked')}</p>;
  const date = formatDay(ymdInZone(new Date(verifiedOn * 1000), timeZone), lang, { day: 'numeric', month: 'long' });
  return (
    <p class="stamp">
      {t('stamp.checked', { date })}
      {verifiedBy ? ` (${verifiedBy})` : ''}
    </p>
  );
}

export function FeatureOff({ comingLater }: { comingLater: boolean }) {
  const { t } = useUi();
  return <p class="state">{comingLater ? t('state.comingLater') : t('state.featureOff')}</p>;
}

export function WhatsOn({ property }: { property: PublicProperty }) {
  const { t, lang } = useUi();
  const loaded = useLoad(`activities:${property.slug}`, () => api.activities(property.slug));
  const days = useMemo(() => weekFrom(new Date(), property.timezone), [property.timezone]);
  const [selected, setSelected] = useState(days[0] ?? '');

  useEffect(() => {
    void api.event(property.slug, 'opened_whats_on');
  }, [property.slug]);

  return (
    <section aria-labelledby="page-title">
      <h1 id="page-title" tabIndex={-1} data-page-heading>
        {t('whatson.title')}
      </h1>
      <ul class="day-strip" aria-label={t('whatson.days')}>
        {days.map((day, index) => (
          <li key={day}>
            <button
              type="button"
              class={index === 0 ? 'day today' : 'day'}
              aria-pressed={day === selected}
              onClick={() => setSelected(day)}
            >
              <span class="day-name">{formatDay(day, lang, { weekday: 'short' })}</span>
              <span class="day-num">{formatDay(day, lang, { day: 'numeric' })}</span>{index === 0 ? <span class="sr-only">, {t('whatson.today')}</span> : null}
            </button>
          </li>
        ))}
      </ul>
      <LoadState loaded={loaded}>
        {(all: PublicActivity[]) => {
          const items = occurrencesOn(selected, all, property.timezone);
          if (items.length === 0) {
            return <p class="state">{selected === days[0] ? t('whatson.empty') : t('whatson.emptyDay')}</p>;
          }
          return (
            <ul class="cards">
              {items.map(({ activity, start, cancelled }) => (
                <li key={activity.id} class={cancelled ? 'card cancelled' : 'card'}>
                  <h2 class="card-title">{pick(activity.title, lang)}</h2>
                  <p class="card-meta">
                    <time>{formatLocalTime(start, lang)}</time>
                    {cancelled ? <span class="badge badge-warn">{t('whatson.cancelled')}</span> : null}
                  </p>
                  {activity.description.en || activity.description.fr ? <p>{pick(activity.description, lang)}</p> : null}
                  {activity.zone ? <p class="muted">{t('whatson.meets', { place: pick(activity.zone, lang) })}</p> : null}
                  {activity.hostLabel ? <p class="muted">{t('whatson.host', { name: activity.hostLabel })}</p> : null}
                  <Stamp verifiedOn={activity.verifiedOn} verifiedBy={activity.verifiedBy} timeZone={property.timezone} />
                </li>
              ))}
            </ul>
          );
        }}
      </LoadState>
    </section>
  );
}

const PLACE_CATEGORIES: PlaceCategory[] = ['trails', 'food', 'drinks', 'culture', 'adventure'];

export function Explore({ property }: { property: PublicProperty }) {
  const { t, lang } = useUi();
  const loaded = useLoad(`places:${property.slug}`, () => api.places(property.slug));
  const [filter, setFilter] = useState<PlaceCategory | 'all'>('all');

  useEffect(() => {
    void api.event(property.slug, 'opened_explore');
  }, [property.slug]);

  return (
    <section aria-labelledby="page-title">
      <h1 id="page-title" tabIndex={-1} data-page-heading>
        {t('explore.title')}
      </h1>
      <ul class="pills" aria-label={t('explore.filter')}>
        {(['all', ...PLACE_CATEGORIES] as const).map((cat) => (
          <li key={cat}>
            <button type="button" class="pill" aria-pressed={filter === cat} onClick={() => setFilter(cat)}>
              {cat === 'all' ? t('explore.all') : t(`category.${cat}`)}
            </button>
          </li>
        ))}
      </ul>
      <LoadState loaded={loaded}>
        {(all: PublicPlace[]) => {
          const shown = all.filter((p) => filter === 'all' || p.category === filter);
          if (shown.length === 0) return <p class="state">{t('explore.empty')}</p>;
          return (
            <ul class="cards">
              {shown.map((place) => (
                <li key={place.id} class="card">
                  <h2 class="card-title">
                    {place.name}
                    {place.staffPick ? <span class="badge badge-pick">{t('explore.staffPick')}</span> : null}
                  </h2>
                  {place.note.en || place.note.fr ? <p>{pick(place.note, lang)}</p> : null}
                  {place.walkTime.en || place.walkTime.fr ? <p class="muted">{t('explore.walk', { time: pick(place.walkTime, lang) })}</p> : null}
                  {place.hours.en || place.hours.fr ? <p class="muted">{t('explore.hours', { hours: pick(place.hours, lang) })}</p> : null}
                  {place.phone ? <p class="muted">{t('explore.phone', { phone: place.phone })}</p> : null}
                  <Stamp verifiedOn={place.verifiedOn} verifiedBy={place.verifiedBy} timeZone={property.timezone} />
                </li>
              ))}
            </ul>
          );
        }}
      </LoadState>
    </section>
  );
}
