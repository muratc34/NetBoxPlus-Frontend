import { useInfiniteQuery } from '@tanstack/react-query';
import {
  catalogStaleTime,
  nextTitlePage,
  readSearch,
  searchKeys,
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
