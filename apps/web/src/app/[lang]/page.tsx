import type { TitleFilter } from '@netboxplus/core';
import { createTranslator, isLocale, locales } from '@netboxplus/i18n';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Billboard } from '../../components/catalog/billboard';
import { LazyTitleRow } from '../../components/catalog/lazy-title-row';
import { PersonalRows } from '../../components/catalog/personal-rows';
import { TitleRow } from '../../components/catalog/title-row';
import { WelcomeBand } from '../../components/welcome-band';
import { routes } from '../../routes';
import { loadGenres, loadTitles, viewerAgeLimit } from '../../server/catalog';

/** Genre rows the server renders with the page; the rest load as they come near the screen. */
const renderedGenreRows = 2;

export async function generateMetadata({ params }: PageProps<'/[lang]'>): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) {
    return {};
  }
  return {
    alternates: {
      canonical: routes.home(lang),
      languages: Object.fromEntries(locales.map((other) => [other, routes.home(other)])),
    },
  };
}

export default async function HomePage({ params }: PageProps<'/[lang]'>) {
  const { lang } = await params;
  if (!isLocale(lang)) {
    notFound();
  }
  const t = createTranslator(lang);
  const maxAgeRating = await viewerAgeLimit();
  const base: TitleFilter = { lang, ...(maxAgeRating ? { maxAgeRating } : {}) };

  const [popular, newest, genres] = await Promise.all([
    loadTitles({ ...base, sort: 'Popular', pageSize: 10 }),
    loadTitles({ ...base, sort: 'Newest' }),
    loadGenres(lang),
  ]);
  const genreFilter = (genreId: string): TitleFilter => ({ ...base, genreId, sort: 'Popular' });
  const rendered = genres.slice(0, renderedGenreRows);
  const genreRows = await Promise.all(rendered.map((genre) => loadTitles(genreFilter(genre.id))));
  const featured = popular.items.find((title) => title.backdropUrl) ?? popular.items[0];

  return (
    <main className="flex flex-col gap-8 pb-12">
      <h1 className="sr-only">{`${t('brand.name')}: ${t('nav.movies')}, ${t('nav.series')}`}</h1>
      {featured && <Billboard title={featured} />}
      <WelcomeBand />
      <PersonalRows />
      {popular.items.length > 0 && <TitleRow heading={t('browse.top10')} titles={popular.items} ranked />}
      {newest.items.length > 0 && <TitleRow heading={t('browse.new')} titles={newest.items} />}
      {rendered.map((genre, index) => {
        const titles = genreRows[index]?.items ?? [];
        return titles.length > 0 ? <TitleRow key={genre.id} heading={genre.name} titles={titles} /> : null;
      })}
      {genres.slice(renderedGenreRows).map((genre) => (
        <LazyTitleRow key={genre.id} heading={genre.name} filter={genreFilter(genre.id)} />
      ))}
      {!featured && <p className="px-4 py-16 text-center text-ink-muted sm:px-8">{t('browse.empty')}</p>}
    </main>
  );
}
