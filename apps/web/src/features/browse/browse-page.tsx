import type { TitleFilter, TitleKind, TitleSort } from '@netboxplus/core';
import { createTranslator, locales, type Locale } from '@netboxplus/i18n';
import type { Metadata } from 'next';
import { BrowseFilters } from '../../components/catalog/browse-filters';
import { TitleGrid } from '../../components/catalog/title-grid';
import { routes } from '../../routes';
import { loadGenres, loadTitles, viewerAgeLimit } from '../../server/catalog';

type SearchParams = Record<string, string | string[] | undefined>;

export interface BrowseQuery {
  readonly genreId: string | undefined;
  readonly sort: TitleSort;
  readonly page: number;
}

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Far beyond any real list; keeps a hand-written address from asking Catalog for a page it refuses. */
export const maxBrowsePage = 500;

function single(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** The filters in a Movies or Series address; anything unrecognised falls back to the unfiltered list. */
export function parseBrowseQuery(searchParams: SearchParams): BrowseQuery {
  const genre = single(searchParams.genre);
  const sort = single(searchParams.sort);
  const page = Number(single(searchParams.page));
  return {
    genreId: genre && uuid.test(genre) ? genre.toLowerCase() : undefined,
    sort: sort === 'Newest' ? 'Newest' : 'Popular',
    page: Number.isInteger(page) && page >= 1 && page <= maxBrowsePage ? page : 1,
  };
}

const pages = {
  Movie: { route: routes.movies, heading: 'nav.movies', description: 'browse.movies.description' },
  Series: { route: routes.series, heading: 'nav.series', description: 'browse.series.description' },
} as const;

export function browseMetadata(lang: Locale, kind: TitleKind): Metadata {
  const t = createTranslator(lang);
  const page = pages[kind];
  return {
    title: t(page.heading),
    description: t(page.description),
    alternates: {
      canonical: page.route(lang),
      languages: Object.fromEntries(locales.map((other) => [other, page.route(other)])),
    },
  };
}

/** The Movies or the Series page: genre chips, the sort switch and a grid that keeps loading. */
export async function BrowsePage({
  lang,
  kind,
  searchParams,
}: Readonly<{ lang: Locale; kind: TitleKind; searchParams: SearchParams }>) {
  const t = createTranslator(lang);
  const page = pages[kind];
  const query = parseBrowseQuery(searchParams);
  const maxAgeRating = await viewerAgeLimit();
  const filter: TitleFilter = {
    lang,
    kind,
    sort: query.sort,
    ...(query.genreId ? { genreId: query.genreId } : {}),
    ...(maxAgeRating ? { maxAgeRating } : {}),
  };
  const [genres, firstPage] = await Promise.all([loadGenres(lang), loadTitles(filter, query.page)]);
  const pathname = page.route(lang);
  const linkQuery: Record<string, string> = {
    ...(query.genreId ? { genre: query.genreId } : {}),
    ...(query.sort === 'Newest' ? { sort: query.sort } : {}),
  };

  return (
    <main className="flex flex-col gap-4 pt-4">
      <h1 className="px-4 font-display text-3xl font-bold text-ink-strong sm:px-8">{t(page.heading)}</h1>
      <BrowseFilters pathname={pathname} genres={genres} genreId={query.genreId} sort={query.sort} />
      <TitleGrid
        key={JSON.stringify(filter)}
        filter={filter}
        firstPage={firstPage}
        pathname={pathname}
        query={linkQuery}
      />
    </main>
  );
}
