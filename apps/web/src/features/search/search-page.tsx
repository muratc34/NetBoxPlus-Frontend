'use client';

import { isApiError } from '@netboxplus/api';
import {
  maxSearchLength,
  problemMessageKey,
  useSearchPages,
  type CatalogAgeRating,
  type Genre,
  type SearchPage as ResultsPage,
} from '@netboxplus/core';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useId, useState } from 'react';
import { PagedGrid } from '../../components/catalog/title-grid';
import { useLocale } from '../../i18n/translator';
import { routes } from '../../routes';

/** How long typing rests before the address and the results follow it. */
export const searchDelayMs = 300;

/** A value that follows `value` once it has stopped changing for `delayMs`. */
function useSettled(value: string, delayMs: number): string {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSettled(value);
    }, delayMs);
    return () => {
      window.clearTimeout(timer);
    };
  }, [value, delayMs]);
  return settled;
}

const chip =
  'inline-flex h-9 items-center rounded-full border border-line px-4 text-sm font-semibold text-ink ' +
  'hover:border-ink-muted hover:text-ink-strong focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-focus';

/**
 * Search as you type: the address (`?q=`) and the results follow the box once typing rests, replacing
 * the history entry rather than adding one per letter. The results are the only list, as on Netflix: a
 * second list of suggestions under the box showed the same titles again. With nothing typed, genres to
 * browse instead.
 */
export function SearchPage({
  initialQuery,
  firstPage,
  unavailable,
  genres,
  maxAgeRating,
  delayMs = searchDelayMs,
}: Readonly<{
  initialQuery: string;
  /** The server's results for `initialQuery`, if it searched. */
  firstPage: ResultsPage | undefined;
  /** The server found search down. */
  unavailable: boolean;
  genres: readonly Genre[];
  maxAgeRating: CatalogAgeRating | undefined;
  delayMs?: number;
}>) {
  const { locale, t } = useLocale();
  const router = useRouter();
  const inputId = useId();
  const [text, setText] = useState(initialQuery);
  const query = useSettled(text, delayMs).trim();
  const ageFilter = maxAgeRating ? { maxAgeRating } : {};

  const results = useSearchPages(
    { q: query, lang: locale, ...ageFilter },
    query === initialQuery.trim() ? firstPage : undefined,
  );

  useEffect(() => {
    if (query === initialQuery.trim()) {
      return;
    }
    const search = query ? `?${new URLSearchParams({ q: query }).toString()}` : '';
    router.replace(`${routes.search(locale)}${search}`, { scroll: false });
  }, [query, initialQuery, locale, router]);

  const down =
    (unavailable && query === initialQuery.trim() && !results.data) ||
    (isApiError(results.error) && results.error.status === 503);
  const total = results.data?.pages[0]?.totalCount;

  return (
    <main className="flex flex-col gap-6 pt-4 pb-12">
      <div className="px-4 sm:px-8">
        <h1 className="sr-only">{t('search.title')}</h1>
        <div className="max-w-2xl">
          <label htmlFor={inputId} className="sr-only">
            {t('search.label')}
          </label>
          <input
            id={inputId}
            type="search"
            autoComplete="off"
            maxLength={maxSearchLength}
            placeholder={t('search.placeholder')}
            value={text}
            onChange={(event) => {
              setText(event.target.value);
            }}
            onKeyDown={(event) => {
              // Results already follow the typing: Enter only puts the phone's keyboard away.
              if (event.key === 'Enter') {
                event.currentTarget.blur();
              }
            }}
            className="h-14 w-full rounded-md border border-line bg-surface px-4 text-lg text-ink-strong placeholder:text-ink-muted focus-visible:outline-3 focus-visible:outline-focus"
          />
        </div>
      </div>

      {down ? (
        <p role="alert" className="px-4 py-16 text-center text-ink-muted sm:px-8">
          {t('search.unavailable')}
        </p>
      ) : query === '' ? (
        <section aria-labelledby="search-genres" className="flex flex-col gap-3 px-4 sm:px-8">
          <h2 id="search-genres" className="font-display text-xl font-bold text-ink-strong">
            {t('search.browseGenres')}
          </h2>
          <ul className="flex flex-wrap gap-2">
            {genres.map((genre) => (
              <li key={genre.id}>
                <Link href={routes.genre(locale, genre.id)} className={chip}>
                  {genre.name}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : results.isError ? (
        <p role="alert" className="px-4 py-16 text-center text-ink-muted sm:px-8">
          {t(problemMessageKey(results.error))}
        </p>
      ) : results.data ? (
        <section aria-label={t('search.title')}>
          {total !== undefined && total > 0 && (
            <p aria-live="polite" className="px-4 text-sm text-ink-muted sm:px-8">
              {t('search.results').replace('{count}', String(total))}
            </p>
          )}
          <PagedGrid
            pages={{
              pages: results.data.pages,
              hasNextPage: results.hasNextPage,
              isFetchingNextPage: results.isFetchingNextPage,
              fetchNextPage: results.fetchNextPage,
            }}
            pathname={routes.search(locale)}
            query={{ q: query }}
            empty={t('search.none').replace('{q}', query)}
          />
        </section>
      ) : (
        <p aria-busy="true" className="px-4 py-16 text-center text-ink-muted sm:px-8">
          {t('browse.loading')}
        </p>
      )}
    </main>
  );
}
