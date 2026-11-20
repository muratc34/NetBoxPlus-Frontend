/**
 * `@netboxplus/core/reads`: the part of the data layer without React, for code that runs while the web
 * server renders a page (server components, route handlers). Everything else is in the main entry.
 */
export { ageRatings, type AgeRating } from './age-ratings';
export {
  catalogKeys,
  catalogStaleTime,
  nextTitlePage,
  readGenres,
  readTitles,
  type CatalogAgeRating,
  type Genre,
  type TitleFilter,
  type TitleKind,
  type TitlePage,
  type TitleSort,
  type TitleSummary,
} from './catalog-reads';
