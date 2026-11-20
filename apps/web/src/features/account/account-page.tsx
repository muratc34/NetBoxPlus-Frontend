'use client';

import { useSession } from '@netboxplus/core';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useLocale } from '../../i18n/translator';
import { routes, signInPath } from '../../routes';
import { DeleteAccount } from './delete-account';
import { Membership } from './membership';
import { SignInDetails } from './sign-in-details';

/**
 * The account's own page: its sign-in details (address, password), membership and invoices, a way to its
 * profiles, and deleting it. It needs no profile; a visitor without a session signs in first and comes back.
 */
export function AccountPage() {
  const { locale, t } = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const session = useSession();
  const checkoutReturned = useSearchParams().get('checkout') === 'success';

  // Leaving after the account was deleted: home, not signing in.
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    if (session.data === null && !leaving) {
      router.replace(signInPath(locale, pathname));
    }
  }, [session.data, leaving, router, locale, pathname]);

  return (
    <main className="flex w-full max-w-3xl flex-col gap-8 px-4 pt-6 pb-16 sm:px-8">
      <h1 className="font-display text-3xl font-bold text-ink-strong">{t('account.title')}</h1>
      {session.data ? (
        <>
          <SignInDetails address={session.data.email} />
          <Membership checkoutReturned={checkoutReturned} />
          <section
            aria-labelledby="profiles-heading"
            className="flex flex-col items-start gap-3 rounded-lg bg-surface p-6"
          >
            <h2 id="profiles-heading" className="font-display text-xl font-bold text-ink-strong">
              {t('account.profiles')}
            </h2>
            <Link
              href={routes.profiles(locale)}
              className="inline-flex h-11 items-center rounded-md bg-white/15 px-5 font-semibold text-white hover:bg-white/25 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-focus"
            >
              {t('account.manageProfiles')}
            </Link>
          </section>
          <DeleteAccount
            onLeave={() => {
              setLeaving(true);
            }}
          />
        </>
      ) : (
        <p aria-busy="true" className="py-16 text-center text-ink-muted">
          {t('browse.loading')}
        </p>
      )}
    </main>
  );
}
