import type { PublishedMovie, PublishedSeries, TitleSummary } from '@netboxplus/core/reads';
import { createTranslator, locales, type Locale } from '@netboxplus/i18n';
import type { Metadata } from 'next';
import { TitleRow } from '../../components/catalog/title-row';
import { routes } from '../../routes';
import { loadTitles, viewerAgeLimit } from '../../server/catalog';
import { Credits } from './credits';
import { EpisodeList } from './episode-list';
import { metaDescription } from './format';
import { TitleHero, type HeroTitle } from './title-hero';

export type TitleDetails =
  | { readonly kind: 'Movie'; readonly item: PublishedMovie }
  | { readonly kind: 'Series'; readonly item: PublishedSeries };

/** At most this many titles in the "more like this" row. */
export const similarCount = 12;

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** An id from the address that Catalog could know; anything else is a 404 without asking it. */
export function isTitleId(value: string): boolean {
  return uuid.test(value);
}

const openGraphLocales: Record<Locale, string> = { tr: 'tr_TR', en: 'en_US' };

export function titleMetadata(lang: Locale, details: TitleDetails): Metadata {
  const { kind, item } = details;
  const path = (locale: Locale) => routes.title(locale, kind, item.id);
  const description = metaDescription(item.synopsis);
  const image = item.backdropUrl ?? item.posterUrl;
  return {
    title: item.title,
    description,
    alternates: {
      canonical: path(lang),
      languages: Object.fromEntries(locales.map((other) => [other, path(other)])),
    },
    openGraph: {
      type: kind === 'Movie' ? 'video.movie' : 'video.tv_show',
      title: item.title,
      description,
      url: path(lang),
      locale: openGraphLocales[lang],
      alternateLocale: locales.filter((other) => other !== lang).map((other) => openGraphLocales[other]),
      ...(image ? { images: [{ url: image }] } : {}),
    },
  };
}

/**
 * Titles like this one: the most watched of its first genre and kind, without itself, within the chosen
 * profile's age limit. None when it has no genre.
 */
export async function loadSimilar(lang: Locale, details: TitleDetails): Promise<TitleSummary[]> {
  const genre = details.item.genres[0];
  if (!genre) {
    return [];
  }
  const maxAgeRating = await viewerAgeLimit();
  const page = await loadTitles({
    lang,
    kind: details.kind,
    genreId: genre.id,
    sort: 'Popular',
    pageSize: similarCount + 1,
    ...(maxAgeRating ? { maxAgeRating } : {}),
  });
  return page.items.filter((title) => title.id !== details.item.id).slice(0, similarCount);
}

function hero(details: TitleDetails): HeroTitle {
  const { item } = details;
  const common = {
    id: item.id,
    kind: details.kind,
    title: item.title,
    originalTitle: item.originalTitle,
    synopsis: item.synopsis,
    releaseYear: item.releaseYear,
    ageRating: item.ageRating,
    genres: item.genres,
    backdropUrl: item.backdropUrl,
    posterUrl: item.posterUrl,
    audioLanguages: item.audioLanguages,
    subtitleLanguages: item.subtitleLanguages,
  };
  return details.kind === 'Movie'
    ? { ...common, runtimeMinutes: details.item.runtimeMinutes }
    : { ...common, seasonCount: details.item.seasons.length };
}

/** A movie's or a series' page: the hero, a series' episodes, the cast and crew, and similar titles. */
export async function TitlePage({ lang, details }: Readonly<{ lang: Locale; details: TitleDetails }>) {
  const t = createTranslator(lang);
  const similar = await loadSimilar(lang, details);

  return (
    <main className="flex flex-col gap-10 pb-12">
      <TitleHero title={hero(details)} />
      {details.kind === 'Series' && <EpisodeList seriesId={details.item.id} seasons={details.item.seasons} />}
      <Credits credits={details.item.credits} />
      {similar.length > 0 && <TitleRow heading={t('title.similar')} titles={similar} />}
    </main>
  );
}
