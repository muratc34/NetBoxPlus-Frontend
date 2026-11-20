'use client';

import Link from 'next/link';
import { useLocale } from '../../i18n/translator';
import { routes } from '../../routes';

/** An unknown address or a title that is not published (Catalog answers 404). */
export default function NotFound() {
  const { locale, t } = useLocale();
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-4 py-24 text-center">
      <h1 className="font-display text-2xl font-bold text-ink-strong">{t('page.notFound.title')}</h1>
      <p className="max-w-md text-ink-muted">{t('page.notFound.body')}</p>
      <Link
        href={routes.home(locale)}
        className="rounded-md bg-white/15 px-5 py-2.5 font-semibold text-white hover:bg-white/25 focus-visible:outline-3 focus-visible:outline-focus"
      >
        {t('page.notFound.home')}
      </Link>
    </main>
  );
}
