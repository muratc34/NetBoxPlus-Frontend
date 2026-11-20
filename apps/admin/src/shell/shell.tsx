import { locales } from '@netboxplus/i18n';
import { classNames, Logo } from '@netboxplus/ui';
import { useId, useState, type ReactNode } from 'react';
import { Navigate, NavLink, Outlet, useLocation } from 'react-router';
import { buttonClass } from '../components/buttons';
import { can, useAdminSession, useAdminSignOut } from '../data/session';
import { useLocale } from '../i18n';
import { paths, sections } from '../paths';

const languageNames = { tr: 'Türkçe', en: 'English' } as const;

/**
 * Every page but signing in: it needs a session (without one, signing in comes first and comes back
 * here), and shows the menu of the sections the session may see, the address, the language and sign out.
 */
export function Shell() {
  const { locale, t, setLocale } = useLocale();
  const location = useLocation();
  const session = useAdminSession();
  const signOut = useAdminSignOut();
  const [menuOpen, setMenuOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const menuId = useId();

  if (session.isPending) {
    return (
      <p aria-busy="true" className="flex min-h-dvh items-center justify-center bg-canvas text-ink-muted">
        {t('browse.loading')}
      </p>
    );
  }
  if (!session.data) {
    // Signing out goes to plain signing in, not back to this page.
    const here = `${location.pathname}${location.search}`;
    const next = leaving || here === paths.home ? '' : `?${new URLSearchParams({ next: here }).toString()}`;
    return <Navigate to={`${paths.signIn}${next}`} replace />;
  }

  const visible = sections.filter((section) => can(session.data, section.permission));

  return (
    <div className="flex min-h-dvh flex-col bg-canvas text-ink md:flex-row">
      <aside className="border-b border-line bg-surface md:w-60 md:shrink-0 md:border-r md:border-b-0">
        <div className="flex h-16 items-center justify-between gap-3 px-4">
          <Logo className="text-xl" />
          <button
            type="button"
            className={classNames(buttonClass('ghost', 'sm'), 'md:hidden')}
            aria-expanded={menuOpen}
            aria-controls={menuId}
            onClick={() => {
              setMenuOpen((open) => !open);
            }}
          >
            {menuOpen ? t('admin.nav.close') : t('admin.nav.open')}
          </button>
        </div>
        <nav
          id={menuId}
          aria-label={t('admin.nav.main')}
          className={classNames('px-2 pb-4 md:block', menuOpen ? 'block' : 'hidden')}
        >
          <ul className="flex flex-col gap-1">
            {visible.map((section) => (
              <li key={section.path}>
                <NavLink
                  to={section.path}
                  onClick={() => {
                    setMenuOpen(false);
                  }}
                  className={({ isActive }) =>
                    classNames(
                      'block rounded-md px-3 py-2 font-semibold focus-visible:outline-3 focus-visible:outline-focus',
                      isActive ? 'bg-white/10 text-ink-strong' : 'text-ink hover:bg-white/5',
                    )
                  }
                >
                  {t(section.label)}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex flex-wrap items-center justify-end gap-3 border-b border-line px-4 py-3 sm:px-8">
          <span className="truncate text-sm text-ink-muted">{session.data.email}</span>
          <div role="group" aria-label={t('admin.language')} className="flex gap-1">
            {locales.map((option) => (
              <button
                key={option}
                type="button"
                lang={option}
                aria-pressed={option === locale}
                className={classNames(buttonClass(option === locale ? 'secondary' : 'ghost', 'sm'))}
                onClick={() => {
                  setLocale(option);
                }}
              >
                {languageNames[option]}
              </button>
            ))}
          </div>
          <button
            type="button"
            className={buttonClass('ghost', 'sm')}
            disabled={signOut.isPending}
            onClick={() => {
              setLeaving(true);
              signOut.mutate();
            }}
          >
            {t('nav.signOut')}
          </button>
        </header>
        <main className="flex flex-1 flex-col gap-6 px-4 py-6 sm:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

/** A page for a session with `permission`; without it, a message instead (the menu hides such pages). */
export function RequirePermission({
  permission,
  children,
}: Readonly<{ permission: string; children: ReactNode }>) {
  const { t } = useLocale();
  const session = useAdminSession();
  if (!can(session.data, permission)) {
    return (
      <p role="alert" className="py-16 text-center text-ink-muted">
        {t('admin.forbidden')}
      </p>
    );
  }
  return children;
}

/** The panel's front door: the first section the session may see, or a word that there is none. */
export function Home() {
  const { t } = useLocale();
  const session = useAdminSession();
  const first = sections.find((section) => can(session.data, section.permission));
  return first ? (
    <Navigate to={first.path} replace />
  ) : (
    <p className="py-16 text-center text-ink-muted">{t('admin.home.empty')}</p>
  );
}

export function NotFound() {
  const { t } = useLocale();
  return <p className="py-16 text-center text-ink-muted">{t('page.notFound.title')}</p>;
}
