'use client';

import { useProfiles, useSession, useSignOut } from '@netboxplus/core';
import { Button, Logo } from '@netboxplus/ui';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLocale } from '../i18n/translator';
import { ProfileAvatar } from '../profiles/profile-avatar';
import { useProfileSelection } from '../profiles/profile-selection';
import { routes } from '../routes';

/** The bar above every page: the logo, and signing in or out. Group D adds the menu. */
export function SiteHeader() {
  const { locale, t } = useLocale();
  const router = useRouter();
  const session = useSession();
  const signOut = useSignOut();
  const profiles = useProfiles(Boolean(session.data));
  const { selected, clear } = useProfileSelection();
  const watching = profiles.data?.find((profile) => profile.id === selected?.id);

  return (
    <header className="flex h-16 items-center justify-between gap-4 px-4 sm:px-8">
      <Link
        href={routes.home(locale)}
        aria-label={t('nav.home')}
        className="rounded-sm focus-visible:outline-3 focus-visible:outline-focus"
      >
        <Logo className="text-2xl" />
      </Link>
      {session.data === null && (
        <Link
          href={routes.signIn(locale)}
          className="rounded-md px-4 py-2 font-semibold text-ink-strong hover:bg-white/10 focus-visible:outline-3 focus-visible:outline-focus"
        >
          {t('nav.signIn')}
        </Link>
      )}
      {session.data && (
        <div className="flex items-center gap-3">
          {watching ? (
            <Link
              href={routes.profiles(locale)}
              aria-label={`${watching.name}: ${t('profiles.switch')}`}
              className="flex items-center gap-2 rounded-md px-2 py-1 text-sm text-ink-muted hover:bg-white/10 hover:text-ink-strong focus-visible:outline-3 focus-visible:outline-focus"
            >
              <ProfileAvatar id={watching.id} name={watching.name} className="size-8 text-base" />
              <span>{t('profiles.switch')}</span>
            </Link>
          ) : (
            <span className="hidden text-sm text-ink-muted sm:inline">{session.data.email}</span>
          )}
          <Button
            variant="ghost"
            disabled={signOut.isPending}
            onClick={() => {
              signOut.mutate(undefined, {
                onSettled: () => {
                  clear();
                  router.push(routes.home(locale));
                },
              });
            }}
          >
            {t('nav.signOut')}
          </Button>
        </div>
      )}
    </header>
  );
}
