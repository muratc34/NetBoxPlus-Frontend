'use client';

import { useSession } from '@netboxplus/core';
import Link from 'next/link';
import { useLocale } from '../i18n/translator';
import { routes } from '../routes';

/**
 * A short welcome for visitors who are not signed in, under the billboard. The web server cannot see the
 * session (its cookie belongs to the gateway), but it sees whether a profile was chosen on this host: without
 * one the visitor is `likelyGuest` and the band is there from the first paint, so nothing under it moves
 * when the browser learns there is no session. It goes once the browser knows otherwise, and appears late
 * only for an account that has not chosen a profile yet.
 */
export function WelcomeBand({ likelyGuest = false }: Readonly<{ likelyGuest?: boolean }>) {
  const { locale, t } = useLocale();
  const session = useSession();
  const guest = session.data === null || (session.isPending && likelyGuest);
  if (!guest) {
    return null;
  }

  return (
    <section className="mx-4 flex flex-col gap-3 rounded-lg bg-surface p-6 sm:mx-8 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h2 className="font-display text-xl font-bold text-ink-strong">{t('welcome.title')}</h2>
        <p className="mt-1 text-ink-muted">{t('welcome.body')}</p>
      </div>
      <Link
        href={routes.plans(locale)}
        className="inline-flex h-11 shrink-0 items-center justify-center rounded-md bg-brand-strong px-5 font-semibold text-white hover:bg-brand-strong-hover focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-focus"
      >
        {t('welcome.cta')}
      </Link>
    </section>
  );
}
