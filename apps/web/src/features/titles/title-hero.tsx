'use client';

import type { CatalogAgeRating, Genre, TitleKind } from '@netboxplus/core';
import { AgeBadge } from '../../components/catalog/title-facts';
import { MyListButton } from '../../components/catalog/my-list-button';
import { RatingButton } from '../../components/catalog/rating-button';
import { TitleLogo } from '../../components/catalog/title-logo';
import { TrailerBackdrop } from '../../components/catalog/trailer-backdrop';
import { MovieProgress } from './title-progress';
import { PlayButtons } from './play-buttons';
import type { PlayableEpisode } from '../watch/episodes';
import { useLocale } from '../../i18n/translator';
import { formatLanguages, formatRuntime, formatSeasonCount } from './format';

export interface HeroTitle {
  readonly id: string;
  readonly kind: TitleKind;
  readonly title: string;
  readonly originalTitle: string | null | undefined;
  readonly synopsis: string;
  readonly releaseYear: number;
  readonly ageRating: CatalogAgeRating;
  readonly genres: readonly Genre[];
  readonly backdropUrl: string | null | undefined;
  /** The title's logo, drawn instead of its name (which stays its text alternative). */
  readonly logoUrl: string | null | undefined;
  readonly posterUrl: string | null | undefined;
  readonly audioLanguages: readonly string[];
  readonly subtitleLanguages: readonly string[];
  /** A movie's length in minutes; a series gives its number of seasons instead. */
  readonly runtimeMinutes?: number;
  readonly seasonCount?: number;
  /** A series' episodes in watching order, for where its play button goes on. */
  readonly episodes?: readonly PlayableEpisode[];
}

/**
 * The top of a movie's or a series' page: its image (then its trailer) under the header, the name, "year ·
 * rating · length", genres, the synopsis, the languages its video offers, and playing.
 */
export function TitleHero({ title }: Readonly<{ title: HeroTitle }>) {
  const { locale, t } = useLocale();
  const length =
    title.runtimeMinutes !== undefined
      ? formatRuntime(title.runtimeMinutes, t)
      : title.seasonCount !== undefined
        ? formatSeasonCount(title.seasonCount, t)
        : undefined;
  const audio = formatLanguages(title.audioLanguages, locale);
  const subtitles = formatLanguages(title.subtitleLanguages, locale);
  const showOriginal = title.originalTitle && title.originalTitle !== title.title;

  return (
    <section aria-labelledby="title-name" className="relative -mt-16 min-h-[30rem] sm:min-h-[36rem]">
      <TrailerBackdrop
        titleId={title.id}
        imageUrl={title.backdropUrl ?? title.posterUrl}
        title={title.title}
        priority
      />
      <div className="relative flex min-h-[30rem] max-w-3xl flex-col justify-end gap-4 px-4 pt-24 pb-10 sm:min-h-[36rem] sm:px-8">
        <h1
          id="title-name"
          className="font-display text-4xl font-extrabold text-ink-strong drop-shadow-lg sm:text-6xl"
        >
          {title.logoUrl ? (
            <TitleLogo
              url={title.logoUrl}
              alt={title.title}
              sizes="(min-width: 640px) 32rem, 80vw"
              priority
              className="max-h-28 max-w-[min(80vw,32rem)] object-left-bottom sm:max-h-40"
            />
          ) : (
            title.title
          )}
        </h1>
        {showOriginal && (
          <p className="text-sm text-ink-muted">
            {t('title.originalTitle')}: <span lang="">{title.originalTitle}</span>
          </p>
        )}
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-ink">
          <span>{title.releaseYear}</span>
          <span aria-hidden="true">·</span>
          <AgeBadge rating={title.ageRating} />
          {length && (
            <>
              <span aria-hidden="true">·</span>
              <span>{length}</span>
            </>
          )}
          {title.genres.length > 0 && (
            <>
              <span aria-hidden="true">·</span>
              <span>{title.genres.map((genre) => genre.name).join(', ')}</span>
            </>
          )}
        </p>
        {title.kind === 'Movie' && <MovieProgress titleId={title.id} />}
        <p className="max-w-2xl text-base leading-relaxed text-ink">{title.synopsis}</p>
        {(audio.length > 0 || subtitles.length > 0) && (
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
            {audio.length > 0 && (
              <>
                <dt className="text-ink-muted">{t('title.audio')}</dt>
                <dd className="text-ink">{audio.join(', ')}</dd>
              </>
            )}
            {subtitles.length > 0 && (
              <>
                <dt className="text-ink-muted">{t('title.subtitles')}</dt>
                <dd className="text-ink">{subtitles.join(', ')}</dd>
              </>
            )}
          </dl>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <PlayButtons titleId={title.id} kind={title.kind} episodes={title.episodes ?? []} />
          <MyListButton titleId={title.id} kind={title.kind} title={title.title} variant="hero" />
          <RatingButton titleId={title.id} title={title.title} variant="hero" />
        </div>
      </div>
    </section>
  );
}
