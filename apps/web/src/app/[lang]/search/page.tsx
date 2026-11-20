import { isLocale } from '@netboxplus/i18n';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { parseBrowseQuery } from '../../../features/browse/browse-page';
import { SearchPage } from '../../../features/search/search-page';
import { searchText } from '../../../features/search/search-text';
import { pageTitle } from '../../../i18n/server';
import { loadGenres, loadSearch, viewerAgeLimit } from '../../../server/catalog';

export async function generateMetadata({ params }: PageProps<'/[lang]/search'>): Promise<Metadata> {
  // Results change all the time and every query is its own address: not for search engines.
  return { title: await pageTitle(params, 'search.title'), robots: { index: false } };
}

export default async function SearchRoute({ params, searchParams }: PageProps<'/[lang]/search'>) {
  const { lang } = await params;
  if (!isLocale(lang)) {
    notFound();
  }
  const search = await searchParams;
  const q = searchText(search.q);
  const maxAgeRating = await viewerAgeLimit();
  const [genres, results] = await Promise.all([
    loadGenres(lang),
    q === ''
      ? Promise.resolve(undefined)
      : loadSearch({ q, lang, ...(maxAgeRating ? { maxAgeRating } : {}) }, parseBrowseQuery(search).page),
  ]);

  return (
    <SearchPage
      initialQuery={q}
      firstPage={results === 'unavailable' ? undefined : results}
      unavailable={results === 'unavailable'}
      genres={genres}
      maxAgeRating={maxAgeRating}
    />
  );
}
