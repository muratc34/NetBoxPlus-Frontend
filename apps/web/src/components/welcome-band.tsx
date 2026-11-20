'use client';

import { useSession } from '@netboxplus/core';
import Link from 'next/link';
import { useLocale } from '../i18n/translator';
import { routes } from '../routes';

/**
 * A short welcome for visitors who are not signed in, under the billboard. The web server cannot tell (the
 * session cookie belongs to the gateway), so it appears once the browser knows there is no session.
 */
export function WelcomeBand() {
  const { locale, t } = useLocale();
  const session = useSession();
  if (session.data !== null) {
    return null;
  }

  return (
    <section className="mx-4 flex flex-col gap-3 rounded-lg bg-surface p-6 sm:mx-8 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h2 className="font-display text-xl font-bold text-ink-strong">{t('welcome.title')}</h2>
        <p className="mt-1 text-ink-muted">{t('welcome.body')}</p>
      </div>
      <Link
        href={routes.signUp(locale)}
        className="inline-flex h-11 shrink-0 items-center justify-center rounded-md bg-brand-strong px-5 font-semibold text-white hover:bg-brand-strong-hover focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-focus"
      >
        {t('welcome.cta')}
      </Link>
    </section>
  );
}
