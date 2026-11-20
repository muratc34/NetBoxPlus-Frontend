import type { Locale } from '@netboxplus/i18n';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import {
  catalogStaleTime,
  nextTitlePage,
  readSearch,
  readSuggestions,
  searchKeys,
  type CatalogAgeRating,
  type SearchFilter,
  type SearchPage,
} from './catalog-reads';
import { useGateway } from './gateway';

/**
 * Search results page by page; nothing is asked while the text is blank. `firstPage` is the page the
 * server rendered for the same text.
 */
export function useSearchPages(filter: SearchFilter, firstPage?: SearchPage) {
  const { clients } = useGateway();
  return useInfiniteQuery({
    queryKey: searchKeys.results(filter),
    queryFn: ({ pageParam }) => readSearch(clients.catalog, filter, pageParam),
    initialPageParam: firstPage?.pageNumber ?? 1,
    getNextPageParam: nextTitlePage,
    ...(firstPage ? { initialData: { pages: [firstPage], pageParams: [firstPage.pageNumber] } } : {}),
    enabled: filter.q.trim() !== '',
    staleTime: catalogStaleTime,
  });
}

/** Titles for what has been typed so far; nothing while it is blank. */
export function useSuggestions(q: string, lang: Locale, maxAgeRating?: CatalogAgeRating) {
  const { clients } = useGateway();
  const text = q.trim();
  return useQuery({
    queryKey: searchKeys.suggestions(text, lang, maxAgeRating),
    queryFn: () => readSuggestions(clients.catalog, text, lang, maxAgeRating),
    enabled: text !== '',
    staleTime: catalogStaleTime,
  });
}
