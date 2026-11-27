/**
 * The catalog reads without React: the web server calls them while rendering, the hooks in catalog.ts in the
 * browser. Nothing here may import React, or a server component importing it would pull in client code.
 */
import { unwrap, type CatalogSchemas, type PublicClients } from '@netboxplus/api';
import type { Locale } from '@netboxplus/i18n';

export type TitleSummary = CatalogSchemas['TitleSummary'];
export type TitlePage = CatalogSchemas['PageOfTitleSummary'];
export type Genre = CatalogSchemas['GenreReference'];
export type TitleKind = CatalogSchemas['TitleKind'];
export type TitleSort = CatalogSchemas['TitleSort'];
export type CatalogAgeRating = CatalogSchemas['AgeRating'];

/**
 * Which published titles a list shows. `maxAgeRating` is the chosen profile's limit: Catalog filters a
 * child's lists itself, so pages and counts stay right.
 */
export interface TitleFilter {
  readonly lang: Locale;
  readonly kind?: TitleKind;
  readonly genreId?: string;
  readonly personId?: string;
  readonly sort?: TitleSort;
  readonly maxAgeRating?: CatalogAgeRating;
  readonly pageSize?: number;
}

/** How long a catalog answer is used before it is asked again: published content changes rarely. */
export const catalogStaleTime = 60_000;

export const catalogKeys = {
  titles: (filter: TitleFilter) => ['catalog', 'titles', filter] as const,
  genres: (lang: Locale) => ['catalog', 'genres', lang] as const,
};

/** One page of titles; the web server calls it while rendering, the browser while scrolling. */
export function readTitles(
  catalog: PublicClients['catalog'],
  filter: TitleFilter,
  page = 1,
): Promise<TitlePage> {
  return unwrap(catalog.GET('/titles', { params: { query: { ...filter, page } } }));
}

/** The genres that have published content, named in `lang`. */
export function readGenres(catalog: PublicClients['catalog'], lang: Locale): Promise<Genre[]> {
  return unwrap(catalog.GET('/genres', { params: { query: { lang } } }));
}

/** The page after `page`, if the list has more. */
export function nextTitlePage(
  page: Pick<TitlePage, 'pageNumber' | 'pageSize' | 'totalCount'>,
): number | undefined {
  return page.pageNumber * page.pageSize < page.totalCount ? page.pageNumber + 1 : undefined;
}

export type PublishedMovie = CatalogSchemas['PublishedMovie'];
export type PublishedSeries = CatalogSchemas['PublishedSeries'];
export type PublishedSeason = CatalogSchemas['PublishedSeason'];
export type PublishedEpisode = CatalogSchemas['PublishedEpisode'];
export type PublicPerson = CatalogSchemas['PublicPerson'];
export type Credit = CatalogSchemas['CreditResponse'];

/** A published movie with its credits and the languages its video offers; Catalog answers 404 for anything else. */
export function readMovie(
  catalog: PublicClients['catalog'],
  id: string,
  lang: Locale,
): Promise<PublishedMovie> {
  return unwrap(catalog.GET('/movies/{id}', { params: { path: { id }, query: { lang } } }));
}

/** A published series with its published seasons and episodes. */
export function readSeries(
  catalog: PublicClients['catalog'],
  id: string,
  lang: Locale,
): Promise<PublishedSeries> {
  return unwrap(catalog.GET('/series/{id}', { params: { path: { id }, query: { lang } } }));
}

/** Someone credited on published content. */
export function readPerson(
  catalog: PublicClients['catalog'],
  id: string,
  lang: Locale,
): Promise<PublicPerson> {
  return unwrap(catalog.GET('/people/{id}', { params: { path: { id }, query: { lang } } }));
}

/** At most this many titles are asked for by id at once (Catalog's page). */
export const titlesByIdLimit = 100;

/**
 * Titles named by id, such as the ones on a profile's list, in the order of the ids. Unknown and
 * unpublished ones are left out. More than one page of ids is asked in parallel requests.
 */
export async function readTitlesByIds(
  catalog: PublicClients['catalog'],
  ids: readonly string[],
  lang: Locale,
): Promise<TitleSummary[]> {
  const unique = [...new Set(ids)];
  const chunks: string[][] = [];
  for (let start = 0; start < unique.length; start += titlesByIdLimit) {
    chunks.push(unique.slice(start, start + titlesByIdLimit));
  }
  const pages = await Promise.all(
    chunks.map((chunk) =>
      unwrap(catalog.GET('/titles', { params: { query: { lang, ids: chunk, pageSize: titlesByIdLimit } } })),
    ),
  );
  const found = new Map(pages.flatMap((page) => page.items).map((title) => [title.id, title]));
  return unique.flatMap((id) => {
    const title = found.get(id);
    return title ? [title] : [];
  });
}

export type SearchHit = CatalogSchemas['SearchHit'];
export type SearchPage = CatalogSchemas['PageOfSearchHit'];

/** What a search looks for: `q` is trimmed by Catalog, which refuses an empty one or one over 200 characters. */
export interface SearchFilter {
  readonly q: string;
  readonly lang: Locale;
  readonly maxAgeRating?: CatalogAgeRating;
  readonly pageSize?: number;
}

/** The longest search Catalog accepts. */
export const maxSearchLength = 200;

export const searchKeys = {
  results: (filter: SearchFilter) => ['catalog', 'search', filter] as const,
};

/** What recommendations are drawn from: title ids, strongest first, as Streaming's taste gives them. */
export interface RecommendationFilter {
  readonly like: readonly string[];
  readonly unlike?: readonly string[];
  readonly exclude?: readonly string[];
  readonly lang: Locale;
  readonly maxAgeRating?: CatalogAgeRating;
  readonly pageSize?: number;
}

export const recommendationKeys = {
  similar: (id: string, lang: Locale, maxAgeRating: CatalogAgeRating | undefined, pageSize: number) =>
    ['catalog', 'similar', id, lang, maxAgeRating ?? null, pageSize] as const,
  recommended: (filter: RecommendationFilter) => ['catalog', 'recommended', filter] as const,
};

/** Published titles like this one, closest first; none for a title that is not published. 503 without search. */
export function readSimilar(
  catalog: PublicClients['catalog'],
  id: string,
  query: { readonly lang: Locale; readonly maxAgeRating?: CatalogAgeRating; readonly pageSize: number },
): Promise<SearchPage> {
  return unwrap(catalog.GET('/titles/{id}/similar', { params: { path: { id }, query } }));
}

/** Published titles like the liked ones and unlike the unliked ones; none of the given ones. 503 without search. */
export function readRecommended(
  catalog: PublicClients['catalog'],
  filter: RecommendationFilter,
): Promise<SearchPage> {
  const { like, unlike = [], exclude = [], ...rest } = filter;
  return unwrap(
    catalog.GET('/titles/recommended', {
      params: { query: { ...rest, like: [...like], unlike: [...unlike], exclude: [...exclude] } },
    }),
  );
}

/** One page of search results, best match first. Elasticsearch being down is a 503 `Search.Unavailable`. */
export function readSearch(
  catalog: PublicClients['catalog'],
  filter: SearchFilter,
  page = 1,
): Promise<SearchPage> {
  return unwrap(catalog.GET('/search', { params: { query: { ...filter, page } } }));
}
