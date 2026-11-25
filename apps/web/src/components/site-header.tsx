'use client';

import { useAccountEmail, useProfiles, useSession, useSignOut } from '@netboxplus/core';
import type { Locale, MessageKey } from '@netboxplus/i18n';
import { classNames, Logo } from '@netboxplus/ui';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useSyncExternalStore } from 'react';
import { useLocale } from '../i18n/translator';
import { ProfileAvatar } from '../profiles/profile-avatar';
import { useProfileSelection } from '../profiles/profile-selection';
import { routes } from '../routes';

interface NavItem {
  readonly key: MessageKey;
  readonly href: (locale: Locale) => string;
  /** Whether a path belongs to this item: the home page only itself, the others their own pages too. */
  readonly exact?: boolean;
}

export const navItems: readonly NavItem[] = [
  { key: 'nav.homePage', href: routes.home, exact: true },
  { key: 'nav.series', href: routes.series },
  { key: 'nav.movies', href: routes.movies },
  { key: 'nav.myList', href: routes.myList },
];

/** The phone's tab bar: the same sections and search, which the header has as an icon. */
export const tabItems: readonly NavItem[] = [
  { key: 'nav.homePage', href: routes.home, exact: true },
  { key: 'nav.series', href: routes.series },
  { key: 'nav.movies', href: routes.movies },
  { key: 'nav.search', href: routes.search },
  { key: 'nav.myList', href: routes.myList },
];

export function isCurrent(item: NavItem, locale: Locale, pathname: string): boolean {
  const href = item.href(locale);
  return item.exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

// The page's scroll position as a store: the header is transparent over the billboard and solid below it.
function subscribeToScroll(listener: () => void) {
  window.addEventListener('scroll', listener, { passive: true });
  return () => {
    window.removeEventListener('scroll', listener);
  };
}
const scrolled = () => window.scrollY > 8;
const notScrolled = () => false;

const focusRing = 'focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-focus';

/** The bar above every page: the logo, the menu, and the profile's menu or signing in. */
export function SiteHeader() {
  const { locale, t } = useLocale();
  const pathname = usePathname();
  const session = useSession();
  const solid = useSyncExternalStore(subscribeToScroll, scrolled, notScrolled);

  return (
    <header
      className={classNames(
        'sticky top-0 z-30 flex h-16 items-center gap-6 px-4 transition-colors sm:px-8',
        solid ? 'bg-canvas shadow-lg shadow-black/40' : 'bg-linear-to-b from-black/70 to-transparent',
      )}
    >
      <Link
        href={routes.home(locale)}
        aria-label={t('nav.home')}
        className={classNames('rounded-sm', focusRing)}
      >
        <Logo className="text-2xl" />
      </Link>
      <nav aria-label={t('nav.main')} className="hidden md:block">
        <ul className="flex gap-5">
          {navItems.map((item) => {
            const current = isCurrent(item, locale, pathname);
            return (
              <li key={item.key}>
                <Link
                  href={item.href(locale)}
                  aria-current={current ? 'page' : undefined}
                  className={classNames(
                    'rounded-sm text-sm',
                    current ? 'font-semibold text-ink-strong' : 'text-ink hover:text-ink-muted',
                    focusRing,
                  )}
                >
                  {t(item.key)}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <div className="ml-auto flex items-center gap-3">
        <Link
          href={routes.search(locale)}
          aria-label={t('nav.search')}
          aria-current={pathname === routes.search(locale) ? 'page' : undefined}
          className={classNames('hidden rounded-md p-2 text-ink hover:bg-white/10 md:block', focusRing)}
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="size-6"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-4-4" strokeLinecap="round" />
          </svg>
        </Link>
        {session.data === null && (
          <Link
            href={routes.signIn(locale)}
            className={classNames(
              'rounded-md bg-brand-strong px-4 py-2 text-sm font-semibold text-white hover:bg-brand-strong-hover',
              focusRing,
            )}
          >
            {t('nav.signIn')}
          </Link>
        )}
        {session.data && <ProfileMenu fallback={session.data.email} />}
      </div>
    </header>
  );
}

function ProfileMenu({ fallback }: Readonly<{ fallback: string }>) {
  const email = useAccountEmail() ?? fallback;
  const { locale, t } = useLocale();
  const router = useRouter();
  const signOut = useSignOut();
  const profiles = useProfiles(true);
  const { selected, clear } = useProfileSelection();
  const watching = profiles.data?.find((profile) => profile.id === selected?.id);

  const item =
    'flex cursor-pointer items-center gap-3 rounded-sm px-3 py-2 text-sm text-ink outline-none select-none ' +
    'data-highlighted:bg-white/10 data-highlighted:text-ink-strong';

  return (
    <DropdownMenu.Root modal={false}>
      <DropdownMenu.Trigger
        aria-label={watching ? `${watching.name}: ${t('nav.profileMenu')}` : t('nav.profileMenu')}
        className={classNames('flex items-center gap-2 rounded-md p-1 hover:bg-white/10', focusRing)}
      >
        {watching ? (
          <ProfileAvatar id={watching.id} name={watching.name} className="size-8 text-base" />
        ) : (
          <span
            aria-hidden="true"
            className="flex size-8 items-center justify-center rounded-md bg-surface-raised"
          >
            {Array.from(email)[0]?.toLocaleUpperCase()}
          </span>
        )}
        <span aria-hidden="true" className="text-xs text-ink-muted">
          ▾
        </span>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={8}
          className="z-40 min-w-56 rounded-md border border-line bg-surface p-1 shadow-xl shadow-black/50"
        >
          {watching && (
            <DropdownMenu.Label className="truncate px-3 py-2 text-xs text-ink-muted">
              {watching.name}
            </DropdownMenu.Label>
          )}
          <DropdownMenu.Item asChild className={item}>
            <Link href={routes.profiles(locale)}>{t('profiles.switch')}</Link>
          </DropdownMenu.Item>
          <DropdownMenu.Item asChild className={item}>
            <Link href={routes.account(locale)}>{t('nav.account')}</Link>
          </DropdownMenu.Item>
          <DropdownMenu.Separator className="my-1 h-px bg-line" />
          <DropdownMenu.Item
            className={item}
            disabled={signOut.isPending}
            onSelect={() => {
              signOut.mutate(undefined, {
                onSettled: () => {
                  clear();
                  router.push(routes.home(locale));
                },
              });
            }}
          >
            {t('nav.signOut')}
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

/** On a phone the menu moves to a bar at the bottom of the screen, within the thumb's reach. */
export function MobileTabBar() {
  const { locale, t } = useLocale();
  const pathname = usePathname();

  return (
    <nav
      aria-label={t('nav.main')}
      className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-canvas/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-sm md:hidden"
    >
      <ul className="flex">
        {tabItems.map((item) => {
          const current = isCurrent(item, locale, pathname);
          return (
            <li key={item.key} className="flex-1">
              <Link
                href={item.href(locale)}
                aria-current={current ? 'page' : undefined}
                className={classNames(
                  'flex h-14 items-center justify-center text-sm',
                  current ? 'font-semibold text-ink-strong' : 'text-ink-muted',
                  'focus-visible:outline-3 focus-visible:-outline-offset-3 focus-visible:outline-focus',
                )}
              >
                {t(item.key)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
