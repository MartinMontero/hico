import type { ComponentChildren } from 'preact';
import { useEffect, useMemo, useState } from 'preact/hooks';
import type { ActivityCategory, PublicActivity, PublicOffer, PublicPlace, PublicProperty, PlaceCategory } from '../../shared/types.ts';
import { pastCheckLimit, type CheckKind } from '../../shared/check-limits.ts';
import { pick } from '../../shared/i18n/index.ts';
import { api } from './api.ts';
import { nowMs, nowSeconds } from './clock.ts';
import { mapsUrl } from './links.ts';
import { usePlan } from './plan.ts';
import { matches } from './search.ts';
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

/**
 * "Checked by staff on 12 October" (09 §2): the date only, never a name. Past the limit for its kind (shared\check-limits.ts,
 * D-33) it says to check at the desk, so an old item never looks current. "now" is epoch seconds, for tests.
 */
export function Stamp({ verifiedOn, timeZone, kind, now = nowSeconds() }: { verifiedOn: number | null; timeZone: string; kind: CheckKind; now?: number }) {
  const { t, lang } = useUi();
  if (verifiedOn === null) return <p class="stamp">{t('stamp.notChecked')}</p>;
  const date = formatDay(ymdInZone(new Date(verifiedOn * 1000), timeZone), lang, { day: 'numeric', month: 'long' });
  const stale = pastCheckLimit(verifiedOn, now, kind);
  return <p class="stamp">{t(stale ? 'stamp.stale' : 'stamp.checked', { date })}</p>;
}
export function FeatureOff({ comingLater }: { comingLater: boolean }) {
  const { t } = useUi();
  return <p class="state">{comingLater ? t('state.comingLater') : t('state.featureOff')}</p>;
}

const ACTIVITY_CATEGORIES: ActivityCategory[] = ['adventure', 'social', 'wellness', 'culture', 'outdoor'];

function SearchBox({ id, label, value, onInput }: { id: string; label: string; value: string; onInput: (v: string) => void }) {
  return (
    <div class="field">
      <label for={id}>{label}</label>
      <input id={id} type="search" autoComplete="off" value={value} onInput={(e) => onInput((e.target as HTMLInputElement).value)} />
    </div>
  );
}

function Pills<K extends string>({ label, all, cats, value, onChange }: { label: string; all: string; cats: readonly K[]; value: K | 'all'; onChange: (v: K | 'all') => void }) {
  const { t } = useUi();
  return (
    <ul class="pills" aria-label={label}>
      {(['all', ...cats] as const).map((cat) => (
        <li key={cat}>
          <button type="button" class="pill" aria-pressed={value === cat} onClick={() => onChange(cat)}>
            {cat === 'all' ? all : t(`category.${cat}` as 'category.food')}
          </button>
        </li>
      ))}
    </ul>
  );
}

export function WhatsOn({ property }: { property: PublicProperty }) {
  const { t, lang, toast } = useUi();
  const loaded = useLoad(`activities:${property.slug}`, () => api.activities(property.slug));
  const days = useMemo(() => weekFrom(new Date(nowMs()), property.timezone), [property.timezone]);
  const [selected, setSelected] = useState(days[0] ?? '');
  const [cat, setCat] = useState<ActivityCategory | 'all'>('all');
  const [query, setQuery] = useState('');
  const [onlyPlan, setOnlyPlan] = useState(false);
  const { plan, toggle } = usePlan(property.slug);

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
      <Pills label={t('explore.filter')} all={t('explore.all')} cats={ACTIVITY_CATEGORIES} value={cat} onChange={setCat} />
      <SearchBox id="search-whatson" label={t('search.whatsOn')} value={query} onInput={setQuery} />
      <p>
        <button type="button" class="btn" aria-pressed={onlyPlan} onClick={() => setOnlyPlan(!onlyPlan)}>
          {t('whatson.onlyPlan')}
        </button>
      </p>
      <LoadState loaded={loaded}>
        {(all: PublicActivity[]) => {
          const today = selected === days[0];
          const day = occurrencesOn(selected, all, property.timezone);
          const items = day
            .filter(({ activity }) => cat === 'all' || activity.category === cat)
            .filter(({ activity }) => !onlyPlan || plan.has(activity.id))
            .filter(({ activity }) =>
              matches(query, [pick(activity.title, lang), pick(activity.description, lang), activity.zone ? pick(activity.zone, lang) : '', activity.hostLabel]),
            );
          if (items.length === 0) {
            const text = onlyPlan ? t('whatson.planEmpty') : day.length > 0 ? t('search.empty') : today ? t('whatson.empty') : t('whatson.emptyDay');
            return <p class="state">{text}</p>;
          }
          return (
            <ul class="cards">
              {items.map(({ activity, start, cancelled }) => {
                const title = pick(activity.title, lang);
                return (
                  <li key={activity.id} class={cancelled ? 'card cancelled' : 'card'}>
                    <h2 class="card-title">{title}</h2>
                    <p class="card-meta">
                      <time>{formatLocalTime(start, lang)}</time>
                      {cancelled ? <span class="badge badge-warn">{t('whatson.cancelled')}</span> : null}
                    </p>
                    {activity.description.en || activity.description.fr ? <p>{pick(activity.description, lang)}</p> : null}
                    {activity.zone ? <p class="muted">{t('whatson.meets', { place: pick(activity.zone, lang) })}</p> : null}
                    {activity.hostLabel ? <p class="muted">{t('whatson.host', { name: activity.hostLabel })}</p> : null}
                    <Stamp verifiedOn={activity.verifiedOn} timeZone={property.timezone} kind="board" />
                    <p>
                      <button
                        type="button"
                        class="btn"
                        aria-pressed={plan.has(activity.id)}
                        onClick={() => toast(t(toggle(activity.id) ? 'whatson.planAdded' : 'whatson.planRemoved'))}
                      >
                        {t('whatson.imIn')}
                        <span class="sr-only">: {title}</span>
                      </button>
                    </p>
                  </li>
                );
              })}
            </ul>
          );
        }}
      </LoadState>
    </section>
  );
}

