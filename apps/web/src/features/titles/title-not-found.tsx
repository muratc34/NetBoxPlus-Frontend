'use client';

import Link from 'next/link';
import { useLocale } from '../../i18n/translator';
import { routes } from '../../routes';

/**
 * A movie or series Catalog does not have published: usually one taken down while a page that links to it
 * was still open. Still a 404 for search engines; for the visitor, where to go instead.
 */
export function TitleNotFound() {
  const { locale, t } = useLocale();
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-4 py-24 text-center">
      <h1 className="font-display text-2xl font-bold text-ink-strong">{t('page.titleNotFound.title')}</h1>
      <p className="max-w-md text-ink-muted">{t('page.titleNotFound.body')}</p>
      <Link
        href={routes.home(locale)}
        className="rounded-md bg-white/15 px-5 py-2.5 font-semibold text-white hover:bg-white/25 focus-visible:outline-3 focus-visible:outline-focus"
      >
        {t('page.notFound.home')}
      </Link>
    </main>
  );
}
