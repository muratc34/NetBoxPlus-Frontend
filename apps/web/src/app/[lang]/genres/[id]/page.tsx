import type { TitleFilter } from '@netboxplus/core/reads';
import { createTranslator, isLocale, locales, type Locale } from '@netboxplus/i18n';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { BrowseFilters } from '../../../../components/catalog/browse-filters';
import { TitleGrid } from '../../../../components/catalog/title-grid';
import { parseBrowseQuery } from '../../../../features/browse/browse-page';
import { isTitleId } from '../../../../features/titles/title-page';
import { routes } from '../../../../routes';
import { loadGenres, loadTitles, viewerAgeLimit } from '../../../../server/catalog';

async function find(params: PageProps<'/[lang]/genres/[id]'>['params']) {
  const { lang, id } = await params;
  if (!isLocale(lang) || !isTitleId(id)) {
    return undefined;
  }
  // Catalog has no single-genre read; the published genres are one small, cached list.
  const genre = (await loadGenres(lang)).find((candidate) => candidate.id === id.toLowerCase());
  return genre ? { lang, genre } : undefined;
}

export async function generateMetadata({ params }: PageProps<'/[lang]/genres/[id]'>): Promise<Metadata> {
  const found = await find(params);
  if (!found) {
    return {};
  }
  const path = (locale: Locale) => routes.genre(locale, found.genre.id);
  return {
    title: found.genre.name,
    description: createTranslator(found.lang)('genre.description').replace('{genre}', found.genre.name),
    alternates: {
      canonical: path(found.lang),
      languages: Object.fromEntries(locales.map((other) => [other, path(other)])),
    },
  };
}

/** A genre's movies and series in one grid, most watched or newest first. */
export default async function GenreRoute({ params, searchParams }: PageProps<'/[lang]/genres/[id]'>) {
  const found = await find(params);
  if (!found) {
    notFound();
  }
  const { lang, genre } = found;
  const query = parseBrowseQuery(await searchParams);
  const maxAgeRating = await viewerAgeLimit();
  const filter: TitleFilter = {
    lang,
    genreId: genre.id,
    sort: query.sort,
    ...(maxAgeRating ? { maxAgeRating } : {}),
  };
  const firstPage = await loadTitles(filter, query.page);
  const pathname = routes.genre(lang, genre.id);

  return (
    <main className="flex flex-col gap-4 pt-4">
      <h1 className="px-4 font-display text-3xl font-bold text-ink-strong sm:px-8">{genre.name}</h1>
      <BrowseFilters pathname={pathname} genres={[]} genreId={undefined} sort={query.sort} />
      <TitleGrid
        key={JSON.stringify(filter)}
        filter={filter}
        firstPage={firstPage}
        pathname={pathname}
        query={query.sort === 'Newest' ? { sort: query.sort } : {}}
      />
    </main>
  );
}
