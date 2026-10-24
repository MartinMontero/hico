import { useEffect, useRef, useState } from 'preact/hooks';
import type { Language } from '../../shared/schemas.ts';
import type { PublicProperty } from '../../shared/types.ts';
import { pick } from '../../shared/i18n/index.ts';
import { api } from './api.ts';
import { ToastRegion, UiProvider, useUi } from './context.tsx';
import { Dialog } from './Dialog.tsx';
import { useLoad } from './load.ts';
import { Explore, FeatureOff, LoadState, WhatsOn } from './pages.tsx';
import { consumeNavigation, Link, navigate, parseRoute, tabPath, usePath, type Tab } from './router.tsx';

const TAB_LABEL = {
  'whats-on': 'nav.whatsOn',
  explore: 'nav.explore',
  'common-room': 'nav.commonRoom',
  connect: 'nav.connect',
} as const;
const TAB_ORDER: Tab[] = ['whats-on', 'explore', 'common-room', 'connect'];

function SettingsDialog({ open, onClose, opener }: { open: boolean; onClose: () => void; opener: HTMLElement | null }) {
  const { t, lang, setLang, toast } = useUi();
  const choose = (next: Language) => {
    setLang(next);
    // The message is built in the new language so it is announced in it.
    toast(next === 'fr' ? 'Langue : Français' : 'Language set to English');
  };
  return (
    <Dialog open={open} onClose={onClose} title={t('settings.title')} returnFocusTo={opener}>
      <fieldset class="field">
        <legend>{t('settings.language')}</legend>
        {(['en', 'fr'] as const).map((code) => (
          <label key={code} class="radio">
            <input type="radio" name="language" value={code} checked={lang === code} onChange={() => choose(code)} />
            <span>{t(`lang.${code}`)}</span>
          </label>
        ))}
      </fieldset>
      <p class="muted">{t('settings.note')}</p>
      <button type="button" class="btn btn-primary" onClick={onClose}>
        {t('settings.close')}
      </button>
    </Dialog>
  );
}

function Shell({ slug, tab, property }: { slug: string; tab: Tab; property: PublicProperty }) {
  const { t, lang } = useUi();
  const main = useRef<HTMLElement>(null);
  const name = pick(property.name, lang);

  // The title carries the tab and the property.
  useEffect(() => {
    document.title = `${t(TAB_LABEL[tab])} · ${name}`;
  }, [tab, name, lang]);

  // After the guest moves to another tab, focus goes to its heading. Not on first load.
  useEffect(() => {
    if (consumeNavigation()) main.current?.querySelector<HTMLElement>('[data-page-heading]')?.focus({ preventScroll: true });
  }, [tab]);

  return (
    <>
      <nav class="tabs" aria-label={t('nav.label')}>
        <ul>
          {TAB_ORDER.map((id) => (
            <li key={id}>
              <Link href={tabPath(slug, id)} aria-current={id === tab ? 'page' : undefined}>
                {t(TAB_LABEL[id])}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      {property.hasPlaceholders ? (
        <p class="band" role="note">
          {t('sample.band')}
        </p>
      ) : null}
      <main id="main" ref={main}>
        {tab === 'whats-on' ? <WhatsOn property={property} /> : null}
        {tab === 'explore' ? <Explore property={property} /> : null}
        {tab === 'common-room' || tab === 'connect' ? (
          <section aria-labelledby="page-title">
            <h1 id="page-title" tabIndex={-1} data-page-heading>
              {t(TAB_LABEL[tab])}
            </h1>
            <FeatureOff comingLater={property.features[tab === 'common-room' ? 'common_room' : 'connect']} />
          </section>
        ) : null}
      </main>
    </>
  );
}

function NotFound() {
  const { t } = useUi();
  useEffect(() => {
    document.title = t('state.notFound');
  }, [t]);
  return (
    <main id="main">
      <h1 tabIndex={-1} data-page-heading>
        {t('state.notFound')}
      </h1>
      <Link href="/" class="btn">
        {t('state.notFoundBack')}
      </Link>
    </main>
  );
}

function Picker() {
  const { t, lang } = useUi();
  const loaded = useLoad('host-properties', () => api.hostProperties());
  useEffect(() => {
    document.title = t('picker.title');
    if (loaded.status === 'ready' && loaded.data.length === 1 && loaded.data[0]) {
      navigate(tabPath(loaded.data[0].slug, 'whats-on'), true);
    }
  }, [loaded.status, lang]);
  return (
    <main id="main">
      <h1 tabIndex={-1} data-page-heading>
        {t('picker.title')}
      </h1>
      <LoadState loaded={loaded}>
        {(choices) =>
          choices.length === 0 ? (
            <p class="state">{t('picker.empty')}</p>
          ) : (
            <ul class="cards">
              {choices.map((c) => (
                <li key={c.slug} class="card">
                  <Link class="card-link" href={tabPath(c.slug, 'whats-on')}>
                    {pick(c.name, lang)}
                  </Link>
                </li>
              ))}
            </ul>
          )
        }
      </LoadState>
    </main>
  );
}

function PropertyRoute({ slug, tab }: { slug: string; tab: Tab | null }) {
  const loaded = useLoad(`config:${slug}`, () => api.config(slug));
  useEffect(() => {
    if (tab === null) navigate(tabPath(slug, 'whats-on'), true);
  }, [tab, slug]);
  if (loaded.status === 'error' && loaded.notFound) return <NotFound />;
  return (
    <LoadState loaded={loaded}>
      {(property) => <Shell slug={slug} tab={tab ?? 'whats-on'} property={property} />}
    </LoadState>
  );
}

function Header({ onSettings, slug }: { onSettings: (opener: HTMLElement) => void; slug: string | null }) {
  const { t, lang } = useUi();
  const loaded = useLoad(`header:${slug ?? ''}`, () => (slug ? api.config(slug) : Promise.reject(new Error('none'))));
  // Text only: no logo and no HI mark anywhere (D-21, D-25).
  const name = slug && loaded.status === 'ready' ? pick(loaded.data.name, lang) : '';
  return (
    <header class="header">
      <p class="property-name">{name}</p>
      <button type="button" class="btn btn-quiet" onClick={(event) => onSettings(event.currentTarget)}>
        {t('header.settings')}
      </button>
    </header>
  );
}

function Content() {
  const path = usePath();
  const route = parseRoute(path);
  const { t, toastMessage } = useUi();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settingsOpener = useRef<HTMLElement | null>(null);
  const slug = route.name === 'tab' || route.name === 'property' ? route.slug : null;

  return (
    <>
      <div class="app-content" inert={settingsOpen}>
        <a class="skip" href="#main">
          {t('skip.main')}
        </a>
        <Header
          slug={slug}
          onSettings={(opener) => {
            settingsOpener.current = opener;
            setSettingsOpen(true);
          }}
        />
        {route.name === 'root' ? <Picker /> : null}
        {route.name === 'tab' ? <PropertyRoute slug={route.slug} tab={route.tab} /> : null}
        {route.name === 'property' ? <PropertyRoute slug={route.slug} tab={null} /> : null}
        {route.name === 'unknown' ? <NotFound /> : null}
      </div>
      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} opener={settingsOpener.current} />
      <ToastRegion message={toastMessage} />
    </>
  );
}

export function App() {
  return (
    <UiProvider>
      <Content />
    </UiProvider>
  );
}
