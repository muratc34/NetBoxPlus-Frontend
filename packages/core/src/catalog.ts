import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import {
  catalogKeys,
  catalogStaleTime,
  nextTitlePage,
  readTitles,
  type TitleFilter,
  type TitlePage,
} from './catalog-reads';
import { useGateway } from './gateway';

/**
 * A list that grows page by page. `firstPage` is the page the server rendered: the list starts from it
 * and asks for the ones after it.
 */
export function useTitlePages(filter: TitleFilter, firstPage?: TitlePage) {
  const { clients } = useGateway();
  return useInfiniteQuery({
    queryKey: catalogKeys.titles(filter),
    queryFn: ({ pageParam }) => readTitles(clients.catalog, filter, pageParam),
    initialPageParam: firstPage?.pageNumber ?? 1,
    getNextPageParam: nextTitlePage,
    ...(firstPage ? { initialData: { pages: [firstPage], pageParams: [firstPage.pageNumber] } } : {}),
    staleTime: catalogStaleTime,
  });
}

/** The first page of a list, asked only once `enabled`, such as when a row scrolls into view. */
export function useTitleRow(filter: TitleFilter, enabled: boolean) {
  const { clients } = useGateway();
  return useQuery({
    queryKey: [...catalogKeys.titles(filter), 'row'],
    queryFn: () => readTitles(clients.catalog, filter),
    enabled,
    staleTime: catalogStaleTime,
  });
}
