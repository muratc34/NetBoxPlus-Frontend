import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import type { Locale } from '@netboxplus/i18n';
import {
  catalogKeys,
  catalogStaleTime,
  nextTitlePage,
  readRecommended,
  readSimilar,
  readTitles,
  recommendationKeys,
  type CatalogAgeRating,
  type RecommendationFilter,
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

/** Titles like one title, for a row: asked once `enabled`. Search being down (503) is an error the row hides. */
export function useSimilarTitles(
  id: string,
  lang: Locale,
  maxAgeRating: CatalogAgeRating | undefined,
  pageSize: number,
  enabled: boolean,
) {
  const { clients } = useGateway();
  return useQuery({
    queryKey: recommendationKeys.similar(id, lang, maxAgeRating, pageSize),
    queryFn: () =>
      readSimilar(clients.catalog, id, { lang, pageSize, ...(maxAgeRating ? { maxAgeRating } : {}) }),
    enabled,
    staleTime: catalogStaleTime,
  });
}

/** Titles recommended from a taste, for a row; not asked without a liked title. */
export function useRecommendedTitles(filter: RecommendationFilter, enabled: boolean) {
  const { clients } = useGateway();
  return useQuery({
    queryKey: recommendationKeys.recommended(filter),
    queryFn: () => readRecommended(clients.catalog, filter),
    enabled: enabled && filter.like.length > 0,
    staleTime: catalogStaleTime,
  });
}