const PLACE_CATEGORIES: PlaceCategory[] = ['trails', 'food', 'drinks', 'culture', 'adventure'];

function dateOf(epochSeconds: number, property: PublicProperty, lang: string): string {
  return formatDay(ymdInZone(new Date(epochSeconds * 1000), property.timezone), lang, { day: 'numeric', month: 'long' });
}

function OfferCard({ offer, property }: { offer: PublicOffer; property: PublicProperty }) {
  const { t, lang } = useUi();
  const validity =
    offer.validFrom !== null && offer.validTo !== null
      ? t('offer.valid', { from: dateOf(offer.validFrom, property, lang), to: dateOf(offer.validTo, property, lang) })
      : offer.validFrom !== null
        ? t('offer.validFrom', { from: dateOf(offer.validFrom, property, lang) })
        : offer.validTo !== null
          ? t('offer.validUntil', { to: dateOf(offer.validTo, property, lang) })
          : '';
  return (
    <li class="card">
      <h3 class="card-title">{offer.partnerName}</h3>
      <p>{pick(offer.terms, lang)}</p>
      {validity ? <p class="muted">{validity}</p> : null}
      {offer.requiresMembership ? <p class="muted"><span class="badge badge-pick">{t('offer.membership')}</span></p> : null}
      {offer.howWeKnow.en || offer.howWeKnow.fr ? <p class="muted">{t('offer.howWeKnow', { text: pick(offer.howWeKnow, lang) })}</p> : null}
      <Stamp verifiedOn={offer.verifiedOn} timeZone={property.timezone} kind="offers" />
    </li>
  );
}

export function Explore({ property }: { property: PublicProperty }) {
  const { t, lang } = useUi();
  const loaded = useLoad(`places:${property.slug}`, () => api.places(property.slug));
  const offersLoaded = useLoad(`offers:${property.slug}`, () => api.offers(property.slug));
  const [filter, setFilter] = useState<PlaceCategory | 'all'>('all');
  const [query, setQuery] = useState('');

  useEffect(() => {
    void api.event(property.slug, 'opened_explore');
  }, [property.slug]);
  useEffect(() => {
    if (offersLoaded.status === 'ready' && offersLoaded.data.length > 0) void api.event(property.slug, 'offer_shown');
  }, [offersLoaded.status, property.slug]);

  return (
    <section aria-labelledby="page-title">
      <h1 id="page-title" tabIndex={-1} data-page-heading>
        {t('explore.title')}
      </h1>
      <Pills label={t('explore.filter')} all={t('explore.all')} cats={PLACE_CATEGORIES} value={filter} onChange={setFilter} />
      <SearchBox id="search-explore" label={t('search.explore')} value={query} onInput={setQuery} />
      <h2>{t('explore.places')}</h2>
      <LoadState loaded={loaded}>
        {(all: PublicPlace[]) => {
          const shown = all
            .filter((p) => filter === 'all' || p.category === filter)
            .filter((p) => matches(query, [p.name, pick(p.note, lang), pick(p.walkTime, lang), pick(p.hours, lang), t(`category.${p.category}`)]));
          if (shown.length === 0) return <p class="state">{all.length === 0 ? t('explore.empty') : t('search.empty')}</p>;
          return (
            <ul class="cards">
              {shown.map((place) => (
                <li key={place.id} class="card">
                  <h3 class="card-title">
                    {place.name}
                    {place.staffPick ? <span class="badge badge-pick">{t('explore.staffPick')}</span> : null}
                  </h3>
                  {place.note.en || place.note.fr ? <p>{pick(place.note, lang)}</p> : null}
                  {place.walkTime.en || place.walkTime.fr ? <p class="muted">{t('explore.walk', { time: pick(place.walkTime, lang) })}</p> : null}
                  {place.hours.en || place.hours.fr ? <p class="muted">{t('explore.hours', { hours: pick(place.hours, lang) })}</p> : null}
                  {place.phone ? <p class="muted">{t('explore.phone', { phone: place.phone })}</p> : null}
                  <Stamp verifiedOn={place.verifiedOn} timeZone={property.timezone} kind="places" />
                  {place.mapsAddress ? (
                    <p>
                      <a class="btn" href={mapsUrl(place.mapsAddress)} target="_blank" rel="noopener noreferrer">
                        {t('explore.maps')}
                        <span class="sr-only">
                          : {place.name} {t('explore.mapsNewTab')}
                        </span>
                      </a>
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          );
        }}
      </LoadState>
      <h2>{t('explore.offers')}</h2>
      <LoadState loaded={offersLoaded}>
        {(all: PublicOffer[]) => {
          const shown = all.filter((o) => matches(query, [o.partnerName, pick(o.terms, lang)]));
          if (shown.length === 0) return <p class="state">{all.length === 0 ? t('explore.offersEmpty') : t('search.empty')}</p>;
          return (
            <ul class="cards">
              {shown.map((o) => (
                <OfferCard key={o.id} offer={o} property={property} />
              ))}
            </ul>
          );
        }}
      </LoadState>
    </section>
  );
}