'use client';

import { useSession, useSignOut } from '@netboxplus/core';
import { Button, Logo } from '@netboxplus/ui';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLocale } from '../i18n/translator';
import { routes } from '../routes';

/** The bar above every page: the logo, and signing in or out. Group D adds the menu. */
export function SiteHeader() {
  const { locale, t } = useLocale();
  const router = useRouter();
  const session = useSession();
  const signOut = useSignOut();

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
          <span className="hidden text-sm text-ink-muted sm:inline">{session.data.email}</span>
          <Button
            variant="ghost"
            disabled={signOut.isPending}
            onClick={() => {
              signOut.mutate(undefined, {
                onSettled: () => {
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
