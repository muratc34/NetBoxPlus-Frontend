'use client';

import { useSession } from '@netboxplus/core';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect } from 'react';
import { useLocale } from '../../i18n/translator';
import { signInPath } from '../../routes';
import { Membership } from './membership';

/**
 * The account's own page: its membership and invoices (and, later, its sign-in details). It needs no
 * profile; a visitor without a session signs in first and comes back.
 */
export function AccountPage() {
  const { locale, t } = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const session = useSession();
  const checkoutReturned = useSearchParams().get('checkout') === 'success';

  useEffect(() => {
    if (session.data === null) {
      router.replace(signInPath(locale, pathname));
    }
  }, [session.data, router, locale, pathname]);

  return (
    <main className="flex w-full max-w-3xl flex-col gap-8 px-4 pt-6 pb-16 sm:px-8">
      <h1 className="font-display text-3xl font-bold text-ink-strong">{t('account.title')}</h1>
      {session.data ? (
        <Membership checkoutReturned={checkoutReturned} />
      ) : (
        <p aria-busy="true" className="py-16 text-center text-ink-muted">
          {t('browse.loading')}
        </p>
      )}
    </main>
  );
}
