'use client';

import type { CatalogAgeRating, Genre } from '@netboxplus/core';
import { classNames } from '@netboxplus/ui';
import { useLocale } from '../../i18n/translator';

export function AgeBadge({ rating, className }: Readonly<{ rating: CatalogAgeRating; className?: string }>) {
  const { t } = useLocale();
  return (
    <span
      className={classNames(
        'inline-flex items-center rounded-sm border border-ink-muted px-1.5 text-xs leading-5 font-semibold text-ink',
        className,
      )}
    >
      <span className="sr-only">{t('browse.ageRating')}: </span>
      {t(`age.${rating}`)}
    </span>
  );
}

/** "2024 · 13+ · Drama, Thriller": what a card's preview and the billboard say about a title. */
export function TitleFacts({
  year,
  rating,
  genres,
  className,
}: Readonly<{ year: number; rating: CatalogAgeRating; genres: readonly Genre[]; className?: string }>) {
  return (
    <span className={classNames('flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-ink', className)}>
      <span>{year}</span>
      <AgeBadge rating={rating} />
      {genres.length > 0 && <span>{genres.map((genre) => genre.name).join(', ')}</span>}
    </span>
  );
}
