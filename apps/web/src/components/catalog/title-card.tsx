'use client';

import type { TitleSummary } from '@netboxplus/core';
import { classNames } from '@netboxplus/ui';
import Link from 'next/link';
import { useLocale } from '../../i18n/translator';
import { routes } from '../../routes';
import { MyListButton } from './my-list-button';
import { TitleFacts } from './title-facts';
import { TitleImage } from './title-image';
import { TitleLogo } from './title-logo';

export interface CardProgress {
  /** How much has been watched, 0 to 1. */
  readonly fraction: number;
  /** Said under the title, such as "23 min left". */
  readonly label: string;
  /** Where the card goes instead of the title's page: the player, at this movie or episode. */
  readonly href?: string;
}

/**
 * A wide card that opens the title's page. Where the pointer can hover (Tailwind's `hover:` applies only
 * there), resting on it for half a second, or focusing something in it from the keyboard, grows it and
 * shows the year, rating and genres, and for a signed-in profile the My List button (next to the link,
 * not inside it); on touch a tap opens the page. Growing is left out when the visitor asks for less motion.
 */
export function TitleCard({
  title,
  label,
  progress,
  sizes,
  eager,
  className,
}: Readonly<{
  title: TitleSummary;
  /** Read before the title, such as a Top 10 rank. */
  label?: string;
  /** For continue watching: a bar over the image and the time left. */
  progress?: CardProgress;
  /** How wide the card is drawn (see TitleImage); a grid card's width by default. */
  sizes?: string;
  /** Above the fold: its image is not loaded lazily. */
  eager?: boolean;
  className?: string;
}>) {
  const { locale } = useLocale();
  const reveal =
    'opacity-0 transition-opacity group-hover:opacity-100 group-hover:delay-500 group-focus-within:opacity-100';

  return (
    <div
      className={classNames(
        'group relative rounded-md',
        'motion-safe:transition-transform motion-safe:duration-200',
        'hover:z-10 hover:delay-500 motion-safe:hover:scale-110',
        'focus-within:z-10 motion-safe:focus-within:scale-110',
        className,
      )}
    >
      <Link
        href={progress?.href ?? routes.title(locale, title.kind, title.id)}
        className="flex flex-col rounded-md outline-none focus-visible:ring-3 focus-visible:ring-focus"
      >
        {/* First in the markup, so it is what a screen reader reads first; drawn under the image. */}
        <span className="order-2 mt-2 block truncate text-sm font-semibold text-ink-strong">
          {label && <span className="sr-only">{label}: </span>}
          {title.title}
          {progress && <span className="block text-xs font-normal text-ink-muted">{progress.label}</span>}
        </span>
        <span className="relative order-1 block overflow-hidden rounded-md">
          <TitleImage
            url={title.backdropUrl ?? title.posterUrl}
            title={title.title}
            {...(sizes ? { sizes } : {})}
            eager={eager ?? false}
          />
          {title.logoUrl && (
            // The name is written under the card; the logo makes the image say which title it is.
            <span
              aria-hidden="true"
              className={classNames(
                'pointer-events-none absolute inset-x-3 top-1/3 bottom-3 flex items-end',
                'transition-opacity group-hover:opacity-0 group-hover:delay-500 group-focus-within:opacity-0',
              )}
            >
              <TitleLogo
                url={title.logoUrl}
                alt=""
                sizes="(min-width: 1024px) 15vw, 45vw"
                className="max-h-full max-w-[70%] object-left-bottom"
              />
            </span>
          )}
          <span
            className={classNames(
              'absolute inset-x-0 bottom-0 bg-linear-to-t from-black/90 via-black/60 to-transparent px-3 pt-8 pb-2',
              reveal,
            )}
          >
            <TitleFacts year={title.releaseYear} rating={title.ageRating} genres={title.genres} />
          </span>
          {progress && (
            <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-1 bg-white/30">
              <span
                className="block h-full bg-brand"
                style={{ width: `${String(Math.round(Math.min(Math.max(progress.fraction, 0), 1) * 100))}%` }}
              />
            </span>
          )}
        </span>
      </Link>
      <span className={classNames('absolute top-2 right-2', reveal)}>
        <MyListButton titleId={title.id} kind={title.kind} title={title.title} variant="card" />
      </span>
    </div>
  );
}
