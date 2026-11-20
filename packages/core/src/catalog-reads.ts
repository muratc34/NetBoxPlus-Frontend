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
export function nextTitlePage(page: TitlePage): number | undefined {
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
