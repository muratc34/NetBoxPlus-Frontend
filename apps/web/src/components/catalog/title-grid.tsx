'use client';

import { useTitlePages, type TitleFilter, type TitlePage } from '@netboxplus/core';
import { useEffect, useRef } from 'react';
import { useLocale } from '../../i18n/translator';
import { TitleCard } from './title-card';

/**
 * Titles in a grid that loads the next page as its end comes near. The "show more" link under it goes
 * to the next page's address, so the list also pages without JavaScript (and for crawlers).
 */
export function TitleGrid({
  filter,
  firstPage,
  pathname,
  query,
}: Readonly<{
  filter: TitleFilter;
  firstPage: TitlePage;
  /** The page's own address and its query without `page`, for the "show more" link. */
  pathname: string;
  query: Readonly<Record<string, string>>;
}>) {
  const { t } = useLocale();
  const pages = useTitlePages(filter, firstPage);
  const more = useRef<HTMLAnchorElement>(null);
  const titles = pages.data?.pages.flatMap((page) => page.items) ?? firstPage.items;
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = pages;
  const lastPage = pages.data?.pages.at(-1)?.pageNumber ?? firstPage.pageNumber;

  useEffect(() => {
    const element = more.current;
    if (!element || !hasNextPage) {
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting) && !isFetchingNextPage) {
          void fetchNextPage();
        }
      },
      { rootMargin: '600px 0px' },
    );
    observer.observe(element);
    return () => {
      observer.disconnect();
    };
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  if (titles.length === 0) {
    return <p className="px-4 py-16 text-center text-ink-muted sm:px-8">{t('browse.empty')}</p>;
  }

  const nextHref = `${pathname}?${new URLSearchParams({ ...query, page: String(lastPage + 1) }).toString()}`;

  return (
    <div className="px-4 pb-12 sm:px-8">
      <ul className="grid grid-cols-2 gap-x-3 gap-y-6 py-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {titles.map((title) => (
          <li key={title.id}>
            <TitleCard title={title} />
          </li>
        ))}
      </ul>
      {hasNextPage && (
        <div className="flex justify-center pt-4">
          <a
            ref={more}
            href={nextHref}
            aria-busy={isFetchingNextPage || undefined}
            onClick={(event) => {
              event.preventDefault();
              void fetchNextPage();
            }}
            className="rounded-md bg-white/15 px-5 py-2.5 font-semibold text-white hover:bg-white/25 focus-visible:outline-3 focus-visible:outline-focus"
          >
            {isFetchingNextPage ? t('browse.loading') : t('browse.loadMore')}
          </a>
        </div>
      )}
    </div>
  );
}
