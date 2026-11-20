'use client';

import type { TitleSummary } from '@netboxplus/core';
import Link from 'next/link';
import { useLocale } from '../../i18n/translator';
import { routes } from '../../routes';
import { TitleFacts } from './title-facts';
import { TitleImage } from './title-image';

/**
 * The home page's first screen: the most watched title's wide image under the transparent header, its
 * name and facts, and a way to its page. Its image is the page's largest paint, so it loads first.
 */
export function Billboard({ title }: Readonly<{ title: TitleSummary }>) {
  const { locale, t } = useLocale();

  return (
    <section aria-labelledby="billboard-title" className="relative -mt-16 min-h-[24rem] sm:min-h-[32rem]">
      <div className="absolute inset-0 overflow-hidden">
        <TitleImage
          url={title.backdropUrl ?? title.posterUrl}
          title={title.title}
          priority
          className="h-full w-full"
        />
        <div className="absolute inset-0 bg-linear-to-r from-canvas via-canvas/60 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-32 bg-linear-to-t from-canvas to-transparent" />
      </div>
      <div className="relative flex min-h-[24rem] max-w-2xl flex-col justify-end gap-4 px-4 pt-24 pb-12 sm:min-h-[32rem] sm:px-8">
        <h2
          id="billboard-title"
          className="font-display text-4xl font-extrabold text-ink-strong drop-shadow-lg sm:text-6xl"
        >
          {title.title}
        </h2>
        <TitleFacts year={title.releaseYear} rating={title.ageRating} genres={title.genres} />
        <div>
          <Link
            href={routes.title(locale, title.kind, title.id)}
            className="inline-flex h-12 items-center rounded-md bg-white/20 px-6 font-semibold text-white backdrop-blur-sm hover:bg-white/30 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-focus"
          >
            {t('browse.moreInfo')}
          </Link>
        </div>
      </div>
    </section>
  );
}
