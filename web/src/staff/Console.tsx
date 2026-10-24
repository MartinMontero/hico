import type { ComponentChildren } from 'preact';
import { useEffect } from 'preact/hooks';
import { pick } from '../../../shared/i18n/index.ts';
import type { StaffKey } from '../../../shared/i18n/staff-en.ts';
import { useUi } from '../context.tsx';
import { Link } from '../router.tsx';
import type { Me } from './api.ts';
import { Audit, Codes, Export, People, Switches, Zones } from './Admin.tsx';
import { Board, Gate, Offers, Places, PropertyHome, Translations } from './Content.tsx';
import { useApi, useResource, type PropertyContext } from './data.ts';
import { useStaffT } from './t.ts';
import { Heading } from './ui.tsx';

interface Section {
  path: string;
  nav: StaffKey;
  title: StaffKey;
  adminOnly: boolean;
}

// Order is the order of the navigation. The admin-only sections are not offered to editors; the server refuses them either way.
const SECTIONS: Section[] = [
  { path: '', nav: 'nav.home', title: 'nav.home', adminOnly: false },
  { path: 'board', nav: 'nav.board', title: 'nav.board', adminOnly: false },
  { path: 'places', nav: 'nav.places', title: 'nav.places', adminOnly: false },
  { path: 'offers', nav: 'nav.offers', title: 'nav.offers', adminOnly: false },
  { path: 'zones', nav: 'nav.zones', title: 'nav.zones', adminOnly: false },
  { path: 'translations', nav: 'nav.translations', title: 'nav.translations', adminOnly: false },
  { path: 'codes', nav: 'nav.codes', title: 'nav.codes', adminOnly: false },
  { path: 'switches', nav: 'nav.switches', title: 'nav.switches', adminOnly: false },
  { path: 'people', nav: 'nav.people', title: 'nav.people', adminOnly: true },
  { path: 'audit', nav: 'nav.audit', title: 'nav.audit', adminOnly: true },
  { path: 'export', nav: 'nav.export', title: 'nav.export', adminOnly: true },
];

export function parseConsolePath(path: string): { slug: string; section: string } | null {
  const m = /^\/staff\/p\/([a-z0-9-]+)(?:\/([a-z-]+))?\/?$/.exec(path);
  return m && m[1] ? { slug: m[1], section: m[2] ?? '' } : null;
}

/** One property's console: its navigation and the section the address names. The role comes from the server on every load. */
export function PropertyConsole({ path, me, onSignedOut }: { path: string; me: Me; onSignedOut: () => void }) {
  const t = useStaffT();
  const { lang } = useUi();
  const parsed = parseConsolePath(path);
  const slug = parsed?.slug ?? '';
  const api = useApi(slug, onSignedOut);
  const info = useResource<{ role: 'editor' | 'admin'; property: { slug: string; name: { en: string; fr: string }; timezone: string } | null }>(api, '/me', parsed !== null);

  useEffect(() => {
    if (info.state.status === 'error' && info.state.code === 401) onSignedOut();
  }, [info.state, onSignedOut]);

  if (!parsed || !me.properties.some((p) => p.slug === slug)) {
    return (
      <main id="main">
        <Heading>{t('console.notFound')}</Heading>
        <p>{t('console.notFoundHelp')}</p>
        <Link class="btn" href="/staff">
          {t('staff.back')}
        </Link>
      </main>
    );
  }

  const section = SECTIONS.find((s) => s.path === parsed.section);
  const name = me.properties.find((p) => p.slug === slug)?.name ?? { en: slug, fr: slug };

  return (
    <main id="main">
      <Heading>{t(section ? section.title : 'console.notFound')}</Heading>
      <p class="muted">{pick(name, lang as 'en' | 'fr')}</p>
      <nav aria-label={t('console.nav')}>
        <ul class="subnav">
          <li>
            <Link class="btn btn-quiet" href="/staff">
              {t('console.allHostels')}
            </Link>
          </li>
          {SECTIONS.filter((s) => !s.adminOnly || (info.state.status === 'ready' && info.state.data.role === 'admin')).map((s) => {
            const href = `/staff/p/${slug}${s.path ? `/${s.path}` : ''}`;
            return (
              <li key={s.path}>
                <Link class="btn btn-quiet" href={href} aria-current={s.path === parsed.section ? 'page' : undefined}>
                  {t(s.nav)}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <Gate state={info.state} reload={info.reload}>
        {(data): ComponentChildren => {
          if (!data.property || !section) {
            return (
              <>
                <p>{t('console.notFoundHelp')}</p>
                <Link class="btn" href={`/staff/p/${slug}`}>
                  {t('staff.back')}
                </Link>
              </>
            );
          }
          const ctx: PropertyContext = { slug, role: data.role, timezone: data.property.timezone, name: data.property.name };
          if (section.adminOnly && ctx.role !== 'admin') return <p class="error">{t('err.forbidden')}</p>;
          const props = { api, ctx };
          switch (section.path) {
            case 'board':
              return <Board {...props} />;
            case 'places':
              return <Places {...props} />;
            case 'offers':
              return <Offers {...props} />;
            case 'zones':
              return <Zones {...props} />;
            case 'translations':
              return <Translations {...props} />;
            case 'codes':
              return <Codes {...props} />;
            case 'switches':
              return <Switches {...props} />;
            case 'people':
              return <People {...props} />;
            case 'audit':
              return <Audit {...props} />;
            case 'export':
              return <Export {...props} />;
            default:
              return <PropertyHome {...props} />;
          }
        }}
      </Gate>
    </main>
  );
}
