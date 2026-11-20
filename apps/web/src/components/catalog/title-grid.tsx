'use client';

import { useTitlePages, type TitleFilter, type TitlePage, type TitleSummary } from '@netboxplus/core';
import { useEffect, useRef, type ReactNode } from 'react';
import { useLocale } from '../../i18n/translator';
import { TitleCard } from './title-card';

/** The pages a grid shows: what TanStack Query's infinite queries give. */
export interface GridPages {
  readonly pages: readonly { readonly items: readonly TitleSummary[]; readonly pageNumber: number }[];
  readonly hasNextPage: boolean;
  readonly isFetchingNextPage: boolean;
  readonly fetchNextPage: () => Promise<unknown>;
}

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
  const pages = useTitlePages(filter, firstPage);
  return (
    <PagedGrid
      pages={{
        pages: pages.data?.pages ?? [firstPage],
        hasNextPage: pages.hasNextPage,
        isFetchingNextPage: pages.isFetchingNextPage,
        fetchNextPage: pages.fetchNextPage,
      }}
      pathname={pathname}
      query={query}
    />
  );
}

/** The grid itself, for any paged list of titles (browsing, search). */
export function PagedGrid({
  pages,
  pathname,
  query,
  empty,
}: Readonly<{
  pages: GridPages;
  pathname: string;
  query: Readonly<Record<string, string>>;
  /** What to say when there is nothing; "Nothing here yet." by default. */
  empty?: ReactNode;
}>) {
  const { t } = useLocale();
  const more = useRef<HTMLAnchorElement>(null);
  const titles = pages.pages.flatMap((page) => page.items);
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = pages;
  const lastPage = pages.pages.at(-1)?.pageNumber ?? 1;

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
    return <p className="px-4 py-16 text-center text-ink-muted sm:px-8">{empty ?? t('browse.empty')}</p>;
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
