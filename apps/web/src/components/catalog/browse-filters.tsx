'use client';

import type { Genre, TitleSort } from '@netboxplus/core';
import { classNames } from '@netboxplus/ui';
import Link from 'next/link';
import { useLocale } from '../../i18n/translator';

export const titleSorts: readonly TitleSort[] = ['Popular', 'Newest'];

const chip =
  'inline-flex h-9 shrink-0 items-center rounded-full border px-4 text-sm font-semibold whitespace-nowrap ' +
  'focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-focus';
const chipIdle = 'border-line text-ink hover:border-ink-muted hover:text-ink-strong';
const chipActive = 'border-ink-strong bg-ink-strong text-canvas';

/**
 * Genre chips and the sort switch of the Movies and Series pages: plain links, so a filtered list has its
 * own address, works without JavaScript and comes back with the browser's back button. The chips scroll
 * sideways on a phone.
 */
export function BrowseFilters({
  pathname,
  genres,
  genreId,
  sort,
}: Readonly<{ pathname: string; genres: readonly Genre[]; genreId: string | undefined; sort: TitleSort }>) {
  const { t } = useLocale();
  const href = (next: { genre?: string | undefined; sort: TitleSort }) => {
    const query = new URLSearchParams();
    if (next.genre) {
      query.set('genre', next.genre);
    }
    if (next.sort !== 'Popular') {
      query.set('sort', next.sort);
    }
    const search = query.toString();
    return search ? `${pathname}?${search}` : pathname;
  };

  return (
    <div className="flex flex-col gap-3 px-4 sm:flex-row sm:items-center sm:justify-between sm:px-8">
      <nav
        aria-label={t('browse.genres')}
        className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0"
      >
        <ul className="flex gap-2 py-1">
          {[{ id: undefined, name: t('browse.allGenres') }, ...genres].map((genre) => {
            const active = genre.id === genreId;
            return (
              <li key={genre.id ?? 'all'}>
                <Link
                  href={href({ genre: genre.id, sort })}
                  aria-current={active ? 'page' : undefined}
                  className={classNames(chip, active ? chipActive : chipIdle)}
                >
                  {genre.name}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <nav aria-label={t('browse.sort')}>
        <ul className="flex gap-1 rounded-full bg-surface p-1">
          {titleSorts.map((option) => {
            const active = option === sort;
            return (
              <li key={option}>
                <Link
                  href={href({ genre: genreId, sort: option })}
                  aria-current={active ? 'page' : undefined}
                  className={classNames(
                    'inline-flex h-8 items-center rounded-full px-4 text-sm font-semibold focus-visible:outline-3 focus-visible:outline-focus',
                    active ? 'bg-surface-raised text-ink-strong' : 'text-ink-muted hover:text-ink-strong',
                  )}
                >
                  {t(`browse.sort.${option}`)}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
